from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mistral_api_key: SecretStr | None = None
    mistral_model: str = "mistral-medium-latest"
    mistral_search_tool: Literal["web_search", "web_search_premium"] = "web_search"


@lru_cache
def get_settings() -> Settings:
    return Settings()

