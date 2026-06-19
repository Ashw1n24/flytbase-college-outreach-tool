from __future__ import annotations

import re
from io import BytesIO
from typing import Optional

import pdfplumber
import requests

from models.scrape_record import RawParticipant, ScrapeTarget
from parsers.base import BaseParser
from utils.normalise import normalise_result_tier, normalise_university

# Pre-2024 PDFs used a fixed 4-column table:
#   Team Name | Members | College | Result
#
# 2024 PDFs dropped the fixed table and use a 2-column layout:
#   Left cell:  team name + member names (newline-separated)
#   Right cell: college name + result tier
#
# Both layouts are handled by _extract_old and _extract_2024 respectively.
# We try old first (it has explicit column headers); if it yields nothing we
# fall back to the 2024 extractor.

_NAME_RE = re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b")
_COLLEGE_RE = re.compile(
    r"(IIT\s+\w+|NIT\s+\w+|BITS[\s\w]*|IIIT[\s\w]+|IIM\s+\w+)", re.I
)
_TIER_TOKENS = ("winner", "first", "second", "runner", "third", "finalist", "participant")


def _tier_from_text(text: str) -> str:
    low = text.lower()
    for tok in _TIER_TOKENS:
        if tok in low:
            return normalise_result_tier(tok)
    return "participant"


def _extract_old(page: pdfplumber.page.Page, target: ScrapeTarget) -> list[RawParticipant]:
    """Parse the pre-2024 4-column table layout."""
    table = page.extract_table()
    if not table or len(table[0]) < 3:
        return []

    results: list[RawParticipant] = []
    header = [str(c).lower() for c in table[0]]

    # Detect column positions by header keywords
    def col(keywords: list[str]) -> Optional[int]:
        for kw in keywords:
            for i, h in enumerate(header):
                if kw in h:
                    return i
        return None

    member_col  = col(["member", "participant", "name"])
    college_col = col(["college", "institution", "university"])
    result_col  = col(["result", "award", "prize", "tier", "position"])
    team_col    = col(["team"])

    if member_col is None:
        return []

    for row in table[1:]:
        if not row or all(c is None for c in row):
            continue
        raw_names = str(row[member_col] or "")
        raw_college = str(row[college_col] or "") if college_col is not None else ""
        raw_result  = str(row[result_col] or "")  if result_col  is not None else ""
        raw_team    = str(row[team_col]   or "")  if team_col    is not None else None

        university = normalise_university(raw_college) if raw_college.strip() else "Unknown"
        tier       = _tier_from_text(raw_result) if raw_result.strip() else "participant"

        for name in _NAME_RE.findall(raw_names):
            results.append(
                RawParticipant(
                    full_name=name,
                    university=university,
                    placement=tier,
                    team_name=raw_team,
                    competition_name=target.competition_name,
                    competition_category=target.competition_category,
                    year=target.year,
                    source_url=target.url,
                    ingestion_method="pdf_parse",
                    platform="sih_pdf",
                )
            )
    return results


def _extract_2024(page: pdfplumber.page.Page, target: ScrapeTarget) -> list[RawParticipant]:
    """Parse the 2024 2-column layout where tables are absent or malformed.

    The 2024 PDFs render each award block as free text in two columns:
      Left:   "Team: <name>\n<Member 1>\n<Member 2>..."
      Right:  "<College>\n<Result tier>"
    We extract all text words per column by splitting the page at the midpoint.
    """
    results: list[RawParticipant] = []
    width = float(page.width)
    mid   = width / 2

    left_page  = page.within_bbox((0,    0, mid,   float(page.height)))
    right_page = page.within_bbox((mid,  0, width, float(page.height)))

    left_text  = left_page.extract_text()  or ""
    right_text = right_page.extract_text() or ""

    # Split into blocks on blank lines — each block is one team entry
    left_blocks  = re.split(r"\n{2,}", left_text.strip())
    right_blocks = re.split(r"\n{2,}", right_text.strip())

    for i, left_block in enumerate(left_blocks):
        right_block = right_blocks[i] if i < len(right_blocks) else ""

        # Team name is often the first line after "Team:" or just the first line
        team_match = re.search(r"Team[:\s]+(.+)", left_block, re.I)
        team_name  = team_match.group(1).strip() if team_match else None

        names = _NAME_RE.findall(left_block)
        if not names:
            continue

        # College + tier from right column
        college_match = _COLLEGE_RE.search(right_block)
        university = normalise_university(college_match.group(1)) if college_match else "Unknown"
        tier = _tier_from_text(right_block)

        for name in names[:8]:
            results.append(
                RawParticipant(
                    full_name=name,
                    university=university,
                    placement=tier,
                    team_name=team_name,
                    competition_name=target.competition_name,
                    competition_category=target.competition_category,
                    year=target.year,
                    source_url=target.url,
                    ingestion_method="pdf_parse",
                    platform="sih_pdf",
                )
            )
    return results


class SIHPdfParser(BaseParser):
    """Parse Smart India Hackathon result PDFs.

    Handles two layouts:
      - Pre-2024: 4-column table  (Team | Members | College | Result)
      - 2024+:    2-column free text (team+members left, college+tier right)

    The URL in the ScrapeTarget should be a direct link to a PDF file.
    If the URL is an index page, set extra={"pdf_index": True} and the
    parser will follow all .pdf links on that page.
    """

    name = "sih_pdf"

    def scrape(self, target: ScrapeTarget) -> list[RawParticipant]:
        urls = self._resolve_pdf_urls(target)
        results: list[RawParticipant] = []
        failures = 0

        for url in urls:
            try:
                pdf_bytes = self._fetch_pdf(url)
                results.extend(self._parse_pdf(pdf_bytes, target._replace(url=url)))
            except Exception as exc:
                failures += 1
                # Log per-PDF failures but continue — don't abort the whole batch
                import sys
                print(f"  [sih_pdf] WARNING: failed to parse {url}: {exc}", file=sys.stderr)

        if failures:
            import sys
            print(
                f"  [sih_pdf] {failures}/{len(urls)} PDFs failed — "
                "likely Cloudflare or layout mismatch. Partial results returned.",
                file=sys.stderr,
            )
        return results

    def _resolve_pdf_urls(self, target: ScrapeTarget) -> list[str]:
        if target.extra.get("pdf_index"):
            from bs4 import BeautifulSoup
            from utils.http import fetch_html
            html = fetch_html(target.url)
            soup = BeautifulSoup(html, "lxml")
            base = target.url.rsplit("/", 1)[0]
            urls = []
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if href.lower().endswith(".pdf"):
                    urls.append(href if href.startswith("http") else f"{base}/{href.lstrip('/')}")
            return urls or [target.url]
        return [target.url]

    @staticmethod
    def _fetch_pdf(url: str) -> bytes:
        resp = requests.get(url, timeout=60, headers={
            "User-Agent": "Mozilla/5.0 (compatible; FlytBaseTalentScraper/1.0)"
        })
        resp.raise_for_status()
        return resp.content

    def _parse_pdf(self, pdf_bytes: bytes, target: ScrapeTarget) -> list[RawParticipant]:
        results: list[RawParticipant] = []
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                # Try the structured table extractor first (pre-2024 layout)
                page_results = _extract_old(page, target)
                if not page_results:
                    # Fall back to the 2024 free-text 2-column extractor
                    page_results = _extract_2024(page, target)
                results.extend(page_results)
        return results
