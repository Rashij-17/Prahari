"""
Prahari — Backend Core Configuration
=====================================
Manages environment variables via Pydantic Settings.
All third-party API keys are loaded from a .env file — never hard-coded.

Usage:
    from backend.core.config import settings
    print(settings.infermedica_app_id)
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Add a .env file in the /backend directory to populate these values
    without committing secrets to source control.
    """

    # Application
    app_name: str = "Prahari — MedLens API"
    app_version: str = "0.1.0"
    debug: bool = False

    # Frontend Origin (for CORS)
    frontend_origin: str = "http://localhost:5173"

    # External API Keys (populate via .env file — never commit values)
    infermedica_app_id: str = ""
    infermedica_app_key: str = ""
    google_places_api_key: str = ""

    # Model config: reads from backend/.env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


# Singleton instance — import this throughout the application
settings = Settings()
