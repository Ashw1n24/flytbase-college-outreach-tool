from __future__ import annotations

"""
Maps spreadsheet event names to scrape URLs and parser modules.

The targetcomp.xlsx file lists sourcing strategies but not direct URLs.
Add a row to PLATFORM_OVERRIDES — or a URL column in the spreadsheet —
to register new platforms without code changes.
"""

from models.scrape_record import ScrapeTarget

# Keys are lowercase substrings matched against spreadsheet Event Name.
PLATFORM_OVERRIDES: list[dict] = [
    {
        "match": "devfolio",
        "parser": "playwright_html",
        "competition_name": "ETHIndia",
        "category": "software",
        "urls": [
            "https://ethindia.co/projects",
            "https://devfolio.co/discover/hackathons",
        ],
        "year": 2025,
    },
    {
        "match": "google summer of code",
        "parser": "playwright_html",
        "competition_name": "Google Summer of Code",
        "category": "software",
        "urls": ["https://summerofcode.withgoogle.com/archive/2024/projects"],
        "year": 2024,
    },
    {
        "match": "gdsc",
        "parser": "gdsc",
        "competition_name": "GDSC Solution Challenge",
        "category": "software",
        "urls": [
            "https://developers.google.com/community/gdsc-solution-challenge/winners",
        ],
        "year": 2024,
    },
    {
        "match": "e-yantra",
        "parser": "e_yantra",
        "competition_name": "e-Yantra Robotics Competition",
        "category": "hardware",
        "urls": ["https://www.e-yantra.org/Theme_winners"],
        "year": 2024,
    },
    {
        "match": "smart india hackathon",
        "parser": "generic_html",
        "competition_name": "Smart India Hackathon",
        "category": "software",
        "urls": ["https://www.sih.gov.in/"],
        "year": 2024,
    },
    {
        "match": "hackerearth",
        "parser": "generic_html",
        "competition_name": "HackerEarth College Hackathons",
        "category": "software",
        "urls": ["https://www.hackerearth.com/challenges/hackathon/"],
        "year": 2024,
    },
    {
        "match": "flipkart grid",
        "parser": "generic_html",
        "competition_name": "Flipkart Grid",
        "category": "software",
        "urls": ["https://unstop.com/competitions/flipkart-grid"],
        "year": 2024,
    },
    {
        "match": "amazon ml challenge",
        "parser": "generic_html",
        "competition_name": "Amazon ML Challenge",
        "category": "software",
        "urls": ["https://unstop.com/competitions/amazon-ml-challenge"],
        "year": 2024,
    },
    {
        "match": "unstop",
        "parser": "generic_html",
        "competition_name": "Unstop Hackathons",
        "category": "software",
        "urls": ["https://unstop.com/hackathons"],
        "year": 2024,
    },
    {
        "match": "robocon",
        "parser": "generic_html",
        "competition_name": "Robocon India",
        "category": "hardware",
        "urls": ["https://roboconindia.org/"],
        "year": 2024,
    },
    {
        "match": "inter iit",
        "parser": "generic_html",
        "competition_name": "Inter IIT Tech Meet",
        "category": "hardware",
        "urls": ["https://interiit.tech/"],
        "year": 2024,
    },
    {
        "match": "conquest",
        "parser": "generic_html",
        "competition_name": "Conquest BITS Pilani",
        "category": "founders_office",
        "urls": ["https://www.conquest.org.in/"],
        "year": 2024,
    },
    {
        "match": "hult prize",
        "parser": "generic_html",
        "competition_name": "Hult Prize India",
        "category": "founders_office",
        "urls": ["https://www.hultprize.org/challenges"],
        "year": 2024,
    },
]


def resolve_targets_for_event(
    event_name: str,
    *,
    url: str | None = None,
    host: str = "",
    notes: str = "",
    category_hint: str | None = None,
) -> list[ScrapeTarget]:
    """Build scrape targets for a spreadsheet row."""
    lowered = event_name.lower()
    targets: list[ScrapeTarget] = []

    if url:
        override = next((p for p in PLATFORM_OVERRIDES if p["match"] in lowered), None)
        parser = override["parser"] if override else "generic_html"
        competition_name = override["competition_name"] if override else event_name
        category = override["category"] if override else (category_hint or "software")
        year = override["year"] if override else 2024
        targets.append(
            ScrapeTarget(
                event_name=event_name,
                url=url,
                parser=parser,
                competition_name=competition_name,
                competition_category=category,
                year=year,
                host=host,
                notes=notes,
            ),
        )
        return targets

    for entry in PLATFORM_OVERRIDES:
        if entry["match"] not in lowered:
            continue
        for scrape_url in entry["urls"]:
            targets.append(
                ScrapeTarget(
                    event_name=event_name,
                    url=scrape_url,
                    parser=entry["parser"],
                    competition_name=entry["competition_name"],
                    competition_category=entry.get("category", category_hint or "software"),
                    year=entry.get("year", 2024),
                    host=host,
                    notes=notes,
                    extra=entry.get("extra", {}),
                ),
            )
    return targets
