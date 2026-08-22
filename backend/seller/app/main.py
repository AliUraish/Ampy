from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException

from app.config import get_settings
from app.llm import MissingAPIKeyError, MistralGateway
from app.models import (
    BuyerAskRequest,
    BuyerAskResponse,
    BuyerNegotiateRequest,
    BuyerNegotiateResponse,
    EventScoutResponse,
    EventSearchRequest,
    NegotiationRequest,
    NegotiationResponse,
    ValuationRequest,
    ValuationResponse,
)
from app.services.events import EventService
from app.services.seller import SellerService

app = FastAPI(
    title="Ampy Seller + Sourcing Agents",
    version="0.1.0",
    description=(
        "Mistral-powered resale valuation, guarded negotiation, event discovery, "
        "and buyer-agent contract endpoints (/ask, /negotiate)."
    ),
)


@lru_cache
def get_gateway() -> MistralGateway:
    try:
        return MistralGateway(get_settings())
    except MissingAPIKeyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def get_seller_service(
    gateway: Annotated[MistralGateway, Depends(get_gateway)],
) -> SellerService:
    return SellerService(gateway)


def get_event_service(
    gateway: Annotated[MistralGateway, Depends(get_gateway)],
) -> EventService:
    return EventService(gateway)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ask", response_model=BuyerAskResponse)
def ask_buyer(
    request: BuyerAskRequest,
    service: Annotated[SellerService, Depends(get_seller_service)],
) -> BuyerAskResponse:
    """Buyer-agent contract: answer a question about a listing."""
    return service.answer_question(request)


@app.post("/negotiate", response_model=BuyerNegotiateResponse)
def negotiate_buyer(
    request: BuyerNegotiateRequest,
    service: Annotated[SellerService, Depends(get_seller_service)],
) -> BuyerNegotiateResponse:
    """Buyer-agent contract: one offer/counter round."""
    return service.negotiate_buyer_contract(request)


def _llm_http_error(exc: Exception) -> HTTPException | None:
    message = str(exc)
    lowered = message.lower()
    if "429" in message or "rate_limit" in lowered or "rate limit" in lowered:
        return HTTPException(
            status_code=429,
            detail="Mistral rate limit reached. Wait a moment and try again.",
        )
    if "api key" in lowered or "unauthorized" in lowered or "401" in message:
        return HTTPException(status_code=503, detail="Seller LLM is not configured.")
    return None


@app.post("/seller/value", response_model=ValuationResponse)
def value_item(
    request: ValuationRequest,
    service: Annotated[SellerService, Depends(get_seller_service)],
) -> ValuationResponse:
    try:
        return service.value_item(request)
    except HTTPException:
        raise
    except Exception as exc:
        mapped = _llm_http_error(exc)
        if mapped:
            raise mapped from exc
        raise HTTPException(status_code=502, detail="Seller valuation failed.") from exc


@app.post("/seller/negotiate", response_model=NegotiationResponse)
def negotiate(
    request: NegotiationRequest,
    service: Annotated[SellerService, Depends(get_seller_service)],
) -> NegotiationResponse:
    return service.negotiate(request)


@app.post("/events/discover", response_model=EventScoutResponse)
def discover_events(
    request: EventSearchRequest,
    service: Annotated[EventService, Depends(get_event_service)],
) -> EventScoutResponse:
    return service.discover(request)
