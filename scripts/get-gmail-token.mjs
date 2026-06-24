/**
 * One-time script to obtain a Gmail OAuth2 refresh token.
 *
 * Prerequisites:
 *   1. Go to https://console.cloud.google.com/ → New project
 *   2. Enable the Gmail API
 *   3. Create OAuth 2.0 credentials (Desktop App type)
 *   4. Download the JSON, copy client_id + client_secret into .env:
 *        GMAIL_CLIENT_ID=...
 *        GMAIL_CLIENT_SECRET=...
 *        GMAIL_FROM_EMAIL=hiring@flytbase.com
 *        GMAIL_SENDER_NAME=FlytBase Talent
 *   5. Run: node scripts/get-gmail-token.mjs
 *   6. Open the printed URL in the browser, log in with the hiring Gmail account,
 *      approve access, then paste the redirect URL back here.
 *   7. Copy the printed refresh token into .env as GMAIL_REFRESH_TOKEN=...
 *
 * You only need to do this once per Gmail account.
 */

import { createInterface } from "readline";
import { google } from "googleapis";
import * as dotenv from "dotenv";

dotenv.config();

const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET } = process.env;
if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
  console.error("❌  Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env first.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  "urn:ietf:wg:oauth:2.0:oob", // no redirect server needed
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
});

console.log("\n👉  Open this URL in your browser:\n");
console.log(authUrl);
console.log();

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question("Paste the authorisation code shown after approval: ", async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log("\n✅  Success! Add this to your .env file:\n");
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log();
  } catch (err) {
    console.error("❌  Token exchange failed:", err.message);
  }
});
