/**
 * Warmup recipient pool — sourced from the WARMUP_POOL env var
 * (comma-separated real addresses). Shared by the warmup tick (sends) and the
 * Resend inbound webhook (detects pool recipients to reply to).
 */

export function parseWarmupPool(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadWarmupPool(): string[] {
  return parseWarmupPool(process.env.WARMUP_POOL);
}