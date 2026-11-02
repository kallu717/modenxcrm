"""Admin and Pending roles

Revision ID: 0003
Revises: 0002
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

# Written out here, not imported from app.models (see 0002).
OLD_ROLES = ("Rep", "Manager")
NEW_ROLES = ("Pending", "Rep", "Manager", "Admin")


def _one_of(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def upgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint("ck_users_role", "users", _one_of("role", NEW_ROLES))


def downgrade() -> None:
    # Admins fall back to Manager and people waiting for access to Rep, so the
    # old rule can be put back without losing anyone.
    op.execute("UPDATE users SET role = 'Manager' WHERE role = 'Admin'")
    op.execute("UPDATE users SET role = 'Rep' WHERE role = 'Pending'")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint("ck_users_role", "users", _one_of("role", OLD_ROLES))
