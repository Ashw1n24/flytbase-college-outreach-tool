from __future__ import annotations

import re

from bs4 import BeautifulSoup

from models.scrape_record import RawParticipant, ScrapeTarget
from parsers.base import BaseParser
from utils.normalise import normalise_result_tier


class PlaywrightHtmlParser(BaseParser):
    """Render JS-heavy pages with Playwright, then extract table/card data."""

    name = "playwright_html"

    def scrape(self, target: ScrapeTarget) -> list[RawParticipant]:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(target.url, wait_until="networkidle", timeout=60_000)
            html = page.content()
            browser.close()

        soup = BeautifulSoup(html, "lxml")
        results: list[RawParticipant] = []

        for row in soup.select("table tr, article, .card, li, .project"):
            text = row.get_text(" ", strip=True)
            if len(text) < 10:
                continue
            names = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b", text)
            if not names:
                continue
            heading = row.select_one("h2, h3, h4, strong")
            project_title = heading.get_text(strip=True) if heading else None
            for name in names[:5]:
                results.append(
                    RawParticipant(
                        full_name=name,
                        project_title=project_title,
                        placement=normalise_result_tier("finalist"),
                        team_name=project_title,
                        competition_name=target.competition_name,
                        competition_category=target.competition_category,
                        year=target.year,
                        source_url=target.url,
                        ingestion_method="html_scrape",
                        platform=self.name,
                    ),
                )
        return results
