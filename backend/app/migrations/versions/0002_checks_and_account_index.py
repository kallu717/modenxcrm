"""Database checks for stages, roles and record kinds; case-insensitive account index

Revision ID: 0002
Revises: 0001
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# Written out here, not imported from app.models: a migration must keep doing
# exactly what it did when it was written, even after the models change.
ROLES = ("Rep", "Manager")
STAGES = ("new", "contacted", "qualified", "unqualified", "proposal", "won", "lost")
RECORD_KINDS = ("change_request", "leave_request", "leave_day", "holiday", "payment_reminder", "target")


def _one_of(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def upgrade() -> None:
    op.create_index("ix_leads_account_lc", "leads", [sa.literal_column("lower(account)")])
    op.create_check_constraint("ck_users_role", "users", _one_of("role", ROLES))
    op.create_check_constraint("ck_leads_stage", "leads", _one_of("stage", STAGES))
    op.create_check_constraint("ck_leads_version", "leads", "version >= 1")
    op.create_check_constraint("ck_records_kind", "records", _one_of("kind", RECORD_KINDS))


def downgrade() -> None:
    op.drop_constraint("ck_records_kind", "records", type_="check")
    op.drop_constraint("ck_leads_version", "leads", type_="check")
    op.drop_constraint("ck_leads_stage", "leads", type_="check")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_index("ix_leads_account_lc", table_name="leads")
