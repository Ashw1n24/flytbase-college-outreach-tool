from __future__ import annotations

from difflib import SequenceMatcher
from typing import Any, Optional

from supabase import Client

from utils.normalise import normalise_name, normalise_university


class SupabaseIngestor:
    """Upsert candidates and append competition results without duplicates."""

    def __init__(self, client: Client) -> None:
        self.client = client
        self._candidate_cache: list[dict[str, Any]] | None = None

    def _load_candidates(self) -> list[dict[str, Any]]:
        if self._candidate_cache is None:
            response = (
                self.client.table("candidates")
                .select(
                    "id, full_name, university, graduation_year, github_url, linkedin_url",
                )
                .execute()
            )
            self._candidate_cache = response.data or []
        return self._candidate_cache

    def refresh_cache(self) -> None:
        self._candidate_cache = None

    @staticmethod
    def _name_similarity(a: str, b: str) -> float:
        return SequenceMatcher(None, a.lower(), b.lower()).ratio()

    def find_existing_candidate(self, candidate: dict[str, Any]) -> Optional[str]:
        """Return candidate UUID if a duplicate profile is found."""
        existing = self._load_candidates()
        def strip_proto(url: str) -> str:
            return url.lower().replace("https://", "").replace("http://", "").strip("/")

        github = strip_proto(candidate.get("github_url") or "")
        linkedin = strip_proto(candidate.get("linkedin_url") or "")
        name = normalise_name(candidate["full_name"])
        university = normalise_university(candidate["university"])
        grad_year = int(candidate.get("graduation_year") or 0)

        for row in existing:
            if github and row.get("github_url") and github == strip_proto(row["github_url"]):
                return row["id"]
            if linkedin and row.get("linkedin_url") and linkedin == strip_proto(row["linkedin_url"]):
                return row["id"]

            if (
                self._name_similarity(name, row.get("full_name", "")) >= 0.9
                and normalise_university(row.get("university", "")) == university
                and abs(int(row.get("graduation_year") or 0) - grad_year) <= 1
            ):
                return row["id"]

        return None

    def competition_exists(
        self,
        candidate_id: str,
        competition: dict[str, Any],
    ) -> bool:
        response = (
            self.client.table("competition_results")
            .select("id")
            .eq("candidate_id", candidate_id)
            .eq("competition_name", competition["competition_name"])
            .eq("year", competition["year"])
            .eq("result_tier", competition["result_tier"])
            .limit(1)
            .execute()
        )
        return bool(response.data)

    def upsert_participant(
        self,
        candidate: dict[str, Any],
        competition: dict[str, Any],
    ) -> tuple[str, bool, bool]:
        """
        Returns (candidate_id, created_candidate, created_competition).
        """
        candidate_id = self.find_existing_candidate(candidate)
        created_candidate = False
        created_competition = False

        if candidate_id:
            updates = {
                k: v
                for k, v in {
                    "linkedin_url": candidate.get("linkedin_url"),
                    "github_url": candidate.get("github_url"),
                    "email": candidate.get("email"),
                }.items()
                if v
            }
            if updates:
                self.client.table("candidates").update(updates).eq(
                    "id",
                    candidate_id,
                ).execute()
        else:
            insert = self.client.table("candidates").insert(candidate).execute()
            candidate_id = insert.data[0]["id"]
            created_candidate = True
            self._candidate_cache = None

        if not self.competition_exists(candidate_id, competition):
            payload = {"candidate_id": candidate_id, **competition}
            self.client.table("competition_results").insert(payload).execute()
            created_competition = True

        return candidate_id, created_candidate, created_competition

    def log_health(
        self,
        scraper_name: str,
        status: str,
        records_extracted: int,
        records_expected_min: int,
        error_message: str | None = None,
        source_url: str = "",
    ) -> None:
        self.client.table("scraper_health_log").insert(
            {
                "scraper_name": scraper_name,
                "status": status,
                "records_extracted": records_extracted,
                "records_expected_min": records_expected_min,
                "error_message": error_message,
                "source_url": source_url,
                "alert_sent": bool(error_message),
            },
        ).execute()
