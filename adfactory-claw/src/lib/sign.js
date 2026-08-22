// HMAC-signed approve/reject tokens so the email links can't be forged.
import crypto from "node:crypto";
import { config } from "../config.js";

export function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto
    .createHmac("sha256", config.approveSecret)
    .update(body)
    .digest("base64url");
  return `${body}.${mac}`;
}

export function verify(token) {
  const [body, mac] = String(token).split(".");
  if (!body || !mac) return null;
  const expected = crypto
    .createHmac("sha256", config.approveSecret)
    .update(body)
    .digest("base64url");
  if (
    mac.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  )
    return null;
  return JSON.parse(Buffer.from(body, "base64url").toString());
}
