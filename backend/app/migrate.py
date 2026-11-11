"""Database schema management (Alembic).

The tables are created and upgraded by numbered scripts in app/migrations/
versions, never by hand. The API runs them when it starts (AUTO_MIGRATE=true,
the default); several copies starting at once are safe because only one holds
the migration lock at a time. Devops can also run them as a separate step:

    python -m app.migrate                     # bring the database up to date
    python -m app.migrate current             # show which version it is on
    python -m app.migrate revision "message"  # developers: draft a new script
"""

import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from .db import engine

MIGRATIONS = Path(__file__).parent / "migrations"
# The schema as it was before migrations existed (tables made by create_all).
BASELINE = "0001"


def config() -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS))
    return cfg


def upgrade() -> None:
    cfg = config()
    tables = set(inspect(engine).get_table_names())
    # A database created before migrations existed already has the baseline
    # tables: record that, then apply only what came after.
    if "leads" in tables and "alembic_version" not in tables:
        command.stamp(cfg, BASELINE)
    command.upgrade(cfg, "head")


def main(argv: list[str]) -> None:
    if not argv or argv[0] == "upgrade":
        upgrade()
    elif argv[0] == "current":
        command.current(config(), verbose=True)
    elif argv[0] == "revision" and len(argv) == 2:
        command.revision(config(), message=argv[1], autogenerate=True)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
