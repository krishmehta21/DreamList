from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from supabase import create_client, Client

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    PORT: int = 8000
    HOST: str = "0.0.0.0"

@lru_cache
def get_settings() -> Settings:
    return Settings()

def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
