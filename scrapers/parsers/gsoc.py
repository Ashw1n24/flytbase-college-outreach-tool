from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from models.scrape_record import RawParticipant, ScrapeTarget
from parsers.base import BaseParser
from utils.http import fetch_html


class GSoCParser(BaseParser):
    name = "gsoc"

    INDIAN_MARKERS = (
        "iit",
        "nit",
        "bits",
        "iiit",
        "iim",
        "isb",
        "india",
        "delhi",
        "mumbai",
        "madras",
        "kanpur",
        "kharagpur",
        "pilani",
        "hyderabad",
        "bangalore",
        "smail",
        "ac.in",
    )

    def _looks_indian(self, text: str) -> bool:
        lowered = text.lower()
        return any(marker in lowered for marker in self.INDIAN_MARKERS)

    def scrape(self, target: ScrapeTarget) -> list[RawParticipant]:
        html = fetch_html(target.url)
        soup = BeautifulSoup(html, "lxml")
        results: list[RawParticipant] = []

        for link in soup.select("a[href*='/archive/']"):
            href = link.get("href", "")
            text = link.get_text(" ", strip=True)
            if not text or len(text.split()) < 2:
                continue
            if "project" not in href and "org" not in href:
                continue

            context = text
            parent = link.find_parent(["tr", "li", "div", "article"])
            if parent:
                context = parent.get_text(" ", strip=True)

            if not self._looks_indian(context):
                continue

            github_match = re.search(r"github\.com/[\w\-]+", context)
            results.append(
                RawParticipant(
                    full_name=text,
                    university=self._extract_university(context),
                    project_title=self._extract_project(parent) if parent else None,
                    placement="winner",
                    github_url=github_match.group(0) if github_match else None,
                    competition_name=target.competition_name,
                    competition_category=target.competition_category,
                    year=target.year,
                    source_url=urljoin(target.url, href),
                    ingestion_method="html_scrape",
                    platform=self.name,
                ),
            )

        # Deduplicate by name
        seen: set[str] = set()
        unique: list[RawParticipant] = []
        for row in results:
            key = row.full_name.lower()
            if key in seen:
                continue
            seen.add(key)
            unique.append(row)
        return unique

    def _extract_university(self, text: str) -> str:
        for marker in ("IIT ", "NIT ", "BITS ", "IIIT ", "IIM ", "ISB "):
            idx = text.find(marker)
            if idx >= 0:
                return text[idx : idx + 40].split("·")[0].split(",")[0].strip()
        return "Unknown"

    def _extract_project(self, node) -> str | None:
        heading = node.select_one("h2, h3, h4, strong")
        return heading.get_text(strip=True) if heading else None
