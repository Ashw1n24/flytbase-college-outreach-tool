from __future__ import annotations

import re
import time

from bs4 import BeautifulSoup

from models.scrape_record import RawParticipant, ScrapeTarget
from parsers.base import BaseParser
from utils.normalise import normalise_result_tier, normalise_university

# Inter IIT roster pages are JS-rendered and sometimes slow. Original timeout
# was 60s which caused 8/40 pages to abort. Raised to 90s with 3 retries and
# exponential backoff so transient stalls don't count as failures.
PAGE_TIMEOUT_MS  = 90_000   # 90 s per page load attempt
MAX_RETRIES      = 3
BACKOFF_BASE_S   = 5        # 5 s → 10 s → 20 s between retries

_NAME_RE    = re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b")
_COLLEGE_RE = re.compile(
    r"(IIT\s+\w+|NIT\s+\w+|BITS[\s\w]*|IIIT[\s\w]+)", re.I
)


def _fetch_roster_page(browser, url: str) -> str:
    """Load a single roster page with retry + exponential backoff."""
    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            page = browser.new_page()
            page.goto(url, wait_until="networkidle", timeout=PAGE_TIMEOUT_MS)
            # Wait for at least one name/member element to appear
            try:
                page.wait_for_selector(
                    "table tr, .team-member, .member-card, li, article",
                    timeout=10_000,
                )
            except Exception:
                pass  # selector not found is fine — we'll still extract what we can
            html = page.content()
            page.close()
            return html
        except Exception as exc:
            last_exc = exc
            try:
                page.close()
            except Exception:
                pass
            if attempt < MAX_RETRIES - 1:
                delay = BACKOFF_BASE_S * (2 ** attempt)
                print(
                    f"  [interiit] Retry {attempt + 1}/{MAX_RETRIES - 1} for {url} "
                    f"(sleeping {delay}s): {exc}"
                )
                time.sleep(delay)

    raise RuntimeError(
        f"[interiit] Failed to load {url} after {MAX_RETRIES} attempts"
    ) from last_exc


def _parse_roster_html(
    html: str,
    target: ScrapeTarget,
    source_url: str,
    tier: str,
) -> list[RawParticipant]:
    soup = BeautifulSoup(html, "lxml")
    results: list[RawParticipant] = []

    # Try structured table rows first
    rows = soup.select("table tr")
    if len(rows) > 1:
        for row in rows[1:]:  # skip header
            cells = [c.get_text(" ", strip=True) for c in row.select("td")]
            text  = " | ".join(cells)
            names = _NAME_RE.findall(text)
            if not names:
                continue
            college_m = _COLLEGE_RE.search(text)
            university = normalise_university(college_m.group(1)) if college_m else "Unknown"
            team_m = re.search(r"Team[:\s]+([^|]+)", text, re.I)
            team_name = team_m.group(1).strip() if team_m else None
            for name in names[:6]:
                results.append(RawParticipant(
                    full_name=name,
                    university=university,
                    placement=tier,
                    team_name=team_name,
                    competition_name=target.competition_name,
                    competition_category=target.competition_category,
                    year=target.year,
                    source_url=source_url,
                    ingestion_method="html_scrape",
                    platform="interiit_tech",
                ))
        if results:
            return results

    # Fall back to card/list layout
    for el in soup.select(".team-member, .member-card, .participant, article, li"):
        text = el.get_text(" ", strip=True)
        if len(text) < 6:
            continue
        names = _NAME_RE.findall(text)
        if not names:
            continue
        college_m  = _COLLEGE_RE.search(text)
        university = normalise_university(college_m.group(1)) if college_m else "Unknown"
        heading    = el.select_one("h2, h3, h4, strong")
        team_name  = heading.get_text(strip=True) if heading else None
        for name in names[:6]:
            results.append(RawParticipant(
                full_name=name,
                university=university,
                placement=tier,
                team_name=team_name,
                competition_name=target.competition_name,
                competition_category=target.competition_category,
                year=target.year,
                source_url=source_url,
                ingestion_method="html_scrape",
                platform="interiit_tech",
            ))

    return results


class InterIITParser(BaseParser):
    """Scrape Inter IIT Tech Meet team-member roster pages.

    Roster pages are JS-rendered. Uses Playwright with a 90 s timeout and
    up to 3 retries per page with exponential backoff (5 s → 10 s → 20 s).
    This resolves the 8/40 timeout failures observed in the June 2026 run.

    The ScrapeTarget URL should be the event index page. The parser follows
    all links matching /team/ or /roster/ to collect individual roster pages.
    If the URL already points to a single roster page, it is scraped directly.
    """

    name = "interiit_tech"

    def scrape(self, target: ScrapeTarget) -> list[RawParticipant]:
        from playwright.sync_api import sync_playwright

        results: list[RawParticipant] = []
        timed_out = 0

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            try:
                # Discover roster sub-pages from the index, or use the URL directly
                roster_urls = self._discover_roster_urls(browser, target.url)
                print(f"  [interiit] Found {len(roster_urls)} roster page(s) to scrape")

                for url in roster_urls:
                    tier = self._tier_from_url(url)
                    try:
                        html = _fetch_roster_page(browser, url)
                        page_results = _parse_roster_html(html, target, url, tier)
                        results.extend(page_results)
                    except RuntimeError as exc:
                        timed_out += 1
                        import sys
                        print(f"  [interiit] WARNING: {exc}", file=sys.stderr)

            finally:
                browser.close()

        if timed_out:
            import sys
            print(
                f"  [interiit] {timed_out}/{len(roster_urls)} roster page(s) failed "
                "after retries — partial results returned.",
                file=sys.stderr,
            )

        return results

    def _discover_roster_urls(self, browser, index_url: str) -> list[str]:
        """Return a list of roster page URLs found on the index, or [index_url] if none."""
        try:
            html = _fetch_roster_page(browser, index_url)
        except RuntimeError:
            return [index_url]

        soup = BeautifulSoup(html, "lxml")
        base = index_url.rstrip("/")
        urls = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if re.search(r"(team|roster|member|participant)", href, re.I):
                full = href if href.startswith("http") else f"{base}/{href.lstrip('/')}"
                if full not in urls:
                    urls.append(full)

        return urls if urls else [index_url]

    @staticmethod
    def _tier_from_url(url: str) -> str:
        """Infer result tier from URL path tokens when available."""
        low = url.lower()
        if "winner" in low or "gold" in low or "first" in low:
            return "winner"
        if "runner" in low or "silver" in low or "second" in low:
            return "runner_up"
        if "third" in low or "bronze" in low:
            return "top_3"
        if "finalist" in low:
            return "finalist"
        return "participant"
