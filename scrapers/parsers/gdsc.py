from __future__ import annotations

import re

from bs4 import BeautifulSoup

from models.scrape_record import RawParticipant, ScrapeTarget
from parsers.base import BaseParser
from utils.http import fetch_html


class GDSCParser(BaseParser):
    name = "gdsc"

    def scrape(self, target: ScrapeTarget) -> list[RawParticipant]:
        html = fetch_html(target.url)
        soup = BeautifulSoup(html, "lxml")
        results: list[RawParticipant] = []

        sections = soup.select("section, article, .winner, .team, li, tr")
        for section in sections:
            text = section.get_text(" ", strip=True)
            if len(text) < 12:
                continue
            if not any(
                kw in text.lower()
                for kw in ("winner", "finalist", "team", "university", "college", "iit")
            ):
                continue

            names = re.findall(
                r"(?:Team Lead|Member|Contributor|Student)[:\s-]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
                text,
            )
            if not names:
                names = re.findall(r"\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b", text)

            university_match = re.search(
                r"(IIT\s+\w+|NIT\s+\w+|BITS\s+\w+|IIIT[\s\w]+|IIM\s+\w+)",
                text,
            )
            university = university_match.group(1) if university_match else "Unknown"
            project_title = None
            heading = section.select_one("h2, h3, h4, strong")
            if heading:
                project_title = heading.get_text(strip=True)

            placement = "winner" if "winner" in text.lower() else "finalist"

            for name in names[:8]:
                if len(name.split()) < 2:
                    continue
                results.append(
                    RawParticipant(
                        full_name=name,
                        university=university,
                        project_title=project_title,
                        placement=placement,
                        team_name=project_title,
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
            key = (row.full_name.lower(), row.university.lower())
            if key in seen:
                continue
            seen.add(key)
            unique.append(row)
        return unique
