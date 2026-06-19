#!/usr/bin/env python3
"""
FlytBase High-Agency Talent Engine — scraper runner.

Reads target platforms from ../targetcomp.xlsx, scrapes each registered URL,
normalises records, and upserts into Supabase.

Usage (from repo root):
    pip install -r scrapers/requirements.txt
    python scrapers/run.py
    python scrapers/run.py --event "Devfolio"
    python scrapers/run.py --dry-run
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRAPERS_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRAPERS_DIR.parent
sys.path.insert(0, str(SCRAPERS_DIR))

from config.platform_registry import resolve_targets_for_event  # noqa: E402
from db.ingest import SupabaseIngestor  # noqa: E402
from db.supabase_client import get_supabase_client  # noqa: E402
from loaders.spreadsheet import load_events_from_spreadsheet  # noqa: E402
from parsers.e_yantra import _SkippedError  # noqa: E402
from parsers.registry import get_parser  # noqa: E402
from utils.logger import ScraperLogger  # noqa: E402
from utils.normalise import normalise_participant  # noqa: E402

DEFAULT_SPREADSHEET = ROOT_DIR / "targetcomp.xlsx"
EXPECTED_MINIMUM = 1


def build_targets(spreadsheet: Path, event_filter: str | None) -> list:
    targets = []
    for event in load_events_from_spreadsheet(spreadsheet):
        if event_filter and event_filter.lower() not in event.event_name.lower():
            continue
        resolved = resolve_targets_for_event(
            event.event_name,
            url=event.url,
            host=event.host,
            notes=event.notes,
            category_hint=event.category,
        )
        if not resolved:
            continue
        targets.extend(resolved)
    return targets


def run_scraper(
    *,
    spreadsheet: Path,
    event_filter: str | None,
    dry_run: bool,
) -> int:
    logger = ScraperLogger()
    logger.info("Starting scraper run")

    targets = build_targets(spreadsheet, event_filter)
    if not targets:
        logger.warning("No scrape targets resolved from spreadsheet/registry")
        return 1

    client = None if dry_run else get_supabase_client()
    ingestor = SupabaseIngestor(client) if client else None

    total_candidates = 0
    total_competitions = 0
    failures = 0

    for target in targets:
        parser = get_parser(target.parser)
        scraper_name = f"{target.parser}:{target.event_name}"
        logger.info(f"Scraping {target.event_name} -> {target.url} [{target.parser}]")

        try:
            participants = parser.scrape(target)
            logger.info(f"Extracted {len(participants)} participant rows from {target.url}")

            if not dry_run and ingestor:
                if len(participants) < EXPECTED_MINIMUM:
                    ingestor.log_health(
                        scraper_name,
                        "degraded",
                        len(participants),
                        EXPECTED_MINIMUM,
                        error_message=(
                            f"Extracted {len(participants)} records, expected >= {EXPECTED_MINIMUM}"
                        ),
                        source_url=target.url,
                    )
                    logger.warning(
                        f"Degraded: only {len(participants)} records for {target.event_name}",
                    )
                else:
                    ingestor.log_health(
                        scraper_name,
                        "ok",
                        len(participants),
                        EXPECTED_MINIMUM,
                        source_url=target.url,
                    )

            for raw in participants:
                payload = normalise_participant(raw)
                if dry_run:
                    logger.info(
                        f"[dry-run] {payload['candidate']['full_name']} — "
                        f"{payload['competition_result']['competition_name']} "
                        f"({payload['competition_result']['result_tier']})",
                    )
                    continue

                _, created_candidate, created_competition = ingestor.upsert_participant(
                    payload["candidate"],
                    payload["competition_result"],
                )
                total_candidates += int(created_candidate)
                total_competitions += int(created_competition)

        except _SkippedError as exc:
            # Scraper voluntarily disabled (e.g. SKIP_E_YANTRA=true).
            # Log as "skipped" so the health dashboard shows a warning, not an alert.
            logger.warning(f"Skipped {target.event_name}: {exc}")
            if not dry_run and ingestor:
                ingestor.log_health(
                    scraper_name,
                    "skipped",
                    0,
                    EXPECTED_MINIMUM,
                    error_message=str(exc),
                    source_url=target.url,
                )

        except Exception as exc:
            failures += 1
            logger.error(
                f"Failed to scrape {target.event_name} ({target.url}): {exc}",
                exc=exc,
            )
            if not dry_run and ingestor:
                ingestor.log_health(
                    scraper_name,
                    "failed",
                    0,
                    EXPECTED_MINIMUM,
                    error_message=str(exc),
                    source_url=target.url,
                )

    logger.info(
        f"Run complete — new candidates: {total_candidates}, "
        f"new competition rows: {total_competitions}, failures: {failures}",
    )
    return 0 if failures == 0 else 2


def main() -> None:
    parser = argparse.ArgumentParser(description="FlytBase competition scraper")
    parser.add_argument(
        "--spreadsheet",
        type=Path,
        default=DEFAULT_SPREADSHEET,
        help="Path to targetcomp.xlsx",
    )
    parser.add_argument(
        "--event",
        type=str,
        default=None,
        help="Only scrape events whose name contains this substring",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scrape and log without writing to Supabase",
    )
    args = parser.parse_args()

    if not args.spreadsheet.exists():
        print(f"Spreadsheet not found: {args.spreadsheet}", file=sys.stderr)
        sys.exit(1)

    code = run_scraper(
        spreadsheet=args.spreadsheet,
        event_filter=args.event,
        dry_run=args.dry_run,
    )
    sys.exit(code)


if __name__ == "__main__":
    main()
