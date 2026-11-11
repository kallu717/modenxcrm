"""Baseline: users, leads and records, as first created by the app

Revision ID: 0001
Revises:
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entra_oid", sa.String(64), unique=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("color", sa.String(9), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login", sa.DateTime(timezone=True)),
    )

    # Hands out lead numbers (L001, L002, ...), so two people adding leads at
    # once never get the same one.
    op.execute(sa.schema.CreateSequence(sa.Sequence("lead_id_seq")))

    op.create_table(
        "leads",
        sa.Column("id", sa.String(16), primary_key=True),
        sa.Column("account", sa.String(300), nullable=False),
        sa.Column("email_lc", sa.String(320)),
        sa.Column("assignee_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("stage", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("users.id")),
    )
    op.create_index("ix_leads_account", "leads", ["account"])
    op.create_index("ix_leads_assignee_id", "leads", ["assignee_id"])
    op.create_index("ix_leads_stage", "leads", ["stage"])
    # One lead per email address.
    op.create_index(
        "uq_leads_email_lc",
        "leads",
        ["email_lc"],
        unique=True,
        postgresql_where=sa.text("email_lc IS NOT NULL AND email_lc <> ''"),
    )

    op.create_table(
        "records",
        sa.Column("kind", sa.String(32), primary_key=True),
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("users.id")),
    )
    op.create_index("ix_records_owner_id", "records", ["owner_id"])


def downgrade() -> None:
    op.drop_table("records")
    op.drop_table("leads")
    op.execute(sa.schema.DropSequence(sa.Sequence("lead_id_seq")))
    op.drop_table("users")
