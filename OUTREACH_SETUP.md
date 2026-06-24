# Outreach Module Setup

## 1. Supabase migration

Run in Supabase Dashboard → SQL Editor:

```
supabase/migrations/20260623_outreach_tables.sql
```

This creates `outreach_templates`, `outreach_messages`, and seeds 6 default templates.

---

## 2. Install Gmail package

```bash
npm install googleapis dotenv
```

---

## 3. Gmail OAuth (one-time setup)

### Step A — Google Cloud Console

1. Go to https://console.cloud.google.com/ → create a new project (e.g. "FlytBase Talent")
2. Enable **Gmail API** (APIs & Services → Library → search "Gmail API")
3. Go to **APIs & Services → OAuth consent screen**
   - User type: Internal (or External if needed)
   - Fill in app name, support email, developer email
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Desktop app**
   - Name: anything (e.g. "Talent Radar")
   - Download the JSON — you need `client_id` and `client_secret`

### Step B — Add to `.env`

```env
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_FROM_EMAIL=hiring@flytbase.com
GMAIL_SENDER_NAME=FlytBase Talent
```

### Step C — Get refresh token

```bash
node scripts/get-gmail-token.mjs
```

Follow the prompts — log in with the **hiring Gmail account** (not personal).
Copy the printed refresh token into `.env`:

```env
GMAIL_REFRESH_TOKEN=your_refresh_token_here
```

---

## 4. LinkedIn outreach via Phantombuster (optional)

If you want to send LinkedIn messages, use Phantombuster's free tier (2 hrs/day).

### Setup

1. Sign up at https://phantombuster.com (free plan)
2. Go to **Phantoms → New Phantom** → search "LinkedIn Message Sender"
3. Connect your LinkedIn account (provide session cookie — Phantombuster guides you)
4. Note the **Agent ID** from the phantom URL (`/agent/XXXXXXXX`)

### Add to `.env`

```env
PHANTOMBUSTER_API_KEY=your_pb_api_key
PHANTOMBUSTER_LINKEDIN_AGENT_ID=your_agent_id
```

> If these are not set, LinkedIn messages will fail with a clear error in the queue.

---

## 5. Optional settings

```env
# Days between initial message and first follow-up (default: 3)
OUTREACH_FOLLOWUP_DAYS=3
```

---

## 6. How to use

### Queueing candidates

**Experienced hires:**
1. Open a campaign → browse candidates
2. Click **"Queue for Outreach"** button (top-right of results)
3. Pick channel (email/LinkedIn) + template → Queue

**Students:**
- Coming soon — will be added to the student dashboard pipeline view.

### Sending messages

1. Go to **Outreach** from the home page
2. **Queue tab** — review drafts → select → Approve → Send
3. Or: approve all → click "Send N approved"

### Follow-ups

Follow-ups are auto-created when you visit the Outreach page (runs silently on load).
They appear in the Queue tab as "Follow-up 1" / "Follow-up 2" drafts.

You can also trigger manually: **Sent tab → "Process Follow-ups"**

### Mark as replied

On the **Sent tab**, click **"Replied"** next to any sent message.
This cancels pending follow-ups for that candidate.

---

## 7. Template variables

Available in all templates:

| Variable | Description |
|---|---|
| `{{candidate_name}}` | Candidate's full name |
| `{{role}}` | Current job title (experienced) |
| `{{company}}` | Current company (experienced) |
| `{{university}}` | University name (students) |
| `{{skills}}` | Top 3 skills (experienced) |
| `{{sender_name}}` | From `GMAIL_SENDER_NAME` env var |

Edit templates at **Outreach → Templates tab**.
