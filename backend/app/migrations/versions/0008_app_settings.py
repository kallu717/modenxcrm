"""Company-wide settings an admin changes on the Settings page (first one:
whether uploaded contacts are assigned to the person uploading them).

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("value", JSONB, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
