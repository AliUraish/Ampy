import pytest
from pydantic import ValidationError

from app.models import (
    NegotiationAction,
    NegotiationRequest,
    SellerDraft,
    ValuationDraft,
    ValuationRequest,
)
from app.services.seller import SellerService


class FakeGateway:
    def __init__(self, drafts: dict[type, object], references=None):
        self.drafts = drafts
        self.references = references or []

    def parse(self, *, system, user, response_model):
        return self.drafts[response_model]

    def web_research(self, prompt):
        return "mock research", self.references


def negotiation_request(**overrides) -> NegotiationRequest:
    values = {
        "item_description": "Vintage walnut side table",
        "buyer_message": "Would you take $50?",
        "listing_price": 100,
        "target_price": 80,
        "floor_price": 65,
        "turn_number": 1,
    }
    values.update(overrides)
    return NegotiationRequest(**values)


def test_price_order_is_validated():
    with pytest.raises(ValidationError):
        negotiation_request(target_price=60, floor_price=70)


def test_minimum_price_concedes_slowly():
    assert SellerService.minimum_price_for_turn(negotiation_request(turn_number=1)) == 95
    assert SellerService.minimum_price_for_turn(negotiation_request(turn_number=4)) == 80
    assert SellerService.minimum_price_for_turn(negotiation_request(turn_number=8)) == 65


def test_below_limit_model_output_is_replaced():
    draft = SellerDraft(
        reply="Sure, USD 60 works.",
        action=NegotiationAction.ACCEPT,
        recommended_price=60,
        rationale="Close now",
        next_move="Arrange pickup",
    )
    service = SellerService(FakeGateway({SellerDraft: draft}))

    result = service.negotiate(negotiation_request())

    assert result.action == NegotiationAction.COUNTER
    assert result.recommended_price == 95
    assert "USD 95.00" in result.reply
    assert result.guardrail_applied is True


def test_accept_below_limit_without_price_in_reply_is_still_blocked():
    draft = SellerDraft(
        reply="Deal.",
        action=NegotiationAction.ACCEPT,
        recommended_price=50,
        rationale="Close now",
        next_move="Arrange pickup",
    )
    service = SellerService(FakeGateway({SellerDraft: draft}))

    result = service.negotiate(negotiation_request())

    assert result.action == NegotiationAction.COUNTER
    assert result.recommended_price == 95
    assert result.guardrail_applied is True


def test_valuation_enforces_requested_margin_and_source_urls():
    supported_url = "https://example.com/sold/123"
    draft = ValuationDraft.model_validate(
        {
            "low_value": 90,
            "high_value": 140,
            "quick_sale_value": 80,
            "recommended_list_price": 135,
            "suggested_floor_price": 95,
            "confidence": 80,
            "rationale": "Recent comparable sale.",
            "comparables": [
                {"title": "Supported", "price": 125, "url": supported_url},
                {"title": "Hallucinated", "price": 150, "url": "https://fake.test/item"},
            ],
        }
    )
    gateway = FakeGateway(
        {ValuationDraft: draft},
        references=[{"title": "Comp", "url": supported_url, "source": "web_search"}],
    )
    service = SellerService(gateway)

    result = service.value_item(
        ValuationRequest(
            item_description="Vintage walnut side table",
            condition="good",
            purchase_cost=100,
            minimum_margin_pct=20,
        )
    )

    assert result.protected_floor_price == 120
    assert result.estimated_profit_at_floor == 20
    assert result.viable_at_requested_margin is True
    assert [str(item.url) for item in result.comparables] == [supported_url]

