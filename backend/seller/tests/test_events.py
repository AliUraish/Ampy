from app.services.events import EventService


def test_opportunity_score_is_weighted_for_profit_signals():
    score = EventService.opportunity_score(
        discount=90,
        resale=80,
        sourcing=70,
        confidence=60,
    )
    assert score == 79.5


def test_opportunity_score_stays_in_range():
    assert EventService.opportunity_score(
        discount=0, resale=0, sourcing=0, confidence=0
    ) == 0
    assert EventService.opportunity_score(
        discount=100, resale=100, sourcing=100, confidence=100
    ) == 100

