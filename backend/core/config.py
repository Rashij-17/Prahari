"""
Prahari — Backend Core Configuration
=====================================
Manages environment variables via Pydantic Settings.
All third-party API keys are loaded from a .env file — never hard-coded.

Usage:
    from core.config import settings
    print(settings.infermedica_app_id)
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices, model_validator


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

    # External API Keys & Configurations
    infermedica_app_id: str = ""
    infermedica_app_key: str = ""
    google_places_api_key: str = ""
    
    # Vision & OCR Models configuration
    gemini_api_key: str = ""
    groq_api_key: str = ""

    # Database & Supabase Auth configuration
    database_url: str = "sqlite:///./prahari.db"
    supabase_jwt_secret: str = ""
    supabase_url: str = ""



    # Web Push VAPID Configuration
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_claims_email: str = Field("", validation_alias=AliasChoices("vapid_claims_email", "vapid_mailto"))

    # SMTP Email Integration (Gmail)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""


    # Model config: reads from backend/.env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="before")
    @classmethod
    def clean_quotes(cls, data: any) -> any:
        if isinstance(data, dict):
            return {
                k: (v.strip().strip("'\"") if isinstance(v, str) else v)
                for k, v in data.items()
            }
        return data



# Singleton instance — import this throughout the application
settings = Settings()

