from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from models.scrape_record import RawParticipant, ScrapeTarget
from parsers.base import BaseParser
from utils.http import fetch_html, fetch_json
from utils.normalise import normalise_result_tier


class DevfolioParser(BaseParser):
    name = "devfolio"

    API_CANDIDATES = [
        "https://api.devfolio.co/v2/hackathons/{slug}/projects",
        "https://api.devfolio.co/api/hackathons/{slug}/projects",
    ]

    def _slug_from_url(self, url: str) -> str:
        path = urlparse(url).path.strip("/").split("/")
        if "hackathons" in path:
            idx = path.index("hackathons")
            return path[idx + 1]
        return path[-1]

    def _tier_from_project(self, project: dict[str, Any]) -> str:
        for key in ("winner", "won", "prize", "rank", "placement"):
            value = project.get(key)
            if isinstance(value, bool) and value:
                return "winner"
            if isinstance(value, str):
                return normalise_result_tier(value)
        return "finalist"

    def _parse_api_projects(
        self,
        payload: Any,
        target: ScrapeTarget,
    ) -> list[RawParticipant]:
        projects = payload
        if isinstance(payload, dict):
            projects = (
                payload.get("projects")
                or payload.get("data")
                or payload.get("results")
                or []
            )

        results: list[RawParticipant] = []
        for project in projects:
            if not isinstance(project, dict):
                continue
            team = project.get("team") or project.get("team_members") or []
            members = team if isinstance(team, list) else team.get("members", [])
            project_title = project.get("title") or project.get("name")
            project_url = project.get("url") or project.get("link") or target.url
            placement = self._tier_from_project(project)

            if not members:
                builder = project.get("builder") or project.get("owner")
                if isinstance(builder, dict):
                    members = [builder]

            for member in members:
                if not isinstance(member, dict):
                    continue
                name = member.get("name") or member.get("full_name")
                if not name:
                    continue
                college = (
                    member.get("college")
                    or member.get("organisation")
                    or member.get("university")
                    or "Unknown"
                )
                github = member.get("github") or member.get("github_url")
                linkedin = member.get("linkedin") or member.get("linkedin_url")
                results.append(
                    RawParticipant(
                        full_name=name,
                        university=college,
                        project_title=project_title,
                        placement=placement,
                        team_name=project.get("team_name") or project_title,
                        github_url=github,
                        linkedin_url=linkedin,
                        competition_name=target.competition_name,
                        competition_category=target.competition_category,
                        year=target.year,
                        source_url=project_url,
                        ingestion_method="api",
                        platform=self.name,
                    ),
                )
        return results

    def _parse_next_data(self, html: str, target: ScrapeTarget) -> list[RawParticipant]:
        match = re.search(
            r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
            html,
            re.DOTALL,
        )
        if not match:
            return []
        data = json.loads(match.group(1))
        projects: list[Any] = []

        def walk(node: Any) -> None:
            if isinstance(node, dict):
                if "projects" in node and isinstance(node["projects"], list):
                    projects.extend(node["projects"])
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for item in node:
                    walk(item)

        walk(data)
        return self._parse_api_projects(projects, target)

    def _parse_html_cards(self, html: str, target: ScrapeTarget) -> list[RawParticipant]:
        soup = BeautifulSoup(html, "lxml")
        results: list[RawParticipant] = []
        for card in soup.select("[class*='project'], article, .card"):
            title_el = card.select_one("h2, h3, h4, .title")
            if not title_el:
                continue
            project_title = title_el.get_text(strip=True)
            names = [
                el.get_text(strip=True)
                for el in card.select("a[href*='linkedin'], .member, .builder")
                if el.get_text(strip=True)
            ]
            if not names:
                continue
            for name in names[:6]:
                results.append(
                    RawParticipant(
                        full_name=name,
                        project_title=project_title,
                        placement="finalist",
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

    def scrape(self, target: ScrapeTarget) -> list[RawParticipant]:
        slug = target.extra.get("slug") or self._slug_from_url(target.url)

        for template in self.API_CANDIDATES:
            api_url = template.format(slug=slug)
            try:
                payload = fetch_json(api_url, params={"won": "true"})
                parsed = self._parse_api_projects(payload, target)
                if parsed:
                    return parsed
            except Exception:
                continue

        try:
            html = fetch_html(target.url)
            parsed = self._parse_next_data(html, target)
            if parsed:
                return parsed
            return self._parse_html_cards(html, target)
        except Exception:
            return []
