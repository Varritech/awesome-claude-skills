// One-time: mint a Google OAuth REFRESH TOKEN so Cloud Run can get user-scoped
// access tokens for Veo3 (Vertex) without `gcloud auth` on the box.
//
// Prereq: an OAuth "Desktop app" client in the varribrain GCP project. Put its id
// + secret in env as GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET, then run:
//   node scripts/mint-veo-token.mjs
// Open the printed URL, approve, paste the code back. It prints the refresh token —
// store it as the GOOGLE_OAUTH_REFRESH_TOKEN secret on Cloud Run.
import http from "node:http";
import { URL } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const REDIRECT = "urn:ietf:wg:oauth:2.0:oob";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });

console.log("\n1) Open this URL, approve, copy the code:\n\n" + authUrl + "\n");
const rl = readline.createInterface({ input, output });
const code = (await rl.question("2) Paste the code here: ")).trim();
rl.close();

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
  }),
});
const j = await res.json();
if (!j.refresh_token) {
  console.error("no refresh_token returned:", j);
  process.exit(1);
}
console.log("\nGOOGLE_OAUTH_REFRESH_TOKEN=" + j.refresh_token + "\n");
console.log("Store that as a Cloud Run secret. Done.");
