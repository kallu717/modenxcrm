"""Phone numbers are 10 digits. Mirrors lib/phone.ts: spaces, dashes, dots and
brackets are ignored, and a leading +91 / 91 or a leading 0 (as in
080 2558 8844) is dropped. What's left must be exactly 10 digits, and those
10 digits are what duplicates are matched on."""

import re

PHONE_RULE = "must be 10 digits (a +91 or leading 0 is fine)"
_ALLOWED = re.compile(r"^\+?[\d\s\-.()]+$")


def phone_digits(raw: str | None) -> str | None:
    """The 10 digits, or None when the number doesn't fit the rule."""
    s = (raw or "").strip()
    if not s or not _ALLOWED.match(s):
        return None
    d = re.sub(r"\D", "", s)
    if len(d) == 12 and d.startswith("91"):
        d = d[2:]
    elif len(d) == 11 and d.startswith("0"):
        d = d[1:]
    return d if len(d) == 10 else None
