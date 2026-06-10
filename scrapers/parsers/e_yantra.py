from __future__ import annotations

import re

from bs4 import BeautifulSoup

from models.scrape_record import RawParticipant, ScrapeTarget
from parsers.base import BaseParser
from utils.http import fetch_html
from utils.normalise import normalise_result_tier


class EYantraParser(BaseParser):
    name = "e_yantra"

    def scrape(self, target: ScrapeTarget) -> list[RawParticipant]:
        html = fetch_html(target.url)
        soup = BeautifulSoup(html, "lxml")
        results: list[RawParticipant] = []

        rows = soup.select("table tr, .result-row, .winner-row, li")
        for row in rows:
            cells = [c.get_text(" ", strip=True) for c in row.select("td, th, span, p")]
            text = " | ".join(cells) if cells else row.get_text(" ", strip=True)
            if len(text) < 8:
                continue

            names = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b", text)
            if not names:
                continue

            tier_raw = "finalist"
            for token in ("Winner", "First", "Second", "Third", "Finalist"):
                if token.lower() in text.lower():
                    tier_raw = token
                    break

            college_match = re.search(
                r"(IIT\s+\w+|NIT\s+\w+|BITS[\s\w]*|IIIT[\s\w]+)",
                text,
            )
            university = college_match.group(1) if college_match else "Unknown"
            team_match = re.search(r"Team[:\s]+([^|]+)", text, re.I)
            team_name = team_match.group(1).strip() if team_match else None

            for name in names[:6]:
                results.append(
                    RawParticipant(
                        full_name=name,
                        university=university,
                        placement=normalise_result_tier(tier_raw),
                        team_name=team_name,
                        competition_name=target.competition_name,
                        competition_category=target.competition_category,
                        year=target.year,
                        source_url=target.url,
                        ingestion_method="html_scrape",
                        platform=self.name,
                    ),
                )

        return results
