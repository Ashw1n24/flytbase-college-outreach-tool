from __future__ import annotations

import re

from bs4 import BeautifulSoup

from models.scrape_record import RawParticipant, ScrapeTarget
from parsers.base import BaseParser
from utils.http import fetch_html
from utils.normalise import normalise_result_tier


class GenericHtmlParser(BaseParser):
    """Fallback parser for leaderboard / results tables on static HTML pages."""

    name = "generic_html"

    def scrape(self, target: ScrapeTarget) -> list[RawParticipant]:
        html = fetch_html(target.url)
        soup = BeautifulSoup(html, "lxml")
        results: list[RawParticipant] = []

        for row in soup.select("table tr, .leaderboard-row, .result-item, article"):
            text = row.get_text(" ", strip=True)
            if len(text) < 10:
                continue

            names = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b", text)
            if not names:
                continue

            placement = "finalist"
            for label, tier in (
                ("winner", "winner"),
                ("1st", "winner"),
                ("runner", "runner_up"),
                ("2nd", "runner_up"),
                ("top 3", "top_3"),
                ("finalist", "finalist"),
            ):
                if label in text.lower():
                    placement = tier
                    break

            university = "Unknown"
            uni_match = re.search(
                r"(IIT\s+\w+|NIT\s+\w+|BITS[\s\w]*|IIIT[\s\w]+|IIM\s+\w+)",
                text,
            )
            if uni_match:
                university = uni_match.group(1)

            project_title = None
            heading = row.select_one("h2, h3, h4, strong, .title")
            if heading:
                project_title = heading.get_text(strip=True)

            github_match = re.search(r"github\.com/[\w\-]+", text)
            linkedin_match = re.search(r"linkedin\.com/in/[\w\-]+", text)

            for name in names[:5]:
                results.append(
                    RawParticipant(
                        full_name=name,
                        university=university,
                        project_title=project_title,
                        placement=normalise_result_tier(placement),
                        team_name=project_title,
                        github_url=github_match.group(0) if github_match else None,
                        linkedin_url=linkedin_match.group(0) if linkedin_match else None,
                        competition_name=target.competition_name,
                        competition_category=target.competition_category,
                        year=target.year,
                        source_url=target.url,
                        ingestion_method="html_scrape",
                        platform=self.name,
                    ),
                )

        seen: set[str] = set()
        unique: list[RawParticipant] = []
        for row in results:
            key = row.full_name.lower()
            if key in seen:
                continue
            seen.add(key)
            unique.append(row)
        return unique
