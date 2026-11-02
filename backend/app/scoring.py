"""Priority scoring. Mirrors the rules the UI always showed (seniority of the
job function, email quality, flagship city, multi-source) — now computed on
the server so a client can't hand-edit its own score."""

FN_TIER = {
    "Founder": 15, "Owner": 15, "Centre Director": 15, "Leasing Head": 15, "Marketing Head": 15,
    "Category Manager": 10, "Retail Ops Head": 10, "Franchise Lead": 10,
    "Mall Marketing Manager": 10, "Operations Head": 10,
    "Store Manager": 5,
}


def score_lead(lead: dict) -> tuple[int, list[str]]:
    title = lead.get("title") or ""
    tier = FN_TIER.get(title, 5)
    score = tier
    reasons = [f"{title} (+{tier})"]
    quality = lead.get("emailQuality")
    if quality == "verified":
        score += 12
        reasons.append("verified email (+12)")
    elif quality == "catchall":
        score += 4
        reasons.append("catch-all email (+4)")
    if lead.get("city") == "Bengaluru":
        score += 10
        reasons.append("flagship city (+10)")
    if lead.get("multiSource"):
        score += 5
        reasons.append("multi-source (+5)")
    return score, reasons


def band_for_score(score: int) -> str:
    if score >= 30:
        return "Hot"
    if score >= 20:
        return "Warm"
    if score >= 12:
        return "Nurture"
    return "Low"


def apply_score(lead: dict) -> dict:
    score, reasons = score_lead(lead)
    lead["score"] = score
    lead["scoreReasons"] = reasons
    lead["priorityAuto"] = band_for_score(score)
    return lead
