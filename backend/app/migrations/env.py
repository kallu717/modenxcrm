from alembic import context
from sqlalchemy import text

from app import models  # noqa: F401  (registers tables)
from app.db import Base, engine

# Any fixed number works; it just has to be the same for every copy of the API.
MIGRATION_LOCK = 72_530_001


def run() -> None:
    with engine.connect() as connection:
        # Several API copies may start together; one migrates, the rest wait
        # and then find nothing left to do.
        connection.execute(text("SELECT pg_advisory_lock(:k)"), {"k": MIGRATION_LOCK})
        try:
            context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
            with context.begin_transaction():
                context.run_migrations()
            connection.commit()
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": MIGRATION_LOCK})
            connection.commit()


run()
