"""Allow "payment" records (a monthly debit marked as paid)

Revision ID: 0005
Revises: 0004
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

# Written out here, not imported from app.models (see 0002).
OLD_KINDS = ("change_request", "leave_request", "leave_day", "holiday", "payment_reminder", "target")
NEW_KINDS = OLD_KINDS + ("payment",)


def _one_of(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def upgrade() -> None:
    op.drop_constraint("ck_records_kind", "records", type_="check")
    op.create_check_constraint("ck_records_kind", "records", _one_of("kind", NEW_KINDS))


def downgrade() -> None:
    op.execute("DELETE FROM records WHERE kind = 'payment'")
    op.drop_constraint("ck_records_kind", "records", type_="check")
    op.create_check_constraint("ck_records_kind", "records", _one_of("kind", OLD_KINDS))
