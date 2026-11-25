from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
# Pin each connection's time zone to the team's, so anything Postgres itself
# renders as a date (now(), ::date) matches the dates the app stores.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={"options": f"-c timezone={settings.app_timezone}"},
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
