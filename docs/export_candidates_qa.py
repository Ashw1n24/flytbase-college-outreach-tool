import urllib.request
import urllib.error
import json
import csv
from pathlib import Path

PROJECT_ROOT = Path(r"C:\Users\Ashwin\OneDrive\Desktop\Projects\flytbase-college-outreach-tool")
ENV_PATH = PROJECT_ROOT / ".env"
OUT_PATH = PROJECT_ROOT / "docs" / "candidate-qa-review.csv"


def load_env_values(path: Path):
    result = {}
    text = path.read_text(encoding="utf-8")
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        env_key = key.strip()
        env_value = value.strip().strip("\"'")
        if env_key in {"SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"}:
            result[env_key] = env_value
    return result


env = load_env_values(ENV_PATH)
supabase_url = env.get("SUPABASE_URL", "").rstrip("/")
service_role_key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not supabase_url or not service_role_key:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")

postgrest_query = (
    "select=id,campaign_id,full_name,current_title,current_company,linkedin_url,fit_tier,fit_score,campaigns(name)"
    "&neq=fit_tier.irrelevant"
    "&order=created_at.desc"
)
url = f"{supabase_url}/rest/v1/experienced_candidates?{postgrest_query}"

req = urllib.request.Request(url, headers={
    "apikey": service_role_key,
    "Authorization": f"Bearer {service_role_key}",
    "Accept": "application/json",
}, method="GET")

try:
    with urllib.request.urlopen(req, timeout=60) as response:
        rows = json.loads(response.read().decode("utf-8"))
except urllib.error.HTTPError as http_error:
    raise SystemExit(f"HTTP error fetching candidates: {http_error} {http_error.read().decode('utf-8')}")

if not rows:
    raise SystemExit("No experienced candidates returned.")

OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
fieldnames = [
    "campaign_name",
    "candidate_name",
    "current_title",
    "current_company",
    "fit_tier",
    "fit_score",
    "linkedin_url",
    "review_notes",
]

with OUT_PATH.open("w", newline="", encoding="utf-8") as csv_file:
    writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        campaign_meta = row.get("campaigns") or {}
        campaign_name = campaign_meta.get("name", "") if isinstance(campaign_meta, dict) else ""
        fit_score = row.get("fit_score")
        if isinstance(fit_score, float):
            fit_score_text = f"{fit_score:.2f}"
        elif fit_score is not None:
            fit_score_text = str(fit_score)
        else:
            fit_score_text = ""
        candidate_name = row.get("full_name") or ""
        title = row.get("current_title") or ""
        company = row.get("current_company") or ""
        linkedin_url = row.get("linkedin_url") or ""
        review_notes = (
            f"Review candidate {candidate_name} ({title} at {company})"
            f" with fit_tier={row.get('fit_tier')} and fit_score={fit_score_text}."
            " Verify role relevance, company legitimacy, and LinkedIn profile alignment before proceeding."
        )
        writer.writerow({
            "campaign_name": campaign_name,
            "candidate_name": candidate_name,
            "current_title": title,
            "current_company": company,
            "fit_tier": row.get("fit_tier") or "",
            "fit_score": fit_score_text,
            "linkedin_url": linkedin_url,
            "review_notes": review_notes,
        })

print(f"Wrote {OUT_PATH} with {len(rows)} candidate rows.")
