import re
from concurrent.futures import ThreadPoolExecutor
from html import unescape
from urllib.parse import parse_qs, unquote, urlparse

import requests

RESULT_LINK = re.compile(
    r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL
)
SNIPPET = re.compile(
    r'class="result__snippet"[^>]*>(.*?)</(?:a|div)>', re.IGNORECASE | re.DOTALL
)
TAG = re.compile(r"<[^>]+>")


def _clean(value: str) -> str:
    return " ".join(unescape(TAG.sub(" ", value)).split())


def _direct_url(value: str) -> str:
    value = unescape(value)
    if value.startswith("//"):
        value = f"https:{value}"
    parsed = urlparse(value)
    redirected = parse_qs(parsed.query).get("uddg")
    return unquote(redirected[0]) if redirected else value


def _search(query: str) -> list[dict[str, str]]:
    response = requests.get(
        "https://html.duckduckgo.com/html/",
        params={"q": query},
        headers={"User-Agent": "Mozilla/5.0 (compatible; ResaleAgent/0.1)"},
        timeout=12,
    )
    response.raise_for_status()
    results = []
    for match in RESULT_LINK.finditer(response.text):
        url = _direct_url(match.group(1))
        if not url.startswith(("http://", "https://")):
            continue
        nearby = response.text[match.end() : match.end() + 3500]
        snippet_match = SNIPPET.search(nearby)
        results.append(
            {
                "title": _clean(match.group(2)),
                "url": url,
                "source": urlparse(url).netloc.removeprefix("www."),
                "snippet": _clean(snippet_match.group(1)) if snippet_match else "",
            }
        )
        if len(results) >= 8:
            break
    return results


def search_future_events(
    area: str, start: str, end: str, interests: list[str]
) -> tuple[str, list[dict[str, str]]]:
    themes = interests[:3] or ["photography", "cycling"]
    queries = [f"{area} upcoming {theme} events" for theme in themes]
    queries.append(f'{area} Lu.ma upcoming {" ".join(themes)} events')
    with ThreadPoolExecutor(max_workers=min(len(queries), 4)) as executor:
        groups = list(executor.map(_search, queries))

    seen: set[str] = set()
    references = []
    lines = []
    for group in groups:
        for item in group:
            if item["url"] in seen:
                continue
            seen.add(item["url"])
            references.append({key: item[key] for key in ("title", "url", "source")})
            lines.append(
                f"TITLE: {item['title']}\nURL: {item['url']}\nSNIPPET: {item['snippet']}"
            )
    return "\n\n".join(lines), references
