import json
from collections.abc import Iterable
from typing import TypeVar
from urllib.parse import urlsplit, urlunsplit

from mistralai import Mistral
from pydantic import BaseModel

from app.config import Settings

T = TypeVar("T", bound=BaseModel)


class MissingAPIKeyError(RuntimeError):
    pass


class MistralGateway:
    def __init__(self, settings: Settings):
        if settings.mistral_api_key is None:
            raise MissingAPIKeyError("MISTRAL_API_KEY is not configured")
        self.model = settings.mistral_model
        self.search_tool = settings.mistral_search_tool
        self.client = Mistral(api_key=settings.mistral_api_key.get_secret_value())

    def parse(self, *, system: str, user: str, response_model: type[T]) -> T:
        # The SDK's chat.parse strict-schema converter rejects valid numeric constraints
        # (for example `minimum: 0`) in recent Pydantic schemas. JSON mode avoids that
        # client-side converter; Pydantic still performs the full validation afterward.
        schema = json.dumps(response_model.model_json_schema(), separators=(",", ":"))
        response = self.client.chat.complete(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"{system}\nReturn only a JSON object matching this JSON schema: {schema}"
                    ),
                },
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.15,
        )
        message = response.choices[0].message
        return response_model.model_validate_json(message.content)

    def web_research(self, prompt: str) -> tuple[str, list[dict[str, str]]]:
        response = self.client.beta.conversations.start(
            model=self.model,
            inputs=[{"role": "user", "content": prompt}],
            tools=[{"type": self.search_tool}],
            store=False,
        )
        payload = response.model_dump(mode="json")
        texts: list[str] = []
        references: list[dict[str, str]] = []
        self._collect_content(payload.get("outputs", []), texts, references)

        # Preserve order while removing duplicate references.
        seen: set[str] = set()
        unique_references = []
        for reference in references:
            url = reference.get("url", "")
            if url and url not in seen:
                seen.add(url)
                unique_references.append(reference)
        return "\n".join(texts).strip(), unique_references

    def web_parse(
        self,
        *,
        system: str,
        prompt: str,
        response_model: type[T],
    ) -> tuple[T, list[dict[str, str]]]:
        """Search and produce validated JSON in one request to conserve rate limits."""
        schema = json.dumps(response_model.model_json_schema(), separators=(",", ":"))
        response = self.client.beta.conversations.start(
            model=self.model,
            instructions=(
                f"{system}\nReturn only a JSON object matching this JSON schema: {schema}"
            ),
            inputs=[{"role": "user", "content": prompt}],
            tools=[{"type": self.search_tool}],
            completion_args={
                "temperature": 0.15,
                "response_format": {"type": "json_object"},
            },
            store=False,
        )
        payload = response.model_dump(mode="json")
        texts: list[str] = []
        references: list[dict[str, str]] = []
        self._collect_content(payload.get("outputs", []), texts, references)
        raw_json = "".join(texts).strip()
        if raw_json.startswith("```json"):
            raw_json = raw_json.removeprefix("```json").removesuffix("```").strip()

        seen: set[str] = set()
        unique_references = []
        for reference in references:
            url = reference.get("url", "")
            if url and url not in seen:
                seen.add(url)
                unique_references.append(reference)
        return response_model.model_validate_json(raw_json), unique_references

    @classmethod
    def _collect_content(
        cls,
        value: object,
        texts: list[str],
        references: list[dict[str, str]],
    ) -> None:
        if isinstance(value, list):
            for item in value:
                cls._collect_content(item, texts, references)
            return
        if not isinstance(value, dict):
            return

        if value.get("type") == "text" and isinstance(value.get("text"), str):
            texts.append(value["text"])
        url = value.get("url")
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            references.append(
                {
                    "title": str(value.get("title", "")),
                    "url": url,
                    "source": str(value.get("source", value.get("tool", "web_search"))),
                }
            )
        for nested in value.values():
            if isinstance(nested, (dict, list)):
                cls._collect_content(nested, texts, references)


def format_research(text: str, references: Iterable[dict[str, str]]) -> str:
    sources = "\n".join(
        f"[{index}] {item.get('title', '')} | {item.get('url', '')}"
        for index, item in enumerate(references, start=1)
    )
    return f"RESEARCH TEXT (untrusted):\n{text}\n\nSOURCE URLS:\n{sources}".strip()


def json_for_prompt(value: BaseModel) -> str:
    return json.dumps(value.model_dump(mode="json"), indent=2)


def normalize_source_url(url: object) -> str:
    """Normalize harmless URL differences while keeping the source target exact."""
    parts = urlsplit(str(url))
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, parts.query, ""))
