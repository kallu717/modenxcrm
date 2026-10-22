import os

# Must be set before the app is imported. Uses a throwaway database.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://pipeline:pipeline@localhost:5433/pipeline_test"
)
os.environ["DEV_LOGIN"] = "true"
os.environ["ENV"] = "development"
os.environ["SESSION_SECRET"] = "test-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

HEADERS = {"X-Requested-With": "pipeline"}


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


def signed_in(email: str) -> TestClient:
    c = TestClient(app, headers=HEADERS)
    r = c.post("/auth/dev-login", data={"email": email}, follow_redirects=False)
    assert r.status_code == 303
    return c


@pytest.fixture
def priya():
    return signed_in("priya@dev.local")


@pytest.fixture
def arjun():
    return signed_in("arjun@dev.local")


@pytest.fixture
def meera():
    return signed_in("meera@dev.local")


ROW = {"name": "Ananya Sharma", "title": "Marketing Head", "account": "Studio Weft", "type": "Brand",
       "email": "ananya@studioweft.com", "verified": "Yes", "phone": "+91 9812345678", "city": "Bengaluru"}


def import_rows(client, rows, **params):
    return client.post("/api/leads/import", params=params, json={"filename": "t.xlsx", "rows": rows})
