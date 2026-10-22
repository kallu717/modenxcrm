import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.db import Base, engine
from app.migrate import config, upgrade


def empty_database():
    Base.metadata.drop_all(engine)
    with engine.begin() as c:
        c.execute(text("DROP TABLE IF EXISTS alembic_version"))


def test_migrations_build_exactly_the_schema_the_app_expects():
    empty_database()
    upgrade()
    with engine.connect() as c:
        diff = compare_metadata(MigrationContext.configure(c), Base.metadata)
    assert diff == []
    checks = {ck["name"] for t in ("users", "leads", "records") for ck in inspect(engine).get_check_constraints(t)}
    assert {"ck_users_role", "ck_leads_stage", "ck_leads_version", "ck_records_kind"} <= checks


def test_upgrading_twice_is_harmless():
    empty_database()
    upgrade()
    upgrade()


def test_a_database_from_before_migrations_is_upgraded_in_place():
    # Tables exist (made the old way), but nothing records a schema version.
    empty_database()
    command.upgrade(config(), "0001")
    with engine.begin() as c:
        c.execute(text("DROP TABLE alembic_version"))
        c.execute(text("INSERT INTO users (email, name, role, color, created_at) VALUES ('a@b.in', 'A', 'Rep', '#000', now())"))
    upgrade()
    with engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM users")).scalar() == 1  # data kept
        assert c.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0002"


def test_the_database_refuses_an_unknown_stage_or_role():
    empty_database()
    upgrade()
    with pytest.raises(IntegrityError), engine.begin() as c:
        c.execute(text("INSERT INTO users (email, name, role, color, created_at) VALUES ('x@y.in', 'X', 'Admin', '#000', now())"))
    with pytest.raises(IntegrityError), engine.begin() as c:
        c.execute(text(
            "INSERT INTO leads (id, account, stage, version, data, created_at, updated_at) "
            "VALUES ('L1', 'A', 'maybe', 1, '{}', now(), now())"
        ))
