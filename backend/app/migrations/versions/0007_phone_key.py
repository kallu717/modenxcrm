"""One lead per phone number: add leads.phone_key (the phone's 10 digits) with
a unique index, like the email one.

Saved phones are filled in from each lead's data. A number that doesn't fit
the 10-digit rule gets no key (the lead is left as it is). If two saved leads
already share a number, the older lead (lowest id number) keeps the key and
the others get none, so the upgrade never fails on old data.

Revision ID: 0007
Revises: 0006
"""

import re

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

_ALLOWED = re.compile(r"^\+?[\d\s\-.()]+$")


# Written out here, not imported from app.phone (see 0002): a migration must
# keep doing what it did when it was written.
def _digits(raw):
    s = (raw or "").strip()
    if not s or not _ALLOWED.match(s):
        return None
    d = re.sub(r"\D", "", s)
    if len(d) == 12 and d.startswith("91"):
        d = d[2:]
    elif len(d) == 11 and d.startswith("0"):
        d = d[1:]
    return d if len(d) == 10 else None


def _id_number(lead_id: str) -> int:
    n = re.sub(r"\D", "", lead_id)
    return int(n) if n else 0


def upgrade() -> None:
    op.add_column("leads", sa.Column("phone_key", sa.String(10), nullable=True))
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, data->>'phone' FROM leads")).all()
    taken: set[str] = set()
    for lead_id, phone in sorted(rows, key=lambda r: (_id_number(r[0]), r[0])):
        key = _digits(phone)
        if key and key not in taken:
            taken.add(key)
            conn.execute(sa.text("UPDATE leads SET phone_key = :k WHERE id = :i"), {"k": key, "i": lead_id})
    op.create_index(
        "uq_leads_phone_key", "leads", ["phone_key"], unique=True,
        postgresql_where=sa.text("phone_key IS NOT NULL AND phone_key <> ''"),
    )


def downgrade() -> None:
    op.drop_index("uq_leads_phone_key", table_name="leads")
    op.drop_column("leads", "phone_key")
