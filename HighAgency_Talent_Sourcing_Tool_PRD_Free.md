# PRD — High-Agency Talent Sourcing Engine
## FlytBase Internal Hiring Tool · v1.2 (Zero-Cost Architecture)

**Document type:** Internal Tool PRD — MVP scoped for FlytBase hiring team  
**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (free tier) + Python scraping layer  
**Scope:** Full-stack search and filtering engine for sourcing high-agency students and recent graduates from Tier 1 Indian engineering and business schools  
**Cost ceiling:** $0/month hard limit — system must never incur any paid service charges

---

## 1. Context & Current State

### The Problem

FlytBase's hiring team needs to source a very specific kind of candidate: high-agency students and recent graduates (0–2 years of experience) from Tier 1 institutions who have demonstrably *done things* — won competitions, built hardware, shipped software, led organisations. This is a fundamentally different profile from what standard recruiting tools surface.

**The current workflow looks like this:**

- Manually searching LinkedIn with keyword hacks ("Smart India Hackathon" OR "e-Yantra") — returns stale, incomplete, and unstructured data
- Browsing Devfolio / Unstop / competition result PDFs individually to find winner names, then separately trying to find their contact info
- Googling college fest websites to identify who held student body positions — then again, separately hunting for contact details
- Building ad-hoc spreadsheets that go stale and are not searchable or filterable

This workflow is slow, not repeatable, and entirely dependent on the recruiter's knowledge of which competitions matter. There is no single interface where FlytBase can say: *"Show me students from IIT Bombay or IIT Delhi who won a hardware hackathon in the last 2 years and also held a technical PoR in their department."*

### Why existing tools don't solve this

| Tool | What it does | Why it fails here |
|---|---|---|
| LinkedIn Recruiter | Filters by title, company, school | No competition win data; students have thin profiles |
| Apollo.io / Hunter.io | Email discovery, company-based search | B2B sales tool; no concept of competitions or PoRs |
| Unstop / Dare2Compete | Lists competitions and participants | No cross-competition search; no contact export |
| Naukri / Internshala | Freshers job boards | Passive candidates; no signal of agency or achievement |

The gap is structural: no tool in this space models **proof of work** as a first-class filter. This PRD specifies a tool that does exactly that.

---

## 2. Feature Overview — The High-Agency Sourcing Engine

### Concept

A private, internal search engine for FlytBase's hiring team. The recruiter types into a single interface, applies layered filters, and gets back a ranked, contact-enriched list of students who have demonstrably shipped things. Think of it as a CRM for candidates who haven't applied yet — discovered entirely through their public proof of work.

### Why this framing works for FlytBase's hiring

- FlytBase builds autonomous drone systems — the candidates they want are builders, not just learners
- A student who won Robocon India or placed in Inter IIT Tech Meet has already proven they can execute under constraints
- A student who ran their college's technical committee has proven they can own something end-to-end
- These signals are *publicly available* — they just aren't aggregated anywhere, which is the entire value this tool creates

### Primary User

**FlytBase Hiring Team** (1–3 people using this tool internally). Their primary workflows are:

1. **Discovery:** "Find me candidates for [role]" — running filtered searches against the database
2. **Pipeline Building:** Saving shortlisted candidates to a named pipeline and exporting contact info
3. **Maintenance:** Responding to scraper health alerts, pasting them into Claude to get a fix, and redeploying — the only non-automated step in the system

---

## 3. Cost Budget

The system operates at exactly $0/month. Every service in the stack uses a free tier or is open-source with no usage-based billing. No paid service may be introduced without explicit sign-off from the team.

| Service | Plan | Monthly Cost | Purpose |
|---|---|---|---|
| GitHub REST API | Free (with PAT) | $0 | Primary email enrichment — profile email + commit-level email mining — 5,000 req/hour |
| `duckduckgo_search` library | Free (no API key) | $0 | LinkedIn profile URL discovery via DuckDuckGo SERP scraping — staggered, ~200 lookups/day |
| Supabase | Free tier | $0 | PostgreSQL database — 500MB storage, sufficient for ~20k rows |
| Vercel | Free tier | $0 | Next.js frontend hosting |
| GitHub Actions | Free tier | $0 | Scheduled scrape runs — 2,000 minutes/month |
| Gmail SMTP | Free | $0 | Scraper health alert emails |
| **Total** | | **$0/month** | Zero ongoing infrastructure cost |

**Free tier guardrails:** Two independent counters enforce the limits of the two rate-sensitive services:

- **DuckDuckGo daily counter** — a `rate_limit_log` row in Supabase tracks daily DuckDuckGo lookup count per calendar day. If the counter reaches 180 lookups (90% of the conservative 200/day ceiling), all remaining DuckDuckGo calls for that day are deferred to the next run. A budget alert email is sent.
- **GitHub API headroom check** — at the start of every scrape run, a call to `https://api.github.com/rate_limit` checks remaining hourly quota. If under 500 requests remain, GitHub-heavy enrichment steps are paused until the quota resets. This is defensive only — at the projected database scale of ~5,000 candidates, the 5,000 req/hour limit is never a practical constraint.

---

## 4. Data Model & Candidate Profile Schema

Before specifying features, the data model must be defined. Every UI filter maps directly to a column or relation in this schema.

### 4.1 Core `candidates` table

```typescript
interface Candidate {
  id: string;                         // UUID, primary key
  full_name: string;
  university: string;                 // Normalised name — see §8.3
  degree: string;                     // "B.Tech" | "MBA" | "B.E." | "Dual Degree" | etc.
  branch: string;                     // "Computer Science" | "Electrical" | "Mechanical" | etc.
  graduation_year: number;            // e.g. 2025
  linkedin_url: string | null;
  email: string | null;
  email_confidence: "github_profile" | "github_commit" | "inferred" | null;
  github_url: string | null;
  source: "competition_scrape" | "manual";
  created_at: timestamp;
  last_updated: timestamp;
}
```

> **Schema change from v1.1:** `email_confidence` now distinguishes between `"github_profile"` (email publicly set on GitHub profile — highest confidence), `"github_commit"` (email extracted from public commit history — high confidence, but may be a work/university address), and `"inferred"` (pattern-matched from institute email format — lower confidence, verify before outreach). The `"github"` value from v1.1 is retired.

### 4.2 `competition_results` table

```typescript
interface CompetitionResult {
  id: string;
  candidate_id: string;               // FK → candidates.id
  competition_name: string;           // Normalised — see §8.4
  competition_category: "hardware" | "software" | "founders_office" | "product_gtm";
  result_tier: "winner" | "runner_up" | "top_3" | "top_10" | "finalist" | "participant";
  year: number;
  team_name: string | null;
  source_url: string;                 // Original scraped URL — for auditability
  ingestion_method: "api" | "html_scrape" | "pdf_parse" | "manual";
}
```

### 4.3 `positions_of_responsibility` table

```typescript
interface PositionOfResponsibility {
  id: string;
  candidate_id: string;               // FK → candidates.id
  organisation_name: string;
  role_title: string;
  por_category: "ecell" | "technical_committee" | "cultural_fest" | "student_body" | "sports";
  institution: string;
  year_start: number;
  year_end: number | null;
  source_url: string;
  ingestion_method: "api" | "html_scrape" | "manual";
}
```

### 4.4 `pipelines` table

```typescript
interface Pipeline {
  id: string;
  name: string;
  created_by: string;
  candidate_ids: string[];
  created_at: timestamp;
  notes: string | null;
}
```

### 4.5 `scraper_health_log` table

```typescript
// Written after every scraper run — powers the health dashboard and alert system
interface ScraperHealthLog {
  id: string;
  scraper_name: string;               // e.g. "devfolio", "sih_pdf", "e_yantra"
  run_at: timestamp;
  status: "ok" | "degraded" | "failed";
  records_extracted: number;
  records_expected_min: number;
  error_message: string | null;       // Full Python traceback if failed
  source_url: string;
  alert_sent: boolean;
}
```

### 4.6 `duplicate_review_queue` table

```typescript
interface DuplicatePair {
  id: string;
  candidate_id_a: string;
  candidate_id_b: string;
  match_signals: string[];            // e.g. ["name:1.0", "university:match", "year:match"]
  conflict_signals: string[];         // e.g. ["branch: CS vs Mechanical"]
  auto_merge_blocked_reason: string;  // Why this wasn't auto-merged
  status: "pending" | "merged" | "dismissed";
  reviewed_at: timestamp | null;
}
```

### 4.7 `rate_limit_log` table

```typescript
// Tracks daily consumption of rate-sensitive free services — new in v1.2
interface RateLimitLog {
  id: string;
  service: "duckduckgo" | "github";
  date: string;                       // ISO date: "2025-04-14"
  requests_made: number;
  daily_ceiling: number;              // 180 for DDG, 4500 for GitHub
  ceiling_hit: boolean;
  last_updated: timestamp;
}
```

---

## 5. Filter Architecture — The Three Filter Layers

### 5.1 Layer 1 — Standard Filters

| Filter | UI Component | Behaviour |
|---|---|---|
| **Name** | Text input, debounced 300ms | Full-text search on `candidates.full_name` — case-insensitive, partial match |
| **University** | Multi-select dropdown | Values from `UNIVERSITIES` constant (§8.3). Multiple = OR logic |
| **Graduation Year** | Range slider | Default: current year − 2 → current year + 1 |
| **Degree Type** | Checkbox group | B.Tech, B.E., Dual Degree, MBA, M.Tech — OR logic |
| **Branch / Domain** | Multi-select dropdown | CS/IT, Electrical/Electronics, Mechanical, Aerospace, Civil, Management |

### 5.2 Layer 2 — The Builder Filter

**Parent toggle:** "Has competed in at least one tracked competition"

| Filter | UI Component | Behaviour |
|---|---|---|
| **Category** | Tab selector | Hardware / Software / Founders Office / Product GTM — multiple active simultaneously |
| **Specific Competition** | Multi-select grouped dropdown | Full list from §8.4 |
| **Result Tier** | Checkbox group with hierarchy | Selecting "Top 3" includes Winner + Runner-Up + Top 3 automatically |
| **Year Range** | Dual-handle slider | Filters `competition_results.year` |

**Result tier hierarchy logic:**

```typescript
const RESULT_TIER_HIERARCHY = ["winner", "runner_up", "top_3", "top_10", "finalist", "participant"];

function getIncludedTiers(selectedTier: string): string[] {
  const idx = RESULT_TIER_HIERARCHY.indexOf(selectedTier);
  return RESULT_TIER_HIERARCHY.slice(0, idx + 1);
}
```

### 5.3 Layer 3 — The Agency Filter

**Parent toggle:** "Has held at least one tracked PoR"

| Filter | UI Component | Behaviour |
|---|---|---|
| **PoR Category** | Checkbox group | E-Cell · Technical Committee · Cultural Fest Core · Student Government · Sports |
| **Organisation Name** | Multi-select searchable | Specific orgs e.g. "Shaastra Core Team", "GDSC Lead" |
| **Leadership Level** | Toggle | "Any Role" / "Core / Head / Lead only" — filters title keywords: Head, Lead, Core, Director, President, Secretary |
| **Year Active** | Year range slider | `por.year_start <= year AND (por.year_end IS NULL OR por.year_end >= year)` |

### 5.4 Filter combination logic

Layers combine with **AND**. Within each layer, multi-selects use **OR**.

```
University IN ("IIT Bombay", "IIT Delhi")       — OR within filter
AND graduation_year BETWEEN 2024 AND 2026
AND competition_category = "hardware"
AND result_tier IN ("winner", "runner_up")       — OR within filter
AND por_category = "technical_committee"
```

---

## 6. The Search Interface — Full UI Spec

### 6.1 Overall layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔍  High-Agency Talent Engine   [Pipelines ▼] [Health ⚡] [Admin ⚙]│
├───────────────┬─────────────────────────────────────────────────────┤
│               │                                                     │
│  FILTER PANEL │   RESULTS PANEL                                     │
│   (320px)     │   (flex-fill)                                       │
│               │                                                     │
│  ─ Standard ─ │  Showing 142 candidates   [Sort ▼]  [Export CSV]   │
│  Name         │                                                     │
│  University   │  ┌──────────────────────────────────────────────┐  │
│  Grad Year    │  │  Candidate Card × N                          │  │
│  Degree       │  └──────────────────────────────────────────────┘  │
│  Branch       │                                                     │
│  ─ Builder ─  │                                                     │
│  Category     │                                                     │
│  Competition  │                                                     │
│  Result Tier  │                                                     │
│  Year Range   │                                                     │
│  ─ Agency ─   │                                                     │
│  PoR Category │                                                     │
│  Organisation │                                                     │
│  Level        │                                                     │
│  Year Active  │                                                     │
│               │                                                     │
│  [Clear All]  │                                                     │
└───────────────┴─────────────────────────────────────────────────────┘
```

**Filter panel behaviour:**
- Sticky on scroll
- Each group is a collapsible accordion with an active-filter count badge: e.g. `Builder Filter (2)`
- On mobile: filter panel collapses into a bottom sheet

### 6.2 Health indicator in top nav

The top nav includes a **[Health ⚡]** button. Its state communicates scraper system status at a glance without requiring the recruiter to visit the Admin panel.

```
[Health ✅]  — all scrapers ran successfully in the last 7 days
[Health ⚠️]  — one or more scrapers in "degraded" state (extracted fewer records than expected)
[Health 🔴]  — one or more scrapers in "failed" state (exception thrown, zero records extracted)
```

Clicking the button opens the Health Dashboard (§6.6). The indicator is visible at all times — a recruiter noticing a red indicator is the first step in the maintenance loop (see §8.2).

### 6.3 Candidate Card component

```
┌──────────────────────────────────────────────────────────────────┐
│  Arjun Mehta                                    [+ Add to Pipeline]│
│  IIT Bombay · B.Tech Computer Science · Class of 2025             │
│                                                                  │
│  🏆  SIH Hardware Winner 2023 · e-Yantra Finalist 2022           │
│  👤  Technical Secretary, Techfest IIT Bombay 2023–24            │
│                                                                  │
│  🔗 linkedin.com/in/arjunmehta   📧 arjun@gmail.com  [github]   │
└──────────────────────────────────────────────────────────────────┘
```

**Card anatomy:**
- Competition badges colour-coded by category: Hardware `bg-orange-100`, Software `bg-blue-100`, Founders/GTM `bg-purple-100`
- Result tier prefix: 🏆 Winner · 🥈 Runner-Up · ⭐ Top 3 · Finalist (no icon)
- PoR badge: `bg-green-100 text-green-800`
- Email confidence label: `[github profile]` = email set on GitHub profile (highest confidence), `[github commit]` = extracted from public commit history (high confidence), `[inferred]` = pattern-matched from institute email format (lower confidence — verify before outreach)
- No email shown and no placeholder invented if none was found
- **"+ Add to Pipeline"** triggers on-demand GitHub enrichment if email is null — see §8.2.4
- Virtual list rendering (`react-virtual`) — handles 10k+ results

**Card states:**
- `default`: `border border-gray-200 rounded-lg shadow-sm`
- `hover`: `shadow-md border-gray-300 cursor-pointer`
- `in-pipeline`: `border-l-4 border-l-green-500`
- `selected`: `bg-blue-50 border-blue-300`

### 6.4 Candidate Detail Drawer

Right-side drawer (480px, `fixed right-0 top-0 h-full`), 250ms slide animation, ESC to close.

```
┌──────────────────────────────────────┐
│  ← Back          [+ Add to Pipeline] │
│  Arjun Mehta                         │
│  IIT Bombay · CS · 2025              │
│  ─────────────────────────────       │
│  COMPETITION HISTORY                 │
│  ┌─────────────────────────────┐     │
│  │ 🏆 SIH Hardware · Winner    │     │
│  │     2023 · Team: ByteForge  │     │
│  │     [View Source ↗]         │     │
│  └─────────────────────────────┘     │
│  ─────────────────────────────       │
│  POSITIONS OF RESPONSIBILITY         │
│  ┌─────────────────────────────┐     │
│  │ Technical Secretary         │     │
│  │ Techfest IIT Bombay         │     │
│  │ Aug 2023 – May 2024         │     │
│  │ [View Source ↗]             │     │
│  └─────────────────────────────┘     │
│  ─────────────────────────────       │
│  CONTACT                             │
│  LinkedIn: [link]                    │
│  Email: arjun@gmail.com [github]     │
│  GitHub: github.com/arjunm           │
│  ─────────────────────────────       │
│  NOTES                               │
│  [Add a note...]           [Save]    │
└──────────────────────────────────────┘
```

Every competition and PoR entry has a **"View Source ↗"** link to the original scraped URL. This is the recruiter's trust anchor — every data point is auditable.

### 6.5 Pipeline Management

Accessible via the top-nav "Pipelines" dropdown.

```
[Pipelines ▼]
  ├── SWE Intern — July 2025 (12)
  ├── Hardware Lead — Q3 (5)
  ├── + Create New Pipeline
  └── Manage Pipelines →
```

Pipeline table view: Name | University | Grad Year | Key Achievement | Email | Notes | Remove

Export CSV columns: `full_name, university, degree, branch, graduation_year, top_competition, top_result_tier, top_por_role, linkedin_url, email, email_confidence`

### 6.6 Health Dashboard (`/admin/health`)

A dedicated page showing the real-time status of every scraper and rate-limited free service. This is the interface the recruiter uses when the nav indicator turns yellow or red.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Scraper Health Dashboard                      Last run: 2h ago     │
├────────────────────┬──────────┬───────────┬───────────┬────────────┤
│  Scraper           │  Status  │  Extracted│  Expected │  Last OK   │
├────────────────────┼──────────┼───────────┼───────────┼────────────┤
│  devfolio          │  ✅ OK   │  312      │  ≥ 50     │  2h ago    │
│  gsoc              │  ✅ OK   │  87       │  ≥ 20     │  2h ago    │
│  gdsc              │  ✅ OK   │  144      │  ≥ 30     │  2h ago    │
│  hackerearth       │  ✅ OK   │  203      │  ≥ 40     │  2h ago    │
│  sih_pdf           │  🔴 FAIL │  0        │  ≥ 100    │  14d ago   │
│  e_yantra          │  ✅ OK   │  56       │  ≥ 15     │  2h ago    │
│  robocon           │  ⚠️ DEGR │  3        │  ≥ 20     │  7d ago    │
│  college_fests     │  ✅ OK   │  78       │  ≥ 10     │  2h ago    │
├────────────────────┴──────────┴───────────┴───────────┴────────────┤
│  Free Service Rate Limits                                           │
│  DuckDuckGo Lookups Today: 43 / 180  [24% used]  ✅ Healthy        │
│  GitHub API Remaining (this hour): 4,821 / 5,000  ✅ Healthy       │
├─────────────────────────────────────────────────────────────────────┤
│  ⚠️  sih_pdf — FAILED — [Copy Error Report]                        │
│  Error: pdfplumber extracted 0 rows. PDF structure changed.         │
│  URL: https://sih.gov.in/results/2025                               │
│  Last successful run: 14 days ago                                   │
│                                                                     │
│  → Paste the copied error report into Claude to get a fix.         │
└─────────────────────────────────────────────────────────────────────┘
```

**"Copy Error Report" button:** copies a structured, Claude-ready error report to the clipboard. See §8.2.3 for the exact format. This is the single most important UX detail in the maintenance flow — it makes getting a fix from Claude a one-paste operation.

### 6.7 Admin Panel (`/admin`)

| Function | Description |
|---|---|
| **Trigger Scrape Run** | Manual kick-off for a specific scraper or all scrapers. Shows last-run timestamp and row count delta |
| **Database Stats** | Total candidates · Total competition results · Total PoRs · Email enrichment coverage % · DuckDuckGo daily usage · GitHub hourly quota remaining |
| **Duplicate Review Queue** | Side-by-side merge/dismiss UI for flagged candidate pairs |
| **Add Manual Entry** | Form to manually add a candidate found outside the scrape pipeline |

---

## 7. Bulk Actions

```
┌─────────────────────────────────────────────────────────┐
│  ☑ 8 candidates selected                               │
│  [Add to Pipeline ▼]   [Export Selected]   [Clear]     │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Data Architecture — Resilient, Automated, $0/month

This section documents the full data ingestion strategy including explicit solutions to the four structural risks: PDF fragility, free-tier rate limits, deduplication accuracy, and scraper maintenance burden.

### 8.1 The Two-Tier Source Model

The foundational architectural decision is treating data sources as two distinct tiers with different reliability guarantees and different maintenance contracts.

| Tier | Definition | Maintenance expectation | Cost |
|---|---|---|---|
| **Tier 1 — API-backed** | Source exposes a stable API or machine-readable format not tied to HTML layout | Near-zero — API breaking changes are announced | Free |
| **Tier 2 — HTML or PDF** | Source is a webpage or document with no API — layout changes break the scraper | Expected to break occasionally — alert fires, Claude fixes it | Free |

**The rule:** every competition in the target list is assigned a tier. Tier 1 is used wherever an API exists. Tier 2 is a fallback, not a first choice. When a Tier 2 scraper breaks, it does not bring down the system — it fires an alert, quarantines its data, and waits for a fix.

### 8.2 The Scraper Health and Maintenance Loop

Full automation is a hard requirement. The system runs weekly without human intervention under normal conditions. The maintenance loop activates only when a scraper breaks — and it is designed to make that recovery fast and Claude-assisted.

#### 8.2.1 Health check logic (runs after every scraper)

Every scraper — Tier 1 and Tier 2 — is wrapped in a health check that runs after extraction, before any data is written to the database.

```python
# scraper/utils/health.py

EXPECTED_MINIMUM_RESULTS = {
    "devfolio":      50,
    "gsoc":          20,
    "gdsc":          30,
    "hackerearth":   40,
    "sih_pdf":       100,
    "e_yantra":      15,
    "robocon":       20,
    "inter_iit":     30,
    "college_fests": 10,
    # etc.
}

def run_with_health_check(scraper_name: str, scraper_fn, *args, **kwargs) -> list:
    """
    Runs a scraper function. On success, writes to DB and logs OK.
    On failure or low confidence, quarantines data, logs failure, sends alert.
    Never writes partial or zero-row data to the candidates table.
    """
    import traceback

    try:
        results = scraper_fn(*args, **kwargs)
        expected_min = EXPECTED_MINIMUM_RESULTS.get(scraper_name, 5)

        if len(results) < expected_min:
            # Degraded: ran without crashing but extracted too little
            _log_health(scraper_name, "degraded", len(results), expected_min,
                        f"Extracted {len(results)} records, expected ≥ {expected_min}. "
                        f"Possible layout change or empty results page.")
            _send_alert(scraper_name, "degraded", results_count=len(results))
            return []  # Quarantine — do not write to DB

        _log_health(scraper_name, "ok", len(results), expected_min, None)
        return results

    except Exception:
        tb = traceback.format_exc()
        _log_health(scraper_name, "failed", 0,
                    EXPECTED_MINIMUM_RESULTS.get(scraper_name, 5), tb)
        _send_alert(scraper_name, "failed", error=tb)
        return []  # Quarantine

def _log_health(name, status, extracted, expected, error):
    # Writes to scraper_health_log table in Supabase
    supabase.table("scraper_health_log").insert({
        "scraper_name": name,
        "run_at": datetime.utcnow().isoformat(),
        "status": status,
        "records_extracted": extracted,
        "records_expected_min": expected,
        "error_message": error,
        "alert_sent": error is not None,
    }).execute()
```

**Key property:** the health check runs *before* any `INSERT` to the candidates table. A scraper that extracts zero rows due to a broken selector will not corrupt the database with missing or wrong data — it will quarantine its output and fire an alert. The existing data from the last successful run remains intact.

#### 8.2.2 Alert delivery (Gmail SMTP — free)

When a scraper enters "degraded" or "failed" state, an alert email is sent to the FlytBase hiring team immediately — not at the end of the weekly run, not in a batched digest. Immediately.

```python
# scraper/utils/alerts.py
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

ALERT_RECIPIENT = "hiring@flytbase.com"
GMAIL_SENDER    = os.environ["GMAIL_SENDER"]     # e.g. scraper-alerts@gmail.com
GMAIL_APP_PASS  = os.environ["GMAIL_APP_PASS"]   # Gmail App Password — not account password

def _send_alert(scraper_name: str, status: str,
                results_count: int = 0, error: str = None):
    subject = f"[FlytBase Talent Engine] Scraper {status.upper()}: {scraper_name}"

    # Human-readable summary
    body_lines = [
        f"Scraper: {scraper_name}",
        f"Status: {status.upper()}",
        f"Records extracted: {results_count}",
        f"Expected minimum: {EXPECTED_MINIMUM_RESULTS.get(scraper_name, 'unknown')}",
        f"Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "--- CLAUDE-READY ERROR REPORT (copy everything below this line) ---",
    ]
    body_lines += _build_claude_report(scraper_name, status, results_count, error)

    msg = MIMEMultipart()
    msg["From"] = GMAIL_SENDER
    msg["To"] = ALERT_RECIPIENT
    msg["Subject"] = subject
    msg.attach(MIMEText("\n".join(body_lines), "plain"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_SENDER, GMAIL_APP_PASS)
        server.send_message(msg)
```

#### 8.2.3 The Claude-ready error report

Every alert email and every Health Dashboard "Copy Error Report" button generates an identical structured report. The format is designed to give Claude everything it needs to diagnose and fix the problem in one paste — no back-and-forth for basic context.

```
--- CLAUDE-READY ERROR REPORT ---

You are maintaining a Python web scraper. The following scraper has broken and needs to be fixed.

SCRAPER: sih_pdf
FILE: scraper/scrapers/tier2/sih.py
STATUS: failed
RECORDS EXTRACTED: 0
RECORDS EXPECTED: ≥ 100
SOURCE URL: https://sih.gov.in/results/2025
LAST SUCCESSFUL RUN: 2025-01-12

ERROR:
Traceback (most recent call last):
  File "scraper/scrapers/tier2/sih.py", line 47, in extract_pdf_candidates
    tables = page.extract_tables()
pdfplumber.exceptions.PDFSyntaxError: No tables found on page 1

CONTEXT:
- This scraper downloads the SIH annual results PDF and extracts winner names,
  university, team name, and result tier using pdfplumber.
- The PDF URL above is the current year's results document.
- The scraper writes to: candidates table + competition_results table in Supabase.
- Normalisation is handled by scraper/utils/normalise.py (do not modify).
- Health check is handled by scraper/utils/health.py (do not modify).

TASK:
1. Identify why the scraper failed given the error above.
2. Provide a corrected version of the relevant function(s) in sih.py.
3. If the PDF structure has fundamentally changed, provide a revised parsing strategy.

--- END OF REPORT ---
```

This report is generated programmatically from the health log entry. The recruiter copies it, opens Claude, pastes it, and gets a corrected function. They commit the fix to the repository. The next scheduled GitHub Actions run picks up the fix automatically — no manual re-trigger needed.

#### 8.2.4 Scraper fix deployment flow

```
Alert fires (email + Health Dashboard turns red)
    ↓
Recruiter opens Health Dashboard → clicks "Copy Error Report"
    ↓
Pastes report into Claude → receives corrected scraper code
    ↓
Commits fix to repository (one file change in scraper/scrapers/)
    ↓
Next Sunday's GitHub Actions cron run picks up the fixed scraper automatically
    ↓
Health Dashboard returns to green
```

This loop takes approximately 15–30 minutes of recruiter time when it occurs. Under normal conditions it occurs 0–2 times per month across all scrapers.

### 8.3 Competition Results — Source-by-Source Strategy

#### 8.3.1 Tier 1: API-backed sources

These scrapers are written once and require no maintenance unless the source API itself changes — an event that is rare and always announced.

**Devfolio (covers ~15 hackathons in the target list)**

Devfolio's frontend loads data from a GraphQL API. This API is undocumented but has been structurally stable for years because it powers Devfolio's own product. A single scraper covers ETHIndia, Unfold, Solo Hack, JPMorgan Code for Good, Myntra HackerRamp, Mercari Hacks, and all other Devfolio-hosted events by iterating over a slug list.

```python
# scraper/scrapers/tier1/devfolio.py

DEVFOLIO_GRAPHQL = "https://api.devfolio.co/api/projects"
DEVFOLIO_SLUGS = [
    "ethindia-2024", "unfold-2024", "solohack-2024",
    "jpmorgan-code-for-good-2024", "myntra-hackerramp-2024",
    # full list in constants/competitions.py
]

def scrape_devfolio_hackathon(slug: str) -> list:
    # Fetches winning projects for a hackathon slug
    # Returns: [{full_name, university, github_url, linkedin_url, team_name,
    #            result_tier, competition_name, year}]
    response = requests.get(
        DEVFOLIO_GRAPHQL,
        params={"hackathon": slug, "won": "true"},
        headers={"Accept": "application/json"},
        timeout=30
    )
    # ... parse and return structured candidate list
```

**Google Summer of Code**

GSoC's public archive (`summerofcode.withgoogle.com/archive`) has been structurally consistent since 2016. Each project page links directly to the contributor's GitHub profile — the most reliable path to email in the pipeline.

**GDSC Solution Challenge**

`developers.google.com/community/gdsc-solution-challenge/winners` is a Google-maintained structured page listing team names and universities. Tier 1 by nature of its source.

**HackerEarth**

HackerEarth exposes a public developer API for challenges and leaderboards. Free developer key, 200 requests/hour — sufficient for weekly batch scraping.

#### 8.3.2 Tier 2: HTML and PDF sources — health-checked, alert-backed

These scrapers are written knowing they will break when source websites update. The design goal is not to prevent breakage but to detect it instantly, quarantine bad data, and route the problem to Claude for a fast fix.

Every Tier 2 scraper is wrapped in `run_with_health_check()` from §8.2.1. This is non-negotiable — no Tier 2 scraper writes directly to the database.

**PDF sources (SIH, Inter IIT, others)**

PDFs are the highest-risk Tier 2 source. `pdfplumber` works reliably on clean tabular PDFs but fails on scanned images or structurally changed documents.

```python
# scraper/scrapers/tier2/sih.py

def scrape_sih(year: int) -> list:
    return run_with_health_check("sih_pdf", _extract_sih_pdf, year)

def _extract_sih_pdf(year: int) -> list:
    pdf_url = f"https://sih.gov.in/results/{year}"
    response = requests.get(pdf_url, timeout=30)
    pdf_bytes = BytesIO(response.content)

    with pdfplumber.open(pdf_bytes) as pdf:
        full_text = "".join(
            page.extract_text() or "" for page in pdf.pages
        )

        # Zero text = scanned image PDF — extraction impossible
        # Health check will catch this (0 < 100 minimum) and fire alert
        if len(full_text.strip()) < 100:
            return []

        tables = []
        for page in pdf.pages:
            tables.extend(page.extract_tables() or [])

        return parse_tables_to_candidates(tables, "Smart India Hackathon", year)
        # parse_tables_to_candidates returns [] on structure mismatch
        # Health check catches the shortfall and alerts
```

The critical point: the PDF scraper itself is kept *simple*. It does not try to handle every possible PDF variant with complex fallback logic. When it fails, the health check catches it, the alert fires, and Claude diagnoses the specific structural change and provides a corrected `parse_tables_to_candidates()` implementation. This is the correct division of responsibility — the scraper handles the happy path, Claude handles the exceptions.

**HTML sources (e-Yantra, Robocon, college fest team pages)**

HTML scrapers use `BeautifulSoup` with CSS selectors. They break when a site redesigns. The maintenance expectation is: one of these sites redesigns roughly every 12–18 months. Each fix is a CSS selector update — typically 10–15 lines of code. With the health check alert firing immediately on breakage and the Claude-ready error report providing instant context, the fix cycle is fast.

```python
# scraper/scrapers/tier2/e_yantra.py

def scrape_e_yantra(year: int) -> list:
    return run_with_health_check("e_yantra", _extract_e_yantra, year)

def _extract_e_yantra(year: int) -> list:
    url = f"https://www.e-yantra.org/result/{year}"
    soup = BeautifulSoup(requests.get(url, timeout=30).text, "html.parser")
    rows = soup.select("table.results-table tbody tr")  # ← selector that will need updating on redesign
    return [parse_row(row) for row in rows if parse_row(row)]
```

#### 8.3.3 PoR data — structured manual intake with HTML assist

PoR data has no Tier 1 source. The correct model is periodic structured intake — not continuous scraping.

**GDSC chapter leads** (best PoR source) — `developers.google.com/community/gdsc/directory` lists all GDSC leads by institution. This is a Google-maintained page — Tier 1 equivalent in reliability.

**College fest team pages** (Techfest, Shaastra, Kshitij, E-Cells) — HTML scrapers targeting `/team` pages. Each fest publishes its core team annually. Scrapers run once per event cycle, wrapped in `run_with_health_check()`.

**Connecting PoR records to candidate profiles:** when a name + role + institution is ingested, the system checks for an existing candidate record (name + university match from competition scrapes). If found: the PoR is appended. If not: a skeleton record is created with `source: "manual"` and GitHub enrichment runs on the next cycle.

### 8.4 Contact Enrichment — Zero-Cost, Three-Stage Strategy

The v1.1 architecture relied on SerpAPI ($50/month) for LinkedIn profile URL discovery. This dependency is eliminated entirely. The v1.2 architecture achieves equivalent coverage through a three-stage enrichment pipeline using only free tools: GitHub API as the primary source, DuckDuckGo SERP scraping as the secondary source, and institute pattern inference as the final fallback. All three stages operate within documented free-tier limits enforced by the rate limit guard (§8.5).

**Email confidence values in this architecture:**

| Confidence Value | Source | Recruiter guidance |
|---|---|---|
| `github_profile` | Email field on public GitHub profile | Highest — use directly |
| `github_commit` | Author email in public commit events | High — may be a university address, verify deliverability |
| `inferred` | Pattern-matched from institute email format | Lower — verify before bulk outreach |
| `null` | No email found — LinkedIn URL available | Reach out via LinkedIn |

#### 8.4.1 Stage 1 — GitHub API: Profile email and commit-level email mining (primary)

Technical candidates from Tier 1 Indian colleges have high GitHub profile rates, especially those sourced from Devfolio, GSoC, and HackerEarth — which surface GitHub usernames directly. Stage 1 runs two sequential lookups per candidate: the profile endpoint (public email field), then the public events endpoint (commit-level author email). Together these cover a large fraction of candidates with zero cost and no rate-limit concern at this scale.

```python
# scraper/utils/enrich_contacts.py

GITHUB_TOKEN = os.environ["GH_TOKEN"]

def enrich_from_github_profile(github_username: str) -> dict:
    """
    Stage 1a: Returns email from the public GitHub profile page.
    Confidence: github_profile — user has explicitly made this email public.
    """
    response = requests.get(
        f"https://api.github.com/users/{github_username}",
        headers={"Authorization": f"token {GITHUB_TOKEN}"},
        timeout=10
    )
    data = response.json()
    return {
        "email": data.get("email"),           # None if not publicly set
        "github_url": data.get("html_url"),
        "blog": data.get("blog"),             # Often contains LinkedIn URL — checked in Stage 2
        "linkedin_url": _extract_linkedin_from_bio(data.get("bio", "") or ""),
    }

def enrich_from_github_commits(github_username: str) -> str | None:
    """
    Stage 1b: Mines public push event history for author email addresses.
    GitHub's Events API returns the last 300 public events — enough to find
    a commit email for any recently active contributor.
    Confidence: github_commit.
    Skips noreply GitHub addresses (@users.noreply.github.com).
    """
    response = requests.get(
        f"https://api.github.com/users/{github_username}/events/public",
        headers={"Authorization": f"token {GITHUB_TOKEN}"},
        timeout=10
    )
    for event in response.json():
        if event.get("type") != "PushEvent":
            continue
        for commit in event.get("payload", {}).get("commits", []):
            email = commit.get("author", {}).get("email", "")
            if email and "@users.noreply.github.com" not in email:
                return email
    return None

def _extract_linkedin_from_bio(bio: str) -> str | None:
    """
    Many developers include their LinkedIn URL directly in their GitHub bio
    or website field. This is extracted with a simple regex — no API call needed.
    """
    import re
    match = re.search(r"https?://(www\.)?linkedin\.com/in/[\w\-]+", bio)
    return match.group(0) if match else None
```

**Why commit-level email mining works:** the GitHub Events API exposes the full `author.email` field in PushEvent payloads. This is the email address registered in the contributor's local git config — often a personal Gmail or university address. It is not hidden behind authentication. At the scale of this database (~5,000 candidates), Stage 1 alone is projected to yield email enrichment for 60–70% of software-track candidates.

#### 8.4.2 Stage 2 — DuckDuckGo SERP scraping: LinkedIn URL discovery (secondary)

For candidates where Stage 1 yields no email — primarily business/GTM candidates, PoR-only profiles, and those without a GitHub presence — the system performs a DuckDuckGo search to find the candidate's LinkedIn profile URL. This uses the `duckduckgo_search` Python library, which is completely free, requires no API key, and wraps DuckDuckGo's HTML search interface.

```python
# scraper/utils/enrich_contacts.py
from duckduckgo_search import DDGS
import time
import random

DDG_DAILY_CEILING = 180  # Conservative limit — see §8.5 for rationale

def find_linkedin_url_ddg(full_name: str, university: str) -> str | None:
    """
    Queries DuckDuckGo: site:linkedin.com/in "full_name" "university"
    Returns the first matching LinkedIn profile URL, or None.

    Rate limiting: checks daily counter in Supabase before every call.
    If the daily ceiling is reached, defers and returns None.
    Adds a randomised 3–6 second delay after every call to avoid triggering
    DuckDuckGo's automated-request detection.
    """
    if not _ddg_quota_available():
        log_info("DuckDuckGo daily ceiling reached — deferring enrichment to next run")
        return None

    query = f'site:linkedin.com/in "{full_name}" "{university}"'
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))

        _increment_ddg_counter()
        time.sleep(random.uniform(3.0, 6.0))  # Mandatory inter-request delay

        for result in results:
            url = result.get("href", "")
            if "linkedin.com/in/" in url:
                return url
    except Exception as e:
        # DuckDuckGo occasionally returns rate-limit errors (202, 503)
        # Log and skip — never crash the enrichment pipeline over a single lookup
        log_warning(f"DuckDuckGo lookup failed for {full_name}: {e}")
        time.sleep(10.0)  # Back off on error

    return None

def _ddg_quota_available() -> bool:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    row = supabase.table("rate_limit_log") \
        .select("requests_made") \
        .eq("service", "duckduckgo") \
        .eq("date", today) \
        .maybe_single() \
        .execute()
    count = row.data["requests_made"] if row.data else 0
    return count < DDG_DAILY_CEILING

def _increment_ddg_counter():
    today = datetime.utcnow().strftime("%Y-%m-%d")
    # Upsert: increment if row exists, insert with count=1 if not
    supabase.rpc("increment_rate_limit", {
        "p_service": "duckduckgo",
        "p_date": today,
        "p_ceiling": DDG_DAILY_CEILING
    }).execute()
```

**GitHub bio as a zero-cost LinkedIn pre-check:** before making a DuckDuckGo request, the enrichment pipeline checks whether the candidate's GitHub profile `blog` or `bio` field already contains a LinkedIn URL (via `_extract_linkedin_from_bio()` in Stage 1a). This eliminates a meaningful fraction of DuckDuckGo calls at zero cost — a candidate who has linked their LinkedIn from GitHub never consumes a DDG quota unit.

**DuckDuckGo query allocation per weekly run:** with a 180-request daily ceiling and a weekly Sunday scrape run, the enrichment step processes up to 180 new candidates per run-day. At a typical database growth rate of ~150 new candidates per week (across all scrapers), Stage 2 enrichment stays comfortably within the daily ceiling. Priority is always given to candidates newly added this run over re-enriching existing candidates.

#### 8.4.3 Stage 3 — LinkedIn URL pattern construction with HEAD validation (tertiary)

For candidates where neither Stage 1 nor Stage 2 yields a LinkedIn URL — primarily candidates where the name is ambiguous enough that a DuckDuckGo search returns no clear match — the system constructs candidate LinkedIn URLs from the candidate's name and validates them with an unauthenticated HTTP HEAD request. LinkedIn returns a `200` on valid profile URLs and a `404` or redirect on invalid ones.

```python
# scraper/utils/enrich_contacts.py

def infer_linkedin_url_from_name(full_name: str) -> str | None:
    """
    Stage 3: Constructs likely LinkedIn URL patterns from full name,
    validates each with a HEAD request.

    LinkedIn URL formats observed for Indian professionals:
      linkedin.com/in/firstname-lastname
      linkedin.com/in/firstnamelastname
      linkedin.com/in/firstname-lastinitial (rarer)

    Returns the first URL that returns HTTP 200, or None.
    Only run for candidates already missing LinkedIn URL after Stages 1 and 2.
    """
    parts = full_name.lower().split()
    if len(parts) < 2:
        return None

    first, last = parts[0], parts[-1]
    candidates = [
        f"https://www.linkedin.com/in/{first}-{last}",
        f"https://www.linkedin.com/in/{first}{last}",
        f"https://www.linkedin.com/in/{first}-{last[0]}",
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; research-tool/1.0)"
    }

    for url in candidates:
        try:
            resp = requests.head(url, headers=headers, timeout=5, allow_redirects=True)
            if resp.status_code == 200 and "linkedin.com/in/" in resp.url:
                time.sleep(random.uniform(1.0, 3.0))
                return resp.url
        except Exception:
            continue

    return None
```

**Accuracy note:** Stage 3 is a heuristic. Common names (e.g., "Rahul Kumar") produce high false-positive rates because multiple people share the same `firstname-lastname` URL pattern. The system stores Stage 3 results as `linkedin_url` without a special confidence tag but the recruiter sees only the URL, not a confidence flag, in this case — the expectation is that LinkedIn URL inspection is fast enough that a recruiter can verify before outreach. Stage 3 is only run at pipeline-add time (on-demand), never in the weekly batch run, to limit call volume and false-positive accumulation in the database.

#### 8.4.4 On-demand enrichment at pipeline-add time

Email enrichment runs on demand when a recruiter adds a specific candidate to a pipeline — the moment of demonstrated outreach intent.

```
POST /api/pipelines/{id}/add
  → If candidate.email is null:
      Stage 1a: GitHub profile email lookup (if github_url known)
      Stage 1b: GitHub commit email mining (if github_url known, Stage 1a returned null)
      Stage 2:  DuckDuckGo LinkedIn URL lookup (if no GitHub result, DDG quota available)
      Stage 3:  LinkedIn URL pattern construction + HEAD validation (final fallback — on-demand only)
      Stage 4:  Institute email pattern inference (if university known — see §8.4.5)
  → Candidate added to pipeline regardless of enrichment result
  → If no email found: UI shows "No email found — reach out via LinkedIn"
                        with LinkedIn URL linked if available
```

#### 8.4.5 Institute email pattern inference (fallback)

```typescript
const INSTITUTE_EMAIL_PATTERNS: Record<string, string> = {
  "IIT Bombay":    "{firstname}.{lastname}@iitb.ac.in",
  "IIT Delhi":     "{firstname}{lastinitial}@iitd.ac.in",
  "IIT Madras":    "{firstname}@smail.iitm.ac.in",
  "IIT Kharagpur": "{firstname}{lastinitial}@kgpian.iitkgp.ac.in",
  "IIM Ahmedabad": "{firstname}_{lastname}@iima.ac.in",
};
// email_confidence = "inferred" — shown with warning label in UI
// Recruiter warned to verify before outreach
```

### 8.5 Free-Tier Rate Limit Management

Operating at $0/month requires explicit handling of the limits imposed by free services. The two rate-sensitive services in this architecture are the DuckDuckGo SERP scraper and the GitHub REST API. This section documents the exact enforcement strategy for each.

#### 8.5.1 DuckDuckGo daily ceiling

The `duckduckgo_search` library has no hard documented rate limit, but empirical observation shows that sustained request rates above 200–300 queries/day trigger temporary blocks (HTTP 202 or 503 responses). The system operates conservatively at a ceiling of **180 lookups/day** — 90% of the observed safe threshold — with the following controls:

| Control | Implementation |
|---|---|
| **Pre-call quota check** | Every call to `find_linkedin_url_ddg()` checks today's count in `rate_limit_log` before executing. Call is skipped and `None` returned if ceiling is reached. |
| **Mandatory inter-request delay** | Randomised 3–6 second sleep after every successful request — mimics human browsing cadence, reduces block risk |
| **Error backoff** | On HTTP error or exception, the scraper sleeps 10 seconds before continuing to the next candidate |
| **Daily counter reset** | The `rate_limit_log` row is keyed on calendar date (UTC). Quota resets automatically at midnight UTC with no code intervention needed. |
| **Ceiling alert** | If the daily counter reaches 180, a budget alert email is sent to `hiring@flytbase.com` and no further DuckDuckGo calls are made that day |
| **Staggered enrichment** | The weekly batch run prioritises new candidates only (no `linkedin_url` yet). Re-enrichment of existing candidates runs only if the daily ceiling has not been reached after new candidates are processed |

**Why 180 lookups/day is sufficient:** the system does not need to enrich every candidate immediately. At the projected scale of ~150 new candidates per week and a 180/day ceiling, every new candidate added by the weekly scrape run gets a DuckDuckGo lookup within the same run. The ceiling only becomes a constraint if multiple scrapers run on the same day (e.g., a manual trigger mid-week), in which case the system defers excess candidates to the next day with no data loss.

#### 8.5.2 GitHub API quota management

The GitHub REST API provides 5,000 authenticated requests per hour per token. At the projected database size (~5,000 candidates), a full enrichment pass requires approximately 10,000 requests (one profile lookup + one events lookup per candidate) — two hours of quota at continuous use. The weekly scrape run never triggers a full enrichment pass; it only processes new candidates (typically 150/week), consuming ~300 requests per run. Quota exhaustion is not a practical risk at this scale.

The defensive headroom check runs at the start of every GitHub Actions workflow:

```python
# scraper/utils/rate_limit_guard.py

def check_github_quota() -> bool:
    """
    Returns True if GitHub API has ≥ 500 requests remaining.
    If under threshold: logs warning, skips enrichment steps, does not abort the run.
    GitHub enrichment is opportunistic — the scrape pipeline is more important.
    """
    response = requests.get(
        "https://api.github.com/rate_limit",
        headers={"Authorization": f"token {os.environ['GH_TOKEN']}"},
        timeout=10
    )
    remaining = response.json().get("resources", {}).get("core", {}).get("remaining", 0)
    if remaining < 500:
        log_warning(f"GitHub API quota low: {remaining} requests remaining. Skipping enrichment.")
        return False
    return True

def check_ddg_quota_and_alert():
    """Called at the start of every scrape run. Sends alert if DDG ceiling was hit yesterday."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    row = supabase.table("rate_limit_log") \
        .select("requests_made, ceiling_hit") \
        .eq("service", "duckduckgo") \
        .eq("date", today) \
        .maybe_single() \
        .execute()
    if row.data and row.data.get("ceiling_hit"):
        send_budget_alert("duckduckgo", row.data["requests_made"])
```

### 8.6 University normalisation

All university names are normalised on ingestion before writing to the database.

```typescript
const UNIVERSITY_ALIASES: Record<string, string> = {
  "IITB": "IIT Bombay", "IIT-Bombay": "IIT Bombay",
  "Indian Institute of Technology Bombay": "IIT Bombay",
  "IITD": "IIT Delhi", "IITM": "IIT Madras",
  "IITK": "IIT Kanpur", "IIT KGP": "IIT Kharagpur",
  "BITS Pilani": "BITS Pilani", "BITS Goa": "BITS Pilani Goa",
  "IIM-A": "IIM Ahmedabad", "IIM-B": "IIM Bangalore",
  "ISB": "ISB Hyderabad",
  // full list in src/constants/universities.ts
};
```

**Target university list (filter dropdown):**

IIT Bombay · IIT Delhi · IIT Madras · IIT Kharagpur · IIT Kanpur · IIT Roorkee · IIT Guwahati · IIT Hyderabad · IIT BHU · IIT Indore · BITS Pilani · BITS Pilani Goa · BITS Pilani Hyderabad · NIT Trichy · NIT Surathkal · NIT Warangal · NIT Calicut · IIIT Hyderabad · IIIT Delhi · IIM Ahmedabad · IIM Bangalore · IIM Calcutta · IIM Lucknow · ISB Hyderabad · XLRI Jamshedpur · FMS Delhi · MDI Gurgaon · SP Jain Mumbai

### 8.7 Competition list — full tracked set

**Hardware (17):** Smart India Hackathon – Hardware · Inter IIT Tech Meet – Hardware · e-Yantra Robotics Competition · Robocon India · TechFest Robotics (IIT Bombay) · IGVC India · SAE Efficycle · BAJA SAE India · Shaastra – Robotics · Techkriti – Robotics · DRDO Young Scientist Lab · IIT Bombay AUV / Aerial Robotics · RoboSub India Qualifiers · Texas Instruments IICDC · KPIT Sparkle · MathWorks Minidrone · SAE Aero Design India

**Software (20):** Smart India Hackathon – Software · ETHIndia · Devfolio Unfold · Devfolio Solo Hack · HackerEarth College Hackathons · Google Summer of Code · Inter IIT Tech Meet – Software · Inter IIT Tech Meet – Data Science · Flipkart Grid · Microsoft Imagine Cup India · Amazon ML Challenge · Unstop Hackathons · GDSC Solution Challenge · Mercari Hacks · Myntra HackerRamp · JPMorgan Code for Good · TCS CodeVita · Uber HackTag · Samsung PRISM · Kaggle University Hackathons

**Founders Office (15):** E-Cell IIT Bombay – Eureka! · E-Summit IIT Kharagpur · IIM Ahmedabad CIIE · TechSpark · Startup Weekend India · iCreate National Innovation Challenge · Entrepreneurship World Cup India · MIT India Initiative · Hult Prize India · NASSCOM 10000 Startups · IIM Bangalore NSRCEL · Conquest BITS Pilani · ISB Venture Labs · TiE University Pitch · Empresario

**Product GTM (19):** HUL LIME · Mahindra War Room · BCG Strategy Competition · L'Oreal Brandstorm India · Nielsen IQ Case Challenge · IIM Ahmedabad CMCS · P&G CEO Challenge · Asian Paints CANVAS · Titan Acumen · Amazon ACE · Niti Aayog AIM · Inter IIT Management Meet · Tata Crucible B-School · Adobe Strategy Challenge · Flipkart WiRED · Reliance TUP · TVS Credit E.P.I.C. · Reckitt Global Challenge · Optum Stratethon

### 8.8 Deduplication — Relaxed Thresholds, Human Merge Gate

The key insight from the revised constraints is that **false merges are acceptable** (cross-referencing the LinkedIn URL in the merged record resolves them quickly) while **missed merges** (the same person appearing twice) are the more operationally annoying problem. This inverts the previous architecture's conservatism and allows for a simpler, more aggressive merging strategy.

**Merge decision logic:**

```python
# scraper/utils/deduplicate.py

def classify_duplicate(c1: dict, c2: dict) -> str:
    """
    Returns: "auto_merge" | "flag_for_review" | "no_match"

    Philosophy: prefer merging over splitting. A false merge is fixable
    by cross-referencing LinkedIn. A missed merge creates duplicate outreach.
    """

    # Certain identity — URL match overrides everything
    if c1["linkedin_url"] and c1["linkedin_url"] == c2["linkedin_url"]:
        return "auto_merge"
    if c1["github_url"] and c1["github_url"] == c2["github_url"]:
        return "auto_merge"

    name_score = name_similarity(c1["full_name"], c2["full_name"])
    same_uni   = c1["university"] == c2["university"]
    year_close = abs((c1["graduation_year"] or 0) - (c2["graduation_year"] or 0)) <= 1

    # High confidence: name + university + year all match → auto-merge
    # Branch is NOT required — it's often missing or inconsistently recorded
    if name_score >= 0.90 and same_uni and year_close:
        return "auto_merge"

    # Moderate confidence: name + university match, year unknown/missing
    if name_score >= 0.85 and same_uni:
        return "flag_for_review"

    return "no_match"
```

**Why branch is excluded from auto-merge criteria here:** branch data is frequently missing or inconsistent across competition results (a student often registers with their full branch name on one platform and an abbreviation on another). Requiring branch match would cause many real same-person records to miss the merge threshold entirely. Given that false merges are acceptable and correctable, the cleaner tradeoff is to auto-merge on name + university + year and let the recruiter's LinkedIn cross-reference handle the occasional false positive.

**The duplicate review queue in Admin panel** shows flagged pairs side-by-side for one-click resolution:

```
┌────────────────────────┬────────────────────────┬──────────────────────────────────┐
│  Candidate A           │  Candidate B           │  Signals                         │
├────────────────────────┼────────────────────────┼──────────────────────────────────┤
│  Rahul Kumar           │  Rahul Kumar           │  ✅ Name: 0.97                   │
│  IIT Delhi · 2025      │  IIT Delhi · (unknown) │  ✅ University: match            │
│  CS                    │  Mechanical            │  ⚠️  Year: A=2025, B=unknown     │
│  SIH Software Win      │  Robocon Runner-Up     │  ⚠️  Branch: CS vs Mechanical    │
│  linkedin.com/in/rahulk│  (no LinkedIn)         │                                  │
├────────────────────────┴────────────────────────┴──────────────────────────────────┤
│  [Merge — Same Person]                                  [Dismiss — Different People]│
└────────────────────────────────────────────────────────────────────────────────────┘
```

The recruiter checks Candidate A's LinkedIn URL (visible in the panel) against Candidate B's details to resolve ambiguity. This takes under 30 seconds per pair.

### 8.9 GitHub Actions schedule

```yaml
# .github/workflows/scrape.yml
name: Weekly Scrape Run
on:
  schedule:
    - cron: "0 2 * * 0"     # Every Sunday 2am UTC
  workflow_dispatch:          # Manually triggerable from Admin panel
    inputs:
      target:
        description: "Scraper to run: 'devfolio' | 'gsoc' | 'all' | etc."
        default: "all"

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python 3.11
        uses: actions/setup-python@v4
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: |
          pip install requests beautifulsoup4 playwright pdfplumber supabase duckduckgo_search

      - name: Install Playwright browsers
        run: playwright install chromium

      - name: Check GitHub API quota and DuckDuckGo daily ceiling
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          GMAIL_SENDER: ${{ secrets.GMAIL_SENDER }}
          GMAIL_APP_PASS: ${{ secrets.GMAIL_APP_PASS }}
          ALERT_RECIPIENT: ${{ secrets.ALERT_RECIPIENT }}
        run: python scraper/utils/rate_limit_guard.py

      - name: Run Tier 1 scrapers
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: python scraper/run_tier1.py --target "${{ inputs.target || 'all' }}"

      - name: Run Tier 2 scrapers
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          GMAIL_SENDER: ${{ secrets.GMAIL_SENDER }}
          GMAIL_APP_PASS: ${{ secrets.GMAIL_APP_PASS }}
          ALERT_RECIPIENT: ${{ secrets.ALERT_RECIPIENT }}
        run: python scraper/run_tier2.py --target "${{ inputs.target || 'all' }}"

      - name: Run enrichment (GitHub + DuckDuckGo — new candidates only)
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          GMAIL_SENDER: ${{ secrets.GMAIL_SENDER }}
          GMAIL_APP_PASS: ${{ secrets.GMAIL_APP_PASS }}
          ALERT_RECIPIENT: ${{ secrets.ALERT_RECIPIENT }}
        run: python scraper/run_enrichment.py --new-only

      - name: Run deduplication
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: python scraper/deduplicate.py

      - name: Post run summary
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          GMAIL_SENDER: ${{ secrets.GMAIL_SENDER }}
          GMAIL_APP_PASS: ${{ secrets.GMAIL_APP_PASS }}
          ALERT_RECIPIENT: ${{ secrets.ALERT_RECIPIENT }}
        run: python scraper/post_summary.py
```

> **Workflow change from v1.1:** The `Check SerpAPI budget` step is removed entirely. It is replaced by `Check GitHub API quota and DuckDuckGo daily ceiling`, which reads the GitHub rate limit API and the `rate_limit_log` Supabase table — both free operations. The `SERPAPI_KEY` secret is no longer needed and should be deleted from the repository settings.

---

## 9. Backend API Routes

```
GET  /api/candidates                  → Search + filter (core query endpoint)
GET  /api/candidates/[id]             → Single candidate full profile
POST /api/candidates/[id]/enrich      → On-demand GitHub + DuckDuckGo enrichment
POST /api/pipelines                   → Create pipeline
GET  /api/pipelines                   → List pipelines
POST /api/pipelines/[id]/add          → Add candidates; triggers enrichment if email null
GET  /api/pipelines/[id]/export       → Stream CSV export
POST /api/admin/scrape                → Trigger GitHub Actions workflow_dispatch
GET  /api/admin/stats                 → DB stats + GitHub quota remaining + DDG daily usage
GET  /api/admin/health                → Scraper health log (powers Health Dashboard)
GET  /api/admin/duplicates            → Pending duplicate review pairs
POST /api/admin/duplicates/[id]       → Merge or dismiss
```

### 9.1 Core search query parameters

```typescript
interface SearchParams {
  name?: string;
  universities?: string[];
  grad_year_min?: number;
  grad_year_max?: number;
  degrees?: string[];
  branches?: string[];
  has_competition?: boolean;
  competition_categories?: ("hardware" | "software" | "founders_office" | "product_gtm")[];
  competition_names?: string[];
  result_tiers?: string[];
  comp_year_min?: number;
  comp_year_max?: number;
  has_por?: boolean;
  por_categories?: string[];
  por_orgs?: string[];
  por_leadership_only?: boolean;
  por_year?: number;
  page?: number;
  limit?: number;
  sort_by?: "name" | "graduation_year" | "competition_count";
  sort_dir?: "asc" | "desc";
}
```

---

## 10. Component Architecture

```
src/
  app/
    page.tsx
    admin/
      page.tsx
      health/page.tsx
    api/
      candidates/route.ts
      candidates/[id]/route.ts
      candidates/[id]/enrich/route.ts
      pipelines/route.ts
      pipelines/[id]/route.ts
      pipelines/[id]/export/route.ts
      admin/scrape/route.ts
      admin/stats/route.ts
      admin/health/route.ts
      admin/duplicates/route.ts
      admin/duplicates/[id]/route.ts
  components/
    search/
      FilterPanel.tsx
      StandardFilters.tsx
      BuilderFilter.tsx
      AgencyFilter.tsx
      ResultsPanel.tsx
      CandidateCard.tsx
      CandidateDrawer.tsx
      BulkActionBar.tsx
    pipelines/
      PipelineDropdown.tsx
      PipelineTable.tsx
    admin/
      HealthDashboard.tsx        ← Scraper status table + Claude error report copy button
      HealthIndicator.tsx        ← Nav badge: ✅ / ⚠️ / 🔴
      ScrapeControls.tsx
      DatabaseStats.tsx
      DuplicateReviewQueue.tsx
  hooks/
    useSearch.ts
    usePipelines.ts
    useCandidateDrawer.ts
    useHealthStatus.ts           ← Polls /api/admin/health for nav indicator
  types/
    candidate.ts
    search.ts
    pipeline.ts
    health.ts
  constants/
    universities.ts
    competitions.ts
    organisations.ts

scraper/
  run_tier1.py
  run_tier2.py
  run_all.py
  run_enrichment.py              ← New in v1.2: dedicated enrichment runner (GitHub + DDG)
  post_summary.py
  scrapers/
    tier1/
      devfolio.py
      gsoc.py
      gdsc.py
      hackerearth.py
    tier2/
      sih.py
      e_yantra.py
      robocon.py
      inter_iit.py
      college_fest_teams.py
      tcs_codevita.py
  utils/
    health.py            ← run_with_health_check(), _log_health(), _send_alert()
    alerts.py            ← Gmail SMTP + Claude-ready report generation
    rate_limit_guard.py  ← GitHub quota check + DuckDuckGo daily ceiling enforcement
                           (replaces budget_guard.py from v1.1)
    normalise.py
    deduplicate.py
    enrich_contacts.py   ← GitHub profile + commit mining + DDG LinkedIn discovery
                           + LinkedIn URL pattern inference + institute pattern inference
  db/
    supabase_client.py
```

---

## 11. The `useSearch` Hook

```typescript
export function useSearch() {
  const [filters, setFilters] = useState<SearchParams>({
    grad_year_min: new Date().getFullYear() - 2,
    grad_year_max: new Date().getFullYear() + 1,
    page: 0, limit: 50,
    sort_by: "graduation_year", sort_dir: "desc",
  });

  const [results, setResults] = useState<Candidate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const debouncedFilters = useDebounce(filters, 300);
  useEffect(() => { fetchCandidates(debouncedFilters); }, [debouncedFilters]);

  const updateFilter = <K extends keyof SearchParams>(key: K, value: SearchParams[K]) =>
    setFilters(prev => ({ ...prev, [key]: value, page: 0 }));

  const clearAllFilters = () => setFilters({ ...DEFAULT_FILTERS });
  const activeFilterCount = computeActiveFilterCount(filters);

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return { filters, updateFilter, clearAllFilters, activeFilterCount,
           results, totalCount, isLoading, selectedIds, toggleSelect };
}
```

---

## 12. Responsive Behaviour

- **Desktop (≥1280px):** 320px filter panel left, results panel fills remainder. Drawer opens to 480px.
- **Laptop (1024–1279px):** Filter panel narrows to 280px.
- **Tablet (768–1023px):** Filter panel collapses into a slide-in drawer triggered by a "Filters" button.
- **Mobile (<768px):** Not a primary target. Read-only list view with a banner prompting desktop use.

---

## 13. Out of Scope for This PRD

- Outreach automation — this tool covers discovery only
- Candidate-facing interface — candidates are never notified they are in this database
- Real-time LinkedIn scraping — blocked by LinkedIn bot detection; PoR data is batch-ingested
- Resume parsing or document upload
- ATS integration — CSV export is the v1 integration mechanism
- Authentication and multi-user permissions — single shared login sufficient for v1
- Paid SERP APIs (SerpAPI, Bright Data, ScaleSerp) — DuckDuckGo SERP scraping via `duckduckgo_search` covers the LinkedIn URL discovery use case at zero cost
- Hunter.io — excluded; GitHub commit mining + DuckDuckGo covers the use case at zero cost
- Incurring any monthly infrastructure cost — $0 hard ceiling enforced by `rate_limit_guard.py` at runtime

---

## 14. Acceptance Criteria

| # | Criteria |
|---|---|
| 1 | Filter panel renders all three layers with correct UI components as specced in §5 |
| 2 | Selecting a university returns only candidates from that institution within 300ms |
| 3 | Selecting "Winner" returns only candidates with `result_tier = "winner"` |
| 4 | Selecting "Top 3" returns candidates with result_tier in ("winner", "runner_up", "top_3") |
| 5 | Combining a Builder filter and Agency filter returns only candidates satisfying both (AND logic) |
| 6 | Clicking a candidate card opens the detail drawer without page navigation |
| 7 | Every competition result and PoR entry in the drawer has a working "View Source ↗" link |
| 8 | "Export CSV" generates a correctly structured file within 3 seconds for up to 500 candidates |
| 9 | The Devfolio Tier 1 scraper extracts winner names, team name, university, and year via the GraphQL API without any HTML parsing |
| 10 | When a PDF scraper extracts fewer records than `EXPECTED_MINIMUM_RESULTS`, it writes zero records to `candidates`, writes a `scraper_health_log` entry with `status: "failed"`, and sends an alert email within 5 minutes of the scrape run completing |
| 11 | The alert email contains a fully formed Claude-ready error report that can be pasted directly into Claude without additional context |
| 12 | The Health Dashboard correctly shows ✅ / ⚠️ / 🔴 status for each scraper based on the most recent `scraper_health_log` entry |
| 13 | The nav Health indicator updates within 60 seconds of a scraper health log entry being written |
| 14 | When DuckDuckGo daily lookups reach 180, all subsequent DDG calls for that calendar day are skipped, a budget alert email is sent, and the daily counter resets automatically at midnight UTC without code intervention |
| 15 | Two candidates with matching LinkedIn URLs are auto-merged immediately |
| 16 | Two candidates with identical names, same university, and graduation year within 1 year are auto-merged without entering the review queue |
| 17 | Two candidates with similar names and same university but no graduation year on one record are routed to the duplicate review queue, not auto-merged |
| 18 | Adding a candidate to a pipeline triggers on-demand enrichment; if a GitHub profile email is found it appears on the card within the same request |
| 19 | All filter state persists in the URL as query parameters |
| 20 | The database does not exceed Supabase free tier limits (500MB) at projected scale of ~5,000 candidates and ~20,000 result/PoR rows |
| 21 | The GitHub commit email mining step (`enrich_from_github_commits`) skips `@users.noreply.github.com` addresses and stores only real email addresses with `email_confidence = "github_commit"` |
| 22 | The system incurs zero charges across all services for any calendar month of operation |

---

## 15. Suggested Implementation Order

1. **Set up Supabase schema** — create all tables: `candidates`, `competition_results`, `positions_of_responsibility`, `pipelines`, `candidate_notes`, `duplicate_review_queue`, `scraper_health_log`, `rate_limit_log`. Add indexes on `university`, `graduation_year`, `competition_category`, `result_tier`. Add the `increment_rate_limit` Postgres RPC function used by the DuckDuckGo counter.

2. **Build `health.py`, `alerts.py`, and `rate_limit_guard.py`** — these utilities underpin every scraper and every enrichment call. Build and unit-test them before writing a single scraper. Test the Gmail alert delivery against a real inbox. Simulate a DDG ceiling breach and confirm the alert fires and subsequent calls are skipped.

3. **Build the Devfolio Tier 1 scraper** — highest data density, API-backed. Wrap in `run_with_health_check()`. Run manually and validate the full Supabase write pipeline end-to-end.

4. **Build GSoC and GDSC Tier 1 scrapers** — together with Devfolio, these three populate the majority of the software database with zero HTML fragility.

5. **Build `deduplicate.py`** — run against real data from steps 3–4. Validate auto-merge and flag-for-review behaviour against known test cases before the database grows.

6. **Build `enrich_contacts.py`** — implement all four enrichment stages in order: (a) GitHub profile email, (b) GitHub commit email mining, (c) DuckDuckGo LinkedIn URL discovery with rate limiting, (d) LinkedIn URL pattern construction + HEAD validation (on-demand only). Validate against a sample of 50 known candidates from the Devfolio scrapes. Confirm DDG rate limit counter increments correctly and resets at midnight.

7. **Wire GitHub Actions cron job** — schedule the weekly run. Confirm the health log, alert email, and rate limit guard all fire correctly in a dry run. Verify `SERPAPI_KEY` has been removed from repository secrets.

8. **Build `/api/candidates` search endpoint** — `SearchParams` → Supabase query builder. Unit-test the result tier hierarchy logic independently. Test with `curl` before any UI work.

9. **Build `FilterPanel` + `useSearch` hook** — Standard Filters first. Connect to live API against real data. First end-to-end usable interaction.

10. **Add Builder Filter UI and query logic.**

11. **Add Agency Filter UI and query logic.** Filter panel is now feature-complete.

12. **Build `CandidateCard` and virtual list** — include all badges, email confidence labels (`github_profile`, `github_commit`, `inferred`), "Add to Pipeline" with on-demand enrichment trigger.

13. **Build `CandidateDrawer`** — full competition history, PoR history, contact info, notes.

14. **Build `HealthDashboard` and `HealthIndicator`** — wire to `scraper_health_log` and `rate_limit_log`. Show DuckDuckGo daily usage and GitHub hourly quota. Implement "Copy Error Report" button. This is a day-one operational requirement, not a nice-to-have.

15. **Build Pipeline management** — dropdown, create/add/view, CSV export.

16. **Build Admin panel** — stats, scrape trigger, duplicate review queue.

17. **Add Tier 2 scrapers** — SIH PDF, e-Yantra, Robocon, college fest team pages. Each wraps `run_with_health_check()`. Add one at a time, validate health log entry on intentional failure.

18. **URL state persistence** — serialise `SearchParams` into URL query parameters.

19. **QA full filter combination matrix** — all meaningful filter combinations, edge cases, export correctness, enrichment flow, DDG ceiling at 180 lookups, GitHub quota guard at 500 remaining requests.
