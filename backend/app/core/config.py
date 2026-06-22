from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    PROJECT_NAME: str = "Luminar"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="development", pattern="^(development|production|test)$")

    DATABASE_URL: str

    OPENAI_API_KEY: str

    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    APP_URL: str = "http://localhost:5173"

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days
    SUPABASE_URL: str
    S3_ENDPOINT: str = Field(
        validation_alias=AliasChoices("S3_ENDPOINT", "SUPABASE_S3_ENDPOINT")
    )
    S3_REGION: str = Field(
        default="ap-northeast-1",
        validation_alias=AliasChoices("S3_REGION", "SUPABASE_S3_REGION"),
    )
    S3_ACCESS_KEY_ID: str = Field(
        validation_alias=AliasChoices("S3_ACCESS_KEY_ID", "SUPABASE_S3_ACCESS_KEY_ID")
    )
    S3_SECRET_ACCESS_KEY: str = Field(
        validation_alias=AliasChoices("S3_SECRET_ACCESS_KEY", "SUPABASE_S3_SECRET_ACCESS_KEY")
    )
    S3_BUCKET: str = Field(
        default="luminar",
        validation_alias=AliasChoices("S3_BUCKET", "SUPABASE_S3_BUCKET"),
    )

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
