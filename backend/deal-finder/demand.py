#!/usr/bin/env python3
"""Small pytrends sidecar for lib/demand.js."""

import json
import sys
from datetime import timedelta


def emit(payload):
    print(json.dumps(payload, separators=(",", ":")))


def main():
    try:
        keyword = sys.argv[1].strip()
        geo = sys.argv[2].strip()
        if not keyword or not geo:
            raise ValueError("keyword and geo are required")

        from pytrends.request import TrendReq

        trends = TrendReq()
        trends.build_payload([keyword], timeframe="today 3-m", geo=geo)
        frame = trends.interest_over_time()
        if frame is None or frame.empty or keyword not in frame.columns:
            raise ValueError("empty trends response")

        series = frame[keyword].dropna()
        if series.empty:
            raise ValueError("empty trends series")

        if float(series.max()) <= 0:
            raise ValueError("trends series has no interest")

        cutoff = series.index.max() - timedelta(weeks=4)
        recent = series.loc[series.index > cutoff]
        if recent.empty:
            raise ValueError("no recent trends data")

        # Momentum vs the series median, not vs the peak: Trends normalizes
        # every keyword to 100 at its own spike, so recent/peak punishes any
        # keyword with one viral blip. recent/median ~ 1.0 means steady
        # interest (-> 0.5), > 1 rising, < 1 fading. Also weight in the
        # absolute level a little so a dead keyword can't score 0.5.
        baseline = max(float(series.median()), 1.0)
        momentum = float(recent.mean()) / baseline  # ~0..2+
        level = float(recent.mean()) / 100.0
        value = 0.7 * min(momentum / 2.0, 1.0) + 0.3 * level
        value = max(0.0, min(1.0, value))
        emit({"value": round(value, 3), "momentum": round(momentum, 2), "level": round(level, 2)})
    except Exception as exc:
        emit({"error": str(exc) or exc.__class__.__name__})


if __name__ == "__main__":
    main()
