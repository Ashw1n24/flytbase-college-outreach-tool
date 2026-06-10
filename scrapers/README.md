# FlytBase Talent Scrapers

Python scrapers that read competition targets from `../targetcomp.xlsx`, extract participant data, and upsert into Supabase.

## Setup

```bash
cd scrapers
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
playwright install chromium   # only if a parser needs dynamic rendering
```

Ensure the root `.env` contains:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Run

```bash
# All registered platforms
python run.py

# Single event family
python run.py --event "Devfolio"

# Parse only — no database writes
python run.py --dry-run
```

Logs append to `scrapers/scraper_log.txt`.

## Adding a new platform

1. Add a row to `targetcomp.xlsx` (optional `URL` column).
2. Add an entry to `config/platform_registry.py` with:
   - `match` — substring of event name
   - `urls` — scrape endpoints
   - `parser` — `devfolio`, `gsoc`, `gdsc`, `e_yantra`, or `generic_html`
3. Re-run `python run.py`.

For bespoke HTML layouts, add a parser in `parsers/` and register it in `parsers/registry.py`.
