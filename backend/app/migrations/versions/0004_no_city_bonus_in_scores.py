"""Drop the Bengaluru +10 from saved priority scores

Revision ID: 0004
Revises: 0003

Scores are worked out when a lead is saved, so leads saved before the city
bonus was removed still carry it. This takes it off once, and resets the
automatic band (a manual override is left alone).
"""

import json

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

BONUS = 10
REASON = "flagship city (+10)"


# Written out here, not imported from app.scoring (see 0002).
def _band(score: int) -> str:
    if score >= 30:
        return "Hot"
    if score >= 20:
        return "Warm"
    if score >= 12:
        return "Nurture"
    return "Low"


def _rewrite(change) -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, data FROM leads")).fetchall()
    for lead_id, data in rows:
        if change(data):
            data["priorityAuto"] = _band(int(data.get("score") or 0))
            bind.execute(
                sa.text("UPDATE leads SET data = CAST(:d AS jsonb) WHERE id = :id"),
                {"d": json.dumps(data), "id": lead_id},
            )


def _remove(data: dict) -> bool:
    reasons = data.get("scoreReasons") or []
    if REASON not in reasons:
        return False
    data["scoreReasons"] = [r for r in reasons if r != REASON]
    data["score"] = int(data.get("score") or 0) - BONUS
    return True


def _put_back(data: dict) -> bool:
    city = (data.get("city") or "").strip().lower()
    reasons = data.get("scoreReasons") or []
    if city not in ("bengaluru", "bangalore") or REASON in reasons:
        return False
    data["scoreReasons"] = reasons + [REASON]
    data["score"] = int(data.get("score") or 0) + BONUS
    return True


def upgrade() -> None:
    _rewrite(_remove)


def downgrade() -> None:
    _rewrite(_put_back)
