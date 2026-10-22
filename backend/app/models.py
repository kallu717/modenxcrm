from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Sequence, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entra_oid: Mapped[str | None] = mapped_column(String(64), unique=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(16))  # "Rep" | "Manager"
    color: Mapped[str] = mapped_column(String(9))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


lead_id_seq = Sequence("lead_id_seq", metadata=Base.metadata)


class Lead(Base):
    """One contact. `data` is the full lead object the UI works with; the
    typed columns are copies of the fields we need to query, filter and
    constrain on, kept in sync by the API."""

    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    account: Mapped[str] = mapped_column(String(300), index=True)
    email_lc: Mapped[str | None] = mapped_column(String(320))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    stage: Mapped[str] = mapped_column(String(16), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    data: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    __table_args__ = (
        # One lead per email address, enforced by the database, not just the API.
        Index(
            "uq_leads_email_lc",
            "email_lc",
            unique=True,
            postgresql_where=text("email_lc IS NOT NULL AND email_lc <> ''"),
        ),
    )


class Record(Base):
    """Small per-kind documents: change requests, leave requests, approved
    leave days, company holidays, payment reminders, call targets."""

    __tablename__ = "records"

    kind: Mapped[str] = mapped_column(String(32), primary_key=True)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    data: Mapped[dict] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
