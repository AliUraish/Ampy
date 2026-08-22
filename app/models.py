from datetime import date
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator

Money = Annotated[float, Field(ge=0, allow_inf_nan=False)]
Percent = Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]
Score = Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]


class Condition(StrEnum):
    NEW = "new"
    LIKE_NEW = "like_new"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class ConversationMessage(BaseModel):
    role: Literal["buyer", "seller"]
    content: str = Field(min_length=1, max_length=4000)


class ValuationRequest(BaseModel):
    item_description: str = Field(min_length=3, max_length=4000)
    condition: Condition
    area: str | None = Field(default=None, max_length=200)
    purchase_cost: Money = 0
    minimum_margin_pct: Percent = 20
    currency: str = Field(default="USD", min_length=3, max_length=3)


class ComparableSale(BaseModel):
    title: str
    price: Money | None = None
    url: HttpUrl
    notes: str = ""


class ValuationResponse(BaseModel):
    currency: str
    low_value: Money
    high_value: Money
    quick_sale_value: Money
    recommended_list_price: Money
    protected_floor_price: Money
    estimated_profit_at_floor: float
    viable_at_requested_margin: bool
    confidence: Score
    rationale: str
    comparables: list[ComparableSale] = Field(default_factory=list)


class NegotiationAction(StrEnum):
    COUNTER = "counter"
    ACCEPT = "accept"
    HOLD = "hold"
    WALK_AWAY = "walk_away"
    ASK_QUESTION = "ask_question"


class NegotiationRequest(BaseModel):
    item_description: str = Field(min_length=3, max_length=4000)
    buyer_message: str = Field(min_length=1, max_length=4000)
    listing_price: Money
    target_price: Money
    floor_price: Money
    currency: str = Field(default="USD", min_length=3, max_length=3)
    turn_number: int = Field(default=1, ge=1, le=50)
    conversation: list[ConversationMessage] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def prices_are_ordered(self) -> "NegotiationRequest":
        if not self.floor_price <= self.target_price <= self.listing_price:
            raise ValueError("prices must satisfy floor_price <= target_price <= listing_price")
        return self


class NegotiationResponse(BaseModel):
    reply: str
    action: NegotiationAction
    recommended_price: Money
    minimum_allowed_this_turn: Money
    rationale: str
    next_move: str
    guardrail_applied: bool = False


DEFAULT_EVENT_SOURCES = [
    "lu.ma",
    "eventbrite.com",
    "estatesales.net",
    "estatesales.org",
    "auctionzip.com",
    "craigslist.org",
]


class EventSearchRequest(BaseModel):
    area: str = Field(min_length=2, max_length=200)
    start_date: date | None = None
    days_ahead: int = Field(default=14, ge=1, le=90)
    radius_miles: int = Field(default=30, ge=1, le=250)
    item_interests: list[str] = Field(default_factory=list, max_length=20)
    max_purchase_budget: Money | None = None
    minimum_score: Score = 55
    max_results: int = Field(default=10, ge=1, le=25)
    sources: list[str] = Field(default_factory=lambda: DEFAULT_EVENT_SOURCES.copy(), max_length=20)


class EventOpportunity(BaseModel):
    title: str
    source: str
    url: HttpUrl
    date_and_time: str
    location: str
    event_type: str
    likely_items: list[str]
    why_it_may_be_valuable: str
    discount_potential: Score
    resale_potential: Score
    sourcing_probability: Score
    evidence_confidence: Score
    opportunity_score: Score
    risks: list[str] = Field(default_factory=list)
    suggested_plan: str


class EventScoutResponse(BaseModel):
    area: str
    search_window: str
    opportunities: list[EventOpportunity]
    searched_sources: list[str]
    notes: list[str] = Field(default_factory=list)


# Internal structured outputs returned by Mistral.
class SellerDraft(BaseModel):
    reply: str
    action: NegotiationAction
    recommended_price: Money
    rationale: str
    next_move: str


class ValuationDraft(BaseModel):
    low_value: Money
    high_value: Money
    quick_sale_value: Money
    recommended_list_price: Money
    suggested_floor_price: Money
    confidence: Score
    rationale: str
    comparables: list[ComparableSale] = Field(default_factory=list, max_length=8)


class EventDraft(BaseModel):
    title: str
    source: str
    url: HttpUrl
    date_and_time: str
    location: str
    event_type: str
    likely_items: list[str]
    why_it_may_be_valuable: str
    discount_potential: Score
    resale_potential: Score
    sourcing_probability: Score
    evidence_confidence: Score
    risks: list[str] = Field(default_factory=list)
    suggested_plan: str


class EventRankingDraft(BaseModel):
    opportunities: list[EventDraft] = Field(default_factory=list, max_length=25)
    notes: list[str] = Field(default_factory=list)

