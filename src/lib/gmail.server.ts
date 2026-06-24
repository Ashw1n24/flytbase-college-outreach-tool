/**
 * Gmail sender — server-only module.
 *
 * Prerequisites:
 *   npm install googleapis
 *
 * Required env vars (.env):
 *   GMAIL_CLIENT_ID          – OAuth2 client ID from Google Cloud Console
 *   GMAIL_CLIENT_SECRET      – OAuth2 client secret
 *   GMAIL_REFRESH_TOKEN      – Long-lived refresh token (run scripts/get-gmail-token.mjs once)
 *   GMAIL_FROM_EMAIL         – The hiring Gmail address (e.g. hiring@flytbase.com)
 *   GMAIL_SENDER_NAME        – Display name (e.g. "Ashwin · FlytBase Talent")
 */

import { google } from "googleapis";

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  threadId?: string; // pass for threaded follow-ups
}

export interface SendEmailResult {
  messageId: string;
  threadId: string;
}

function getGmailClient() {
  const clientId     = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Gmail credentials. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN in .env",
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
}

/** Encode a raw RFC-2822 message as base64url for the Gmail API. */
function encodeMessage(
  from: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
): string {
  const parts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ];
  if (threadId) {
    parts.push(`In-Reply-To: ${threadId}`);
    parts.push(`References: ${threadId}`);
  }
  parts.push("", body);
  return Buffer.from(parts.join("\r\n")).toString("base64url");
}

/**
 * Check whether a Gmail thread has received an external reply (from someone other than us).
 * Returns true if an external reply exists, false otherwise.
 * Returns null if the thread cannot be found (e.g. deleted).
 *
 * NOTE: checking message count > 1 was wrong — follow-up emails we send ourselves
 * land in the same thread, so they'd falsely trigger "replied". Instead, we check
 * whether any message in the thread has a From address that's NOT our sending address.
 */
export async function checkThreadForReply(threadId: string): Promise<boolean | null> {
  try {
    const gmail    = getGmailClient();
    const ourEmail = (process.env.GMAIL_FROM_EMAIL ?? "").toLowerCase().trim();

    const res = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: ["From"],
    });

    const messages = res.data.messages ?? [];

    const hasExternalReply = messages.some((msg) => {
      const fromHeader = (msg.payload?.headers ?? [])
        .find((h) => h.name?.toLowerCase() === "from")
        ?.value ?? "";
      return !fromHeader.toLowerCase().includes(ourEmail);
    });

    return hasExternalReply;
  } catch (err: unknown) {
    const status = (err as { code?: number })?.code;
    if (status === 404) return null;
    throw err;
  }
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const gmail      = getGmailClient();
  const fromEmail  = process.env.GMAIL_FROM_EMAIL ?? "";
  const senderName = process.env.GMAIL_SENDER_NAME ?? "FlytBase Talent";
  const from       = `${senderName} <${fromEmail}>`;

  const raw = encodeMessage(from, params.to, params.subject, params.body, params.threadId);

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      ...(params.threadId ? { threadId: params.threadId } : {}),
    },
  });

  return {
    messageId: res.data.id ?? "",
    threadId:  res.data.threadId ?? "",
  };
}
