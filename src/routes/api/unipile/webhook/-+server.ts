/**
 * Unipile webhook receiver.
 *
 * Unipile calls this endpoint (POST) whenever a LinkedIn event occurs.
 * We listen for `messaging.message_received` events, match the chat_id
 * to an outreach_messages row (stored in gmail_thread_id), and mark it replied.
 *
 * Setup in Unipile dashboard:
 *   Webhooks → Add webhook
 *   URL: https://your-app.vercel.app/api/unipile/webhook
 *   Events: messaging.message_received
 *   Secret: same value as UNIPILE_WEBHOOK_SECRET in .env
 *
 * Unipile signs each request with: X-Unipile-Signature: sha256=<hmac>
 */

import { json } from "@tanstack/react-start/server";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getSupabaseAdmin } from "@/lib/supabase.server";

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

async function verifySignature(body: string, signatureHeader: string | null): Promise<boolean> {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret configured, skip verification (not recommended for production)
    console.warn("[unipile-webhook] UNIPILE_WEBHOOK_SECRET not set — skipping signature check");
    return true;
  }
  if (!signatureHeader) return false;

  const [algo, sig] = signatureHeader.split("=");
  if (algo !== "sha256" || !sig) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac    = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const digest = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (digest.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < digest.length; i++) {
    diff |= digest.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Event handler
// ---------------------------------------------------------------------------

async function handleMessageReceived(payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();

  // Unipile event shape (messaging.message_received):
  // {
  //   event: "messaging.message_received",
  //   account_id: "...",
  //   data: {
  //     chat_id: "...",
  //     message: { id, text, sender_id, sender_provider_id, timestamp, ... }
  //   }
  // }
  const data    = payload.data as Record<string, unknown> | undefined;
  const chatId  = data?.chat_id as string | undefined;
  const message = data?.message as Record<string, unknown> | undefined;

  if (!chatId) {
    console.warn("[unipile-webhook] No chat_id in payload, skipping");
    return;
  }

  // Find the outreach_message whose chat_id (stored in gmail_thread_id) matches
  const { data: rows } = await supabase
    .from("outreach_messages")
    .select("id, status, parent_message_id")
    .eq("gmail_thread_id", chatId)
    .eq("channel", "linkedin")
    .in("status", ["sent", "sending"]);

  if (!rows || rows.length === 0) {
    // Not a tracked conversation — ignore
    return;
  }

  const repliedAt = new Date().toISOString();

  for (const row of rows) {
    // Mark this message as replied
    await supabase
      .from("outreach_messages")
      .update({ status: "replied", replied_at: repliedAt, next_follow_up_at: null })
      .eq("id", row.id);

    // Cancel any pending follow-up drafts in this chain
    await supabase
      .from("outreach_messages")
      .update({ status: "replied", replied_at: repliedAt })
      .eq("parent_message_id", row.id)
      .in("status", ["draft", "approved"]);
  }

  console.info(
    `[unipile-webhook] Marked ${rows.length} message(s) as replied for chat_id=${chatId}`,
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const APIRoute = createAPIFileRoute("/api/unipile/webhook")({
  POST: async ({ request }) => {
    const rawBody = await request.text();
    const signature = request.headers.get("x-unipile-signature");

    const valid = await verifySignature(rawBody, signature);
    if (!valid) {
      console.warn("[unipile-webhook] Invalid signature — rejected");
      return json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }

    const event = payload.event as string | undefined;
    console.info(`[unipile-webhook] Received event: ${event}`);

    // Handle events we care about
    if (event === "messaging.message_received") {
      await handleMessageReceived(payload);
    }
    // Other events (account connected, etc.) are ignored — return 200 to acknowledge

    return json({ ok: true });
  },
});
