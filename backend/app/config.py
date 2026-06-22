"""
KAVACH — Application Configuration
Reads all settings from environment variables with sensible defaults.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "KAVACH"
    app_version: str = "1.0.0"
    app_env: str = Field(default="development", env="APP_ENV")
    app_secret_key: str = Field(default="change-me", env="APP_SECRET_KEY")
    debug: bool = Field(default=False, env="DEBUG")

    # Directories
    upload_dir: str = Field(default="uploads", env="UPLOAD_DIR")
    reports_dir: str = Field(default="reports", env="REPORTS_DIR")
    data_dir: str = Field(default="data", env="DATA_DIR")

    # Gemini AI
    gemini_api_key: str = Field(default="", env="GEMINI_API_KEY")
    gemini_model: str = "gemini-1.5-flash"

    # CORS
    allowed_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        env="ALLOWED_ORIGINS",
    )

    def ensure_dirs(self) -> None:
        """Create required directories if they do not exist."""
        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(self.reports_dir, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton — use this everywhere."""
    settings = Settings()
    settings.ensure_dirs()
    return settings
