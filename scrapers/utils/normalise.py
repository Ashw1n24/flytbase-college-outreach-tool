from __future__ import annotations

import re
from typing import Any, Optional

from models.scrape_record import RawParticipant

UNIVERSITY_ALIASES: dict[str, str] = {
    "iitb": "IIT Bombay",
    "iit-bombay": "IIT Bombay",
    "iit bombay": "IIT Bombay",
    "indian institute of technology bombay": "IIT Bombay",
    "iitd": "IIT Delhi",
    "iit delhi": "IIT Delhi",
    "iitm": "IIT Madras",
    "iit madras": "IIT Madras",
    "iitk": "IIT Kanpur",
    "iit kanpur": "IIT Kanpur",
    "iit kgp": "IIT Kharagpur",
    "iit kharagpur": "IIT Kharagpur",
    "bits pilani": "BITS Pilani",
    "bits goa": "BITS Pilani Goa",
    "nit trichy": "NIT Trichy",
    "nit surathkal": "NIT Surathkal",
    "iiit hyderabad": "IIIT Hyderabad",
    "iiit delhi": "IIIT Delhi",
    "iim ahmedabad": "IIM Ahmedabad",
    "iim bangalore": "IIM Bangalore",
    "isb": "ISB Hyderabad",
}

TIER_ALIASES: dict[str, str] = {
    "winner": "winner",
    "winners": "winner",
    "1st": "winner",
    "first": "winner",
    "gold": "winner",
    "champion": "winner",
    "runner up": "runner_up",
    "runner-up": "runner_up",
    "runners up": "runner_up",
    "2nd": "runner_up",
    "second": "runner_up",
    "silver": "runner_up",
    "top 3": "top_3",
    "top3": "top_3",
    "3rd": "top_3",
    "bronze": "top_3",
    "top 10": "top_10",
    "top10": "top_10",
    "finalist": "finalist",
    "finalists": "finalist",
    "participant": "participant",
}


def normalise_university(raw: str) -> str:
    key = raw.strip().lower()
    if not key:
        return "Unknown"
    if key in UNIVERSITY_ALIASES:
        return UNIVERSITY_ALIASES[key]
    for alias, canonical in UNIVERSITY_ALIASES.items():
        if alias in key:
            return canonical
    return raw.strip()


def normalise_result_tier(raw: str) -> str:
    key = raw.strip().lower()
    return TIER_ALIASES.get(key, "finalist")


def normalise_github_url(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    url = raw.strip()
    if url.startswith("http"):
        url = re.sub(r"^https?://(www\.)?", "", url)
    return url.rstrip("/")


def normalise_linkedin_url(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    url = raw.strip()
    if url.startswith("http"):
        url = re.sub(r"^https?://(www\.)?", "", url)
    if "linkedin.com" not in url:
        return None
    return url.rstrip("/")


def normalise_name(raw: str) -> str:
    cleaned = re.sub(r"\s+", " ", raw.strip())
    return " ".join(part.title() for part in cleaned.split(" "))


def normalise_participant(record: RawParticipant) -> dict[str, Any]:
    """
    Map a RawParticipant to Supabase-ready candidate + competition_result payloads.
    """
    return {
        "candidate": {
            "full_name": normalise_name(record.full_name),
            "university": normalise_university(record.university),
            "degree": record.degree or "B.Tech",
            "branch": record.branch or "Computer Science",
            "graduation_year": int(record.graduation_year or record.year + 1),
            "linkedin_url": normalise_linkedin_url(record.linkedin_url),
            "github_url": normalise_github_url(record.github_url),
            "email": record.email,
            "email_confidence": None,
            "source": "competition_scrape",
        },
        "competition_result": {
            "competition_name": record.competition_name,
            "competition_category": record.competition_category,
            "result_tier": normalise_result_tier(record.placement),
            "year": int(record.year),
            "team_name": record.team_name or record.project_title,
            "source_url": record.source_url or "",
            "ingestion_method": record.ingestion_method,
        },
    }
