/**
 * Unipile client — server-only.
 *
 * Handles LinkedIn message sending, connection requests, and profile lookups
 * via the Unipile API (https://developer.unipile.com).
 *
 * Required env vars (.env):
 *   UNIPILE_DSN                  – e.g. https://api1.unipile.com:13613
 *   UNIPILE_ACCESS_TOKEN         – API access token from Unipile dashboard
 *   UNIPILE_LINKEDIN_ACCOUNT_ID  – Account ID of the connected LinkedIn account
 *   UNIPILE_WEBHOOK_SECRET       – Secret string set in Unipile webhook config
 *
 * Setup (one-time):
 *   1. Sign up at https://dashboard.unipile.com (7-day free trial)
 *   2. Connect your LinkedIn account under Accounts → Add account
 *   3. Copy your DSN and Access Token from the dashboard
 *   4. Copy the Account ID shown next to your LinkedIn account
 *   5. Add a webhook in Unipile dashboard → Webhooks → pointing to
 *      https://your-app.vercel.app/api/unipile/webhook
 *      with event type: messaging.message_received
 *   6. Set UNIPILE_WEBHOOK_SECRET to any strong random string
 *      (must match what you enter in the Unipile webhook config)
 */

import { UnipileClient } from "unipile-node-sdk";

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function getClient(): UnipileClient {
  const dsn   = process.env.UNIPILE_DSN;
  const token = process.env.UNIPILE_ACCESS_TOKEN;
  if (!dsn || !token) {
    throw new Error("Missing UNIPILE_DSN or UNIPILE_ACCESS_TOKEN in .env");
  }
  return new UnipileClient(dsn, token);
}

function getAccountId(): string {
  const id = process.env.UNIPILE_LINKEDIN_ACCOUNT_ID;
  if (!id) throw new Error("Missing UNIPILE_LINKEDIN_ACCOUNT_ID in .env");
  return id;
}

// ---------------------------------------------------------------------------
// Profile lookup — get LinkedIn provider_id from a profile URL
// ---------------------------------------------------------------------------

/** Extract the username slug from a LinkedIn URL.
 *  e.g. https://www.linkedin.com/in/rahul-sharma-abc123/ → rahul-sharma-abc123 */
function extractUsername(linkedinUrl: string): string {
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
  if (!match) throw new Error(`Cannot extract username from LinkedIn URL: ${linkedinUrl}`);
  return match[1].replace(/\/$/, "");
}

/** Fetch LinkedIn profile and return the provider_id (LinkedIn's internal member ID).
 *  This is required for sending messages and invitations. */
export async function getLinkedInProviderId(linkedinUrl: string): Promise<string> {
  const client     = getClient();
  const account_id = getAccountId();
  const identifier = extractUsername(linkedinUrl);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = await client.users.getProfile({ account_id, identifier }) as any;

  const providerId =
    profile?.provider_id ??
    profile?.data?.provider_id ??
    profile?.id ??
    profile?.data?.id;

  if (!providerId) {
    throw new Error(`Could not resolve LinkedIn provider_id for: ${linkedinUrl}`);
  }
  return String(providerId);
}

// ---------------------------------------------------------------------------
// Send a LinkedIn direct message
// ---------------------------------------------------------------------------

/**
 * Start a new LinkedIn conversation (or send to existing chat) and return
 * the Unipile chat_id so we can match incoming reply webhooks.
 */
export async function sendLinkedInMessage(
  linkedinUrl: string,
  text: string,
): Promise<string | null> {
  const client     = getClient();
  const account_id = getAccountId();
  const providerId = await getLinkedInProviderId(linkedinUrl);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await client.messaging.startNewChat({
    account_id,
    attendees_ids: [providerId],
    text,
  }) as any;

  // SDK returns { object: "ChatStarted", chat_id: string|null, message_id: string|null }
  console.log("[unipile] startNewChat response — object:", result?.object, "chat_id:", result?.chat_id, "message_id:", result?.message_id);
  // chat_id can be null for existing connections — use message_id as fallback for tracking
  const chatId = result?.chat_id ?? result?.message_id ?? null;
  return chatId ? String(chatId) : null;
}

// ---------------------------------------------------------------------------
// Send a LinkedIn connection invitation
// ---------------------------------------------------------------------------

/** Send a connection request, with an optional personalised note (max 300 chars). */
export async function sendLinkedInInvitation(
  linkedinUrl: string,
  note?: string,
): Promise<void> {
  const client     = getClient();
  const account_id = getAccountId();
  const providerId = await getLinkedInProviderId(linkedinUrl);

  await client.users.sendInvitation({
    account_id,
    provider_id: providerId,
    ...(note ? { message: note } : {}),
  });
}

// ---------------------------------------------------------------------------
// Health check — verify the Unipile account is connected and active
// ---------------------------------------------------------------------------

export async function checkUnipileAccount(): Promise<{
  ok: boolean;
  detail: string;
  accountName?: string;
}> {
  try {
    const client     = getClient();
    const account_id = getAccountId();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = await client.users.getOwnProfile(account_id) as any;
    const name =
      profile?.display_name ??
      profile?.data?.display_name ??
      profile?.name ??
      "Connected";

    return { ok: true, detail: `LinkedIn account active · ${name}`, accountName: String(name) };
  } catch (err) {
    return {
      ok:     false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
