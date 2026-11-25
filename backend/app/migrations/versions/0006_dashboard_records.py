"""Allow "dashboard" records (each person's dashboard layout)

Revision ID: 0006
Revises: 0005
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

# Written out here, not imported from app.models (see 0002).
OLD_KINDS = ("change_request", "leave_request", "leave_day", "holiday", "payment_reminder", "target", "payment")
NEW_KINDS = OLD_KINDS + ("dashboard",)


def _one_of(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def upgrade() -> None:
    op.drop_constraint("ck_records_kind", "records", type_="check")
    op.create_check_constraint("ck_records_kind", "records", _one_of("kind", NEW_KINDS))


def downgrade() -> None:
    op.execute("DELETE FROM records WHERE kind = 'dashboard'")
    op.drop_constraint("ck_records_kind", "records", type_="check")
    op.create_check_constraint("ck_records_kind", "records", _one_of("kind", OLD_KINDS))
