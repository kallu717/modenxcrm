"""REST API. Authorization lives here: the browser is never trusted to decide
what a rep may see or change."""

import hmac
from contextlib import contextmanager
import json
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth import csrf_guard, current_user
from .config import get_settings
from .db import get_db
from .models import RECORD_KINDS, STAGES as LEAD_STAGES, Lead, Record, User, lead_id_seq
from .scoring import apply_score

settings = get_settings()
router = APIRouter(prefix="/api", dependencies=[Depends(csrf_guard)])

TZ = ZoneInfo(settings.app_timezone)
VALID_TYPES = ("Brand", "Mall", "Store")
STAGES = set(LEAD_STAGES)
MAX_LEAD_BYTES = 200_000
MAX_RECORD_BYTES = 20_000
EMAIL_RE = re.compile(r"^\S+@\S+\.\S+$")

# Fields only a manager may change on an existing lead. A rep who wants one of
# these changed files a change request, which a manager approves.
REP_LOCKED = (
    "id", "name", "title", "account", "type", "email", "phone", "city",
    "assignee", "ownerSince", "createdAt", "emailQuality", "multiSource",
)


def today_iso() -> str:
    return datetime.now(TZ).date().isoformat()


def is_manager(user: User) -> bool:
    return user.role == "Manager"


def user_out(u: User) -> dict:
    return {"id": str(u.id), "name": u.name, "role": u.role, "color": u.color, "email": u.email}


def lead_out(row: Lead) -> dict:
    return {"version": row.version, "lead": row.data}


def has_markup(value) -> bool:
    """The front end builds HTML from this data, so angle brackets are refused
    at the door (a CSP already stops scripts; this stops injected markup too).
    The lasting fix is escaping at render time."""
    if not settings.reject_markup:
        return False
    if isinstance(value, str):
        return "<" in value or ">" in value
    if isinstance(value, dict):
        return any(has_markup(k) or has_markup(v) for k, v in value.items())
    if isinstance(value, list):
        return any(has_markup(v) for v in value)
    return False


def to_int(value) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- session

@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


@router.get("/users")
def users(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [user_out(u) for u in db.scalars(select(User).order_by(User.id))]


@router.get("/bootstrap")
def bootstrap(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return {
        "me": user_out(user),
        "users": [user_out(u) for u in db.scalars(select(User).order_by(User.id))],
        "leads": [lead_out(r) for r in visible_leads(db, user)],
        "records": grouped_records(db, user),
    }


# ------------------------------------------------------------------ leads

def visible_leads(db: Session, user: User) -> list[Lead]:
    q = select(Lead).order_by(Lead.id)
    if not is_manager(user):
        q = q.where(Lead.assignee_id == user.id)
    return list(db.scalars(q))


@router.get("/leads")
def list_leads(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [lead_out(r) for r in visible_leads(db, user)]


@router.get("/leads/{lead_id}")
def get_lead(lead_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = db.get(Lead, lead_id)
    if row is None or (not is_manager(user) and row.assignee_id != user.id):
        raise HTTPException(404, "lead not found")
    return lead_out(row)


class LeadPut(BaseModel):
    version: int
    lead: dict


@router.put("/leads/{lead_id}")
def put_lead(lead_id: str, body: LeadPut, db: Session = Depends(get_db), user: User = Depends(current_user)):
    renamed: dict[str, str] = {}
    with duplicate_email_is_409(db):
        row = update_lead(db, user, lead_id, body.version, body.lead, renamed)
        check_accounts(db, renamed, {row.account})
        db.commit()
    return lead_out(row)


@contextmanager
def duplicate_email_is_409(db: Session):
    """The unique email index fires on flush or commit; either way it's a 409."""
    try:
        yield
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, {"code": "duplicate_email"})


def lock_accounts(db: Session, names) -> None:
    """Serialize writers per account (case-insensitive) until this transaction
    ends, so two people can't both claim the same account at the same moment."""
    for name in sorted({n.lower() for n in names if n}):
        db.execute(select(func.pg_advisory_xact_lock(func.hashtext(name))))


def update_lead(db: Session, user: User, lead_id: str, version: int, lead: dict, renamed: dict[str, str]) -> Lead:
    """Validate and apply one lead edit without committing. Records the old
    account name in `renamed` when the account changes, for check_accounts."""
    row = db.execute(select(Lead).where(Lead.id == lead_id).with_for_update()).scalar_one_or_none()
    # 404 (not 403) for a rep touching someone else's lead: don't confirm it exists.
    if row is None or (not is_manager(user) and row.assignee_id != user.id):
        raise HTTPException(404, {"code": "not_found", "id": lead_id})
    if row.version != version:
        raise HTTPException(409, {"code": "version_conflict", **lead_out(row)})

    new, old = dict(lead), row.data
    if len(json.dumps(new)) > MAX_LEAD_BYTES:
        raise HTTPException(413, "lead too large")
    if has_markup(new):
        raise HTTPException(422, {"code": "no_markup"})
    if new.get("id") != lead_id or new.get("createdAt") != old.get("createdAt"):
        raise HTTPException(422, "id and createdAt cannot change")
    if new.get("stage") not in STAGES:
        raise HTTPException(422, "unknown stage")
    if not is_manager(user):
        locked = [k for k in REP_LOCKED if new.get(k) != old.get(k)]
        if locked:
            raise HTTPException(403, {"code": "needs_manager", "fields": locked})

    assignee_id = to_int(new.get("assignee"))
    if new.get("assignee") is not None:
        target = db.get(User, assignee_id) if assignee_id else None
        if target is None or target.role != "Rep":
            raise HTTPException(422, "a lead can only be assigned to a rep")
        new["assignee"] = str(target.id)
    else:
        assignee_id = None

    account = (new.get("account") or "").strip()
    if not account:
        raise HTTPException(422, "account name can't be empty")
    if account.lower() != row.account.lower():
        renamed[lead_id] = row.account
    new["account"] = account
    email = (new.get("email") or "").strip()
    apply_score(new)
    row.data = new
    row.account = account
    row.email_lc = email.lower() or None
    row.assignee_id = assignee_id
    row.stage = new["stage"]
    row.version += 1
    row.updated_by = user.id
    db.flush()
    return row


def check_accounts(db: Session, renamed: dict[str, str], accounts: set[str]) -> None:
    """Account rules the database can't express on its own, checked after a
    batch of edits is flushed and before it commits:
    - renaming onto a name another account already uses is refused, since it
      would merge two accounts (case-insensitive; a whole account renamed in
      one batch is fine);
    - one account, one owner: the contacts at an account never have two
      different reps (unassigned contacts don't count)."""
    lock_accounts(db, accounts)
    for lead_id in renamed:
        new_name = db.get(Lead, lead_id).account
        clash = db.scalar(
            select(Lead.id).where(func.lower(Lead.account) == new_name.lower(), Lead.id.not_in(list(renamed))).limit(1)
        )
        if clash is not None:
            raise HTTPException(409, {"code": "account_name_taken", "account": new_name})
    for name in {a.lower() for a in accounts}:
        owners = db.scalar(
            select(func.count(func.distinct(Lead.assignee_id))).where(
                func.lower(Lead.account) == name, Lead.assignee_id.is_not(None)
            )
        )
        if owners > 1:
            raise HTTPException(409, {"code": "account_has_two_owners", "account": name})


def remove_lead(db: Session, user: User, lead_id: str) -> None:
    if not is_manager(user):
        raise HTTPException(403, "managers only")
    row = db.get(Lead, lead_id)
    if row is not None:
        db.delete(row)
        db.flush()


@router.delete("/leads/{lead_id}", status_code=204)
def delete_lead(lead_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    remove_lead(db, user, lead_id)
    db.commit()


class LeadIn(BaseModel):
    name: str = ""
    title: str = ""
    account: str = ""
    type: str = ""
    email: str = ""
    verified: str = ""
    phone: str = ""
    city: str = ""
    notes: str = ""

    model_config = {"str_strip_whitespace": True, "extra": "ignore"}


class ImportIn(BaseModel):
    filename: str = "upload"
    rows: list[LeadIn] = Field(max_length=5000)


FIELD_LABELS = (("name", "Contact name"), ("title", "Job title"), ("account", "Account name"), ("type", "Account type"))


def process_rows(db: Session, user: User, rows: list[LeadIn], source: str, *, dry_run: bool, strict: bool):
    """Shared by CSV/XLSX import and the New lead form. Validates every row,
    drops duplicate emails (against the whole database, not just what this
    user can see), resolves the owning rep, and — unless dry_run — inserts."""
    issues, valid = [], []
    emails = {r.email.lower() for r in rows if r.email}
    existing_emails = set(db.scalars(select(Lead.email_lc).where(Lead.email_lc.in_(emails)))) if emails else set()
    # Accounts are matched case-insensitively: a contact joining an existing
    # account takes that account's exact name and type, so one account never
    # splits in two. Keys below are lower-cased names.
    accounts = {r.account.lower() for r in rows if r.account}
    owners: dict[str, int] = {}
    canonical: dict[str, tuple[str, str]] = {}
    if accounts and not dry_run:
        lock_accounts(db, accounts)
    if accounts:
        q = select(Lead.account, Lead.assignee_id, Lead.data["type"].astext).where(func.lower(Lead.account).in_(accounts))
        for acct, owner, acct_type in db.execute(q):
            canonical.setdefault(acct.lower(), (acct, acct_type))
            if owner is not None:
                owners.setdefault(acct.lower(), owner)
    known_accounts = set(canonical)
    seen_emails: set[str] = set()
    duplicates = 0

    for i, r in enumerate(rows):
        row_no = i + 2  # row 1 is the header
        required = list(FIELD_LABELS) + ([("email", "Email"), ("city", "City")] if strict else [])
        missing = [label for key, label in required if not getattr(r, key)]
        if missing:
            issues.append(f"Row {row_no}: missing {', '.join(missing)}")
            continue
        if has_markup(r.model_dump()):
            issues.append(f"Row {row_no}: contains < or > characters, which aren't allowed")
            continue
        if r.type not in VALID_TYPES:
            issues.append(f'Row {row_no}: account type "{r.type}" must be Brand, Mall or Store')
            continue
        if r.email and not EMAIL_RE.match(r.email):
            issues.append(f"Row {row_no}: {r.email} doesn't look like an email address")
            continue
        email_lc = r.email.lower()
        if email_lc and (email_lc in existing_emails or email_lc in seen_emails):
            duplicates += 1
            issues.append(f"Row {row_no}: {r.email} already exists — skipped")
            continue
        if email_lc:
            seen_emails.add(email_lc)
        valid.append(r)

    new_accounts = len({r.account.lower() for r in valid} - known_accounts)
    result = {
        "ready": len(valid),
        "newAccounts": new_accounts,
        "duplicates": duplicates,
        "rejected": len(issues) - duplicates,
        "issues": issues,
        "created": [],
    }
    if dry_run or not valid:
        return result

    today = today_iso()
    names = {u.id: u.name for u in db.scalars(select(User))}
    for r in valid:
        key = r.account.lower()
        # Rows earlier in this same sheet count as existing accounts too.
        account, acct_type = canonical.setdefault(key, (r.account, r.type))
        existing_owner = owners.get(key)
        assignee = existing_owner or (user.id if not is_manager(user) else None)
        if assignee is not None:
            owners.setdefault(key, assignee)
        bits = [source]
        if existing_owner and existing_owner != user.id:
            bits.append(f"Account already owned by {names.get(existing_owner, 'another rep')} — kept with them.")
        if r.notes:
            bits.append(f"Note: {r.notes}")
        n = db.execute(select(lead_id_seq.next_value())).scalar_one()
        lead = {
            "id": f"L{n:03d}",
            "name": r.name, "title": r.title, "account": account, "type": acct_type,
            "email": r.email, "phone": r.phone, "city": r.city or "—",
            "emailQuality": "none" if not r.email else ("verified" if r.verified.lower().startswith("y") else "catchall"),
            "multiSource": False,
            "stage": "new",
            "assignee": str(assignee) if assignee is not None else None,
            "ownerSince": today if assignee is not None else None,
            "priorityOverride": None, "nextFollowup": None, "meetings": [],
            "createdAt": today, "plan": None, "mandateDate": None, "wonAt": None,
            "stageHistory": [{"stage": "new", "date": today}],
            "activity": [{"who": "System", "txt": " ".join(bits), "t": "just now", "date": today, "method": None}],
        }
        apply_score(lead)
        row = Lead(id=lead["id"], account=account, email_lc=email_lc_or_none(r.email),
                   assignee_id=assignee, stage="new", version=1, data=lead, updated_by=user.id)
        db.add(row)
        result["created"].append(row)
    with duplicate_email_is_409(db):
        db.flush()
        check_accounts(db, {}, {account for account, _ in canonical.values()})
        db.commit()
    result["created"] = [lead_out(r) for r in result["created"]]
    return result


def email_lc_or_none(email: str) -> str | None:
    return email.lower() or None


@router.post("/leads/import")
def import_leads(body: ImportIn, dry_run: bool = False, db: Session = Depends(get_db), user: User = Depends(current_user)):
    res = process_rows(db, user, body.rows, f"Imported from {body.filename} by {user.name}.", dry_run=dry_run, strict=False)
    res["createdCount"] = len(res["created"])
    # A rep adding a contact to an account another rep owns doesn't get that lead back.
    res["created"] = [c for c in res["created"] if is_manager(user) or c["lead"]["assignee"] == str(user.id)]
    return res


ingest_router = APIRouter(prefix="/ingest")   # no cookies, so no CSRF header; guarded by an API key
SERVICE_EMAIL = "lead-desk-import@service.local"


def ingest_key_ok(authorization: str = Header(default="")) -> None:
    key = settings.ingest_api_key
    if not key:
        raise HTTPException(503, "ingest is not enabled (INGEST_API_KEY is empty)")
    supplied = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(supplied.encode(), key.encode()):
        raise HTTPException(401, "bad API key")


def service_user(db: Session) -> User:
    """A Manager-role account that owns machine imports, so leads arrive
    unassigned and a manager hands accounts out, same as a manager's import."""
    u = db.scalar(select(User).where(User.email == SERVICE_EMAIL))
    if u is None:
        u = User(email=SERVICE_EMAIL, name="Lead Desk import", role="Manager", color="#8f8d80")
        db.add(u)
        db.commit()
    return u


class IngestIn(ImportIn):
    source: str = "Lead Desk"


@ingest_router.post("/leads", dependencies=[Depends(ingest_key_ok)])
def ingest_leads(body: IngestIn, dry_run: bool = False, db: Session = Depends(get_db)):
    res = process_rows(db, service_user(db), body.rows, f"Pushed from {body.source} ({body.filename}).",
                       dry_run=dry_run, strict=False)
    return {
        "dryRun": dry_run,
        "created": len(res["created"]),
        "ready": res["ready"],
        "newAccounts": res["newAccounts"],
        "duplicates": res["duplicates"],
        "rejected": res["rejected"],
        "issues": res["issues"][:100],
    }


@router.post("/leads", status_code=201)
def create_lead(body: LeadIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    result = process_rows(db, user, [body], f"Added by {user.name}.", dry_run=False, strict=True)
    if not result["created"]:
        # the single row was rejected: surface why
        raise HTTPException(422, {"code": "invalid_lead", "issues": result["issues"], "duplicates": result["duplicates"]})
    return result["created"][0]


# ---------------------------------------------------------------- records

KINDS = set(RECORD_KINDS)
SHARED_READ = {"holiday", "target"}


def visible_records(db: Session, user: User, kind: str | None = None) -> list[Record]:
    q = select(Record).order_by(Record.kind, Record.id)
    if kind:
        q = q.where(Record.kind == kind)
    rows = list(db.scalars(q))
    if is_manager(user):
        return rows
    return [r for r in rows if r.kind in SHARED_READ or r.owner_id == user.id]


def grouped_records(db: Session, user: User) -> dict:
    out: dict[str, list] = {k: [] for k in KINDS}
    for r in visible_records(db, user):
        out[r.kind].append({"id": r.id, "data": r.data})
    return out


@router.get("/records")
def list_records(kind: str | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if kind and kind not in KINDS:
        raise HTTPException(404, "unknown kind")
    return [{"kind": r.kind, "id": r.id, "data": r.data} for r in visible_records(db, user, kind)]


def authorize_write(db: Session, user: User, kind: str, rid: str, existing: Record | None, data: dict) -> int | None:
    """Return the rep id that scopes this record, or raise. Managers may write
    anything valid; reps may only create their own pending requests and log
    reminders on their own leads."""
    mgr = is_manager(user)
    if kind in ("holiday", "leave_day", "target"):
        if not mgr:
            raise HTTPException(403, "managers only")
        return to_int(data.get("repId")) if kind == "leave_day" else (to_int(rid) if kind == "target" else None)

    if kind == "change_request":
        owner = to_int(data.get("requestedBy"))
        if mgr:
            if data.get("status") in ("approved", "rejected"):
                data["decidedBy"] = str(user.id)
            return owner
        if existing is not None or owner != user.id or data.get("status") != "pending":
            raise HTTPException(403, "reps may only file new pending requests for themselves")
        if data.get("scope") == "account":
            q = select(Lead.id).where(Lead.account == data.get("accountName"), Lead.assignee_id == user.id).limit(1)
        else:
            q = select(Lead.id).where(Lead.id == data.get("leadId"), Lead.assignee_id == user.id)
        if db.scalar(q) is None:
            raise HTTPException(403, "that lead or account is not assigned to you")
        return owner

    if kind == "leave_request":
        owner = to_int(data.get("repId"))
        if mgr:
            if data.get("status") in ("approved", "rejected"):
                data["decidedBy"] = str(user.id)
            return owner
        if existing is not None or owner != user.id or data.get("status") != "pending":
            raise HTTPException(403, "reps may only file new pending requests for themselves")
        return owner

    if kind == "payment_reminder":
        lead = db.get(Lead, rid)
        if lead is None or (not mgr and lead.assignee_id != user.id):
            raise HTTPException(403, "that lead is not assigned to you")
        return lead.assignee_id

    raise HTTPException(404, "unknown kind")


class RecordPut(BaseModel):
    data: dict


@router.put("/records/{kind}/{rid}")
def put_record(kind: str, rid: str, body: RecordPut, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = upsert_record(db, user, kind, rid, body.data)
    db.commit()
    return {"id": rid, "data": row.data}


def upsert_record(db: Session, user: User, kind: str, rid: str, data: dict) -> Record:
    if kind not in KINDS:
        raise HTTPException(404, "unknown kind")
    if not rid or len(rid) > 64:
        raise HTTPException(422, "bad id")
    data = dict(data)
    if len(json.dumps(data)) > MAX_RECORD_BYTES:
        raise HTTPException(413, "record too large")
    if has_markup(data):
        raise HTTPException(422, {"code": "no_markup"})
    existing = db.get(Record, (kind, rid))
    owner = authorize_write(db, user, kind, rid, existing, data)
    if existing is None:
        existing = Record(kind=kind, id=rid, owner_id=owner, data=data, updated_by=user.id)
        db.add(existing)
    else:
        existing.data, existing.owner_id, existing.updated_by = data, owner, user.id
    db.flush()
    return existing


def remove_record(db: Session, user: User, kind: str, rid: str) -> None:
    if kind not in KINDS:
        raise HTTPException(404, "unknown kind")
    if not is_manager(user):
        raise HTTPException(403, "managers only")
    row = db.get(Record, (kind, rid))
    if row is not None:
        db.delete(row)
        db.flush()


@router.delete("/records/{kind}/{rid}", status_code=204)
def delete_record(kind: str, rid: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    remove_record(db, user, kind, rid)
    db.commit()


# ------------------------------------------------------------------- sync

class RecordRef(BaseModel):
    kind: str
    id: str


class RecordIn(RecordRef):
    data: dict


class SyncIn(BaseModel):
    leads: list[LeadPut] = Field(default=[], max_length=2000)
    deleteLeads: list[str] = Field(default=[], max_length=2000)
    records: list[RecordIn] = Field(default=[], max_length=2000)
    deleteRecords: list[RecordRef] = Field(default=[], max_length=2000)


@router.post("/sync")
def sync(body: SyncIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Everything one action in the app changed, saved all-or-nothing.
    Approving an account rename, for example, touches every contact at the
    account plus the request itself; either all of it lands or none does.
    Each item goes through the same checks as the single-item endpoints."""
    renamed: dict[str, str] = {}
    accounts: set[str] = set()
    with duplicate_email_is_409(db):
        leads = []
        for item in body.leads:
            lead_id = str(item.lead.get("id", ""))
            row = update_lead(db, user, lead_id, item.version, item.lead, renamed)
            accounts.add(row.account)
            leads.append(row)
        for lead_id in body.deleteLeads:
            remove_lead(db, user, lead_id)
        records = [upsert_record(db, user, r.kind, r.id, r.data) for r in body.records]
        for r in body.deleteRecords:
            remove_record(db, user, r.kind, r.id)
        check_accounts(db, renamed, accounts)
        db.commit()
    return {
        "leads": [lead_out(r) for r in leads],
        "records": [{"kind": r.kind, "id": r.id, "data": r.data} for r in records],
    }
