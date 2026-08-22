from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/seller/app/config.py → repo root .env
_REPO_ROOT = Path(__file__).resolve().parents[3]
_ROOT_ENV = _REPO_ROOT / ".env"
_LOCAL_ENV = Path(__file__).resolve().parents[1] / ".env"  # backend/seller/.env


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_ROOT_ENV), str(_LOCAL_ENV)),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mistral_api_key: SecretStr | None = None
    mistral_model: str = "mistral-medium-latest"
    mistral_search_tool: Literal["web_search", "web_search_premium"] = "web_search"


@lru_cache
def get_settings() -> Settings:
    return Settings()
