from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from . import models  # noqa: F401  (registers tables)
from .api import ingest_router, router as api_router
from .auth import router as auth_router
from .config import get_settings
from .db import Base, engine

settings = get_settings()
settings.check_production_safety()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="ModenX CRM API", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    same_site="lax",
    https_only=settings.cookie_secure,
    max_age=8 * 3600,
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    return response


app.include_router(auth_router)
app.include_router(api_router)
app.include_router(ingest_router)


@app.get("/healthz")
def healthz():
    return {"ok": True}


# Normally the front end is served by the reverse proxy next to this API. For a
# quick single-process run, point FRONTEND_DIR at a static build (e.g. Next's
# `out/` folder). Mounted last so it never shadows /api, /auth or /ingest.
if settings.frontend_dir and Path(settings.frontend_dir).is_dir():
    app.mount("/", StaticFiles(directory=settings.frontend_dir, html=True), name="frontend")
