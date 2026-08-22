from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException

from app.config import get_settings
from app.llm import MissingAPIKeyError, MistralGateway
from app.models import (
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
    title="Seller + Sourcing Agents",
    version="0.1.0",
    description="Mistral-powered resale valuation, guarded negotiation, and event discovery.",
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


@app.post("/seller/value", response_model=ValuationResponse)
def value_item(
    request: ValuationRequest,
    service: Annotated[SellerService, Depends(get_seller_service)],
) -> ValuationResponse:
    return service.value_item(request)


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
