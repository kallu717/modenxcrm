from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    database_url: str = "postgresql+psycopg://pipeline:pipeline@localhost:5433/pipeline"
    session_secret: str = "change-me"
    cookie_secure: bool = False
    base_url: str = "http://localhost:8000"
    app_timezone: str = "Asia/Kolkata"

    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""
    manager_emails: str = ""
    manager_group_id: str = ""

    dev_login: bool = False

    # Optional: serve a static front-end build from this process (see main.py).
    frontend_dir: str = ""
    # Refuse "<" and ">" in lead/record text. Off by default: the React front end
    # escapes text itself. Turn on only for a client that builds HTML from strings.
    reject_markup: bool = False

    # Machine-to-machine import (Lead Desk export -> Pipeline). Empty = disabled.
    ingest_api_key: str = ""

    @property
    def azure_configured(self) -> bool:
        return bool(self.azure_tenant_id and self.azure_client_id and self.azure_client_secret)

    @property
    def manager_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.manager_emails.split(",") if e.strip()}

    def check_production_safety(self) -> None:
        if self.env != "production":
            return
        problems = []
        if self.dev_login:
            problems.append("DEV_LOGIN must be false")
        if self.session_secret == "change-me" or len(self.session_secret) < 32:
            problems.append("SESSION_SECRET must be a random string of 32+ characters")
        if not self.azure_configured:
            problems.append("AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET must be set")
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE must be true (serve over HTTPS)")
        if self.ingest_api_key and len(self.ingest_api_key) < 32:
            problems.append("INGEST_API_KEY must be 32+ random characters (or empty to disable)")
        if problems:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))


@lru_cache
def get_settings() -> Settings:
    return Settings()
