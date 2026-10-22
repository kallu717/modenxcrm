"""Sign-in. Azure Entra ID (OpenID Connect, authorization-code flow) in
production; an optional DEV_LOGIN pick-list for local development only.

Roles are decided here, at login, from configuration — never from anything
the browser sends: a user is a Manager if their email is in MANAGER_EMAILS or
their token carries the MANAGER_GROUP_ID group; everyone else is a Rep."""

import logging
from datetime import datetime, timezone

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import User

log = logging.getLogger("pipeline.auth")
settings = get_settings()
router = APIRouter()

PALETTE = ["#1f6f5c", "#b9791a", "#c23b3b", "#3b6fc2", "#8b5fbf", "#2a8f9d", "#a14b7a", "#5c7a1f"]

oauth = OAuth()
if settings.azure_configured:
    oauth.register(
        name="entra",
        client_id=settings.azure_client_id,
        client_secret=settings.azure_client_secret,
        server_metadata_url=(
            f"https://login.microsoftonline.com/{settings.azure_tenant_id}"
            "/v2.0/.well-known/openid-configuration"
        ),
        client_kwargs={"scope": "openid profile email"},
    )

DEV_USERS = [
    ("priya@dev.local", "Priya Nair", "Rep"),
    ("arjun@dev.local", "Arjun Mehta", "Rep"),
    ("meera@dev.local", "Meera Iyer", "Manager"),
]


def role_for(email: str, groups: list[str] | None) -> str:
    if email.lower() in settings.manager_email_set:
        return "Manager"
    if settings.manager_group_id and settings.manager_group_id in (groups or []):
        return "Manager"
    return "Rep"


def upsert_user(db: Session, *, email: str, name: str, role: str, oid: str | None = None) -> User:
    """Find the user by Entra object id, then by email; create on first login.
    Role is refreshed on every login so a promotion or removal takes effect."""
    email = email.strip().lower()
    user = None
    if oid:
        user = db.scalar(select(User).where(User.entra_oid == oid))
    if user is None:
        user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None:
        user = User(email=email, name=name or email, role=role, color=PALETTE[0], entra_oid=oid)
        db.add(user)
        db.flush()
        user.color = PALETTE[user.id % len(PALETTE)]
    else:
        user.role = role
        user.name = name or user.name
        if oid and not user.entra_oid:
            user.entra_oid = oid
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    return user


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    uid = request.session.get("uid")
    user = db.get(User, uid) if uid else None
    if user is None:
        raise HTTPException(status_code=401, detail="not signed in")
    return user


def csrf_guard(request: Request) -> None:
    """Cookie auth + JSON API: besides SameSite=Lax, every state-changing call
    must carry a header a cross-site form post cannot set."""
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("x-requested-with") != "pipeline":
        raise HTTPException(status_code=403, detail="missing X-Requested-With header")


@router.get("/auth/login")
async def login(request: Request):
    if settings.azure_configured:
        return await oauth.entra.authorize_redirect(request, f"{settings.base_url}/auth/callback")
    if settings.dev_login:
        return RedirectResponse("/auth/dev")
    return HTMLResponse("Sign-in is not configured. Ask an administrator to set the Azure Entra ID settings.", status_code=503)


@router.get("/auth/callback")
async def callback(request: Request, db: Session = Depends(get_db)):
    if not settings.azure_configured:
        raise HTTPException(404)
    try:
        token = await oauth.entra.authorize_access_token(request)
    except Exception:
        log.exception("Entra token exchange failed")
        return HTMLResponse("Sign-in failed. <a href='/auth/login'>Try again</a>.", status_code=400)
    claims = token.get("userinfo") or {}
    if claims.get("tid") and claims["tid"] != settings.azure_tenant_id:
        raise HTTPException(403, "wrong tenant")
    email = claims.get("email") or claims.get("preferred_username") or ""
    if "@" not in email:
        raise HTTPException(403, "no email on the sign-in token")
    if "groups" not in claims and "groups" in (claims.get("_claim_names") or {}):
        log.warning("Group overage for %s: group claim not in token; role falls back to MANAGER_EMAILS", email)
    user = upsert_user(
        db,
        email=email,
        name=claims.get("name") or email,
        role=role_for(email, claims.get("groups")),
        oid=claims.get("oid"),
    )
    request.session.clear()
    request.session["uid"] = user.id
    return RedirectResponse("/")


@router.get("/auth/logout")
def logout(request: Request):
    request.session.clear()
    return HTMLResponse("<p style='font:15px system-ui;margin:3rem'>Signed out. <a href='/auth/login'>Sign in again</a></p>")


# ---- local development only ----

@router.get("/auth/dev")
def dev_page():
    if not settings.dev_login:
        raise HTTPException(404)
    buttons = "".join(
        f"<form method='post' action='/auth/dev-login' style='margin:8px 0'>"
        f"<input type='hidden' name='email' value='{e}'>"
        f"<button style='font:14px system-ui;padding:8px 14px'>{n} &middot; {r}</button></form>"
        for e, n, r in DEV_USERS
    )
    return HTMLResponse(
        "<div style='font:14px system-ui;margin:3rem'><h3>Development sign-in</h3>"
        "<p>DEV_LOGIN is on. This page does not exist in production.</p>" + buttons + "</div>"
    )


@router.post("/auth/dev-login")
async def dev_login(request: Request, db: Session = Depends(get_db)):
    if not settings.dev_login:
        raise HTTPException(404)
    form = await request.form()
    email = str(form.get("email", "")).lower()
    match = next((u for u in DEV_USERS if u[0] == email), None)
    if match is None:
        raise HTTPException(400, "unknown dev user")
    user = upsert_user(db, email=match[0], name=match[1], role=match[2])
    request.session.clear()
    request.session["uid"] = user.id
    return RedirectResponse("/", status_code=303)
