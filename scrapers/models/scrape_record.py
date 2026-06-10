from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RawParticipant:
    """Normalized intermediate record produced by any platform parser."""

    full_name: str
    university: str = "Unknown"
    degree: str = "B.Tech"
    branch: str = "Computer Science"
    graduation_year: int = 2025
    project_title: Optional[str] = None
    placement: str = "finalist"
    team_name: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    email: Optional[str] = None
    competition_name: str = ""
    competition_category: str = "software"
    year: int = 2024
    source_url: str = ""
    ingestion_method: str = "html_scrape"
    platform: str = ""


@dataclass
class ScrapeTarget:
    """A single scrape job derived from the spreadsheet + platform registry."""

    event_name: str
    url: str
    parser: str
    competition_name: str
    competition_category: str
    year: int = 2024
    host: str = ""
    notes: str = ""
    requires_playwright: bool = False
    enabled: bool = True
    extra: dict = field(default_factory=dict)
