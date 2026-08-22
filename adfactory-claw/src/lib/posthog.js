// PostHog HogQL client — the claw's feedback loop.
//
// This is what makes the daily variant run a LEARNING loop instead of a random
// creative firehose: yesterday's ads are ranked here, and the winners seed
// tomorrow's copy prompt.
//
// ⛔ Project 489511 has NEVER recorded a `Purchase` event. Confirmed live
// 2026-08-21 over 30 days: the LP's `finalizeSuccess()` calls `fbq('track',
// 'Purchase')` directly and never `posthog.capture`, so every PostHog funnel on
// the Skills LP is bottomless. Ranking copy on `Purchase` would silently rank
// everything at zero — which reads exactly like "no copy works".
//
// So the ranking uses a tiered signal and reports WHICH tier it used:
//   1. Purchase              — real revenue, once the LP fix lands
//   2. lp_buyer_signature    — clicks>=3 AND page_loads>=2. Measured over 2,161
//                              sessions: catches 9/9 buyers at 24.8x lift, ~36/wk.
//                              This is the best proxy that exists today.
//   3. AddPaymentInfo        — 90x lift but only ~10/wk, too sparse to rank on alone
//   4. InitiateCheckout      — noisy floor, last resort
//
// Attribution join: Meta `url_tags` stamp `utm_content={{ad.id}}` onto the landing
// URL. Only the LANDING url carries it (checkout events do not), so every query
// takes `argMin($current_url, timestamp)` per session and parses from that.
//
// ⛔ HogQL gotchas that each cost a silent-empty round trip:
//   - property access needs the `properties.` prefix
//   - `properties.` does NOT resolve in an outer CTE — keep it one flat GROUP BY
//   - a wrong event name returns EMPTY, not an error
import { config } from "../config.js";

const API = "https://us.posthog.com/api";

export const SIGNAL_TIERS = ["Purchase", "lp_buyer_signature", "AddPaymentInfo", "InitiateCheckout"];

async function hogql(query) {
  if (!config.posthog.apiKey) throw new Error("POSTHOG_API_KEY not set");
  const res = await fetch(`${API}/projects/${config.posthog.projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.posthog.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`posthog: ${json.error || json.detail || res.status}`);
  }
  return json.results || [];
}

// Which of the tiered signals actually has data in the window? Returns the
// highest-quality one present, so a silent zero is never mistaken for a verdict.
export async function bestAvailableSignal({ days = 14 } = {}) {
  const rows = await hogql(
    `SELECT event, count() n FROM events
     WHERE timestamp > now() - INTERVAL ${days} DAY
       AND event IN (${SIGNAL_TIERS.map((e) => `'${e}'`).join(",")})
     GROUP BY event`,
  );
  const counts = Object.fromEntries(rows.map(([e, n]) => [e, Number(n)]));
  for (const tier of SIGNAL_TIERS) {
    if (counts[tier] > 0) return { signal: tier, counts };
  }
  return { signal: null, counts };
}

/**
 * Rank ads by conversion signal per session, attributed via utm_content.
 * Returns [{ adId, sessions, hits, rate }] sorted by rate desc.
 */
export async function rankAdsBySignal({ signal, days = 14, minSessions = 8 } = {}) {
  const rows = await hogql(
    `SELECT
       extractURLParameter(landing, 'utm_content') AS ad_id,
       count() AS sessions,
       countIf(hits > 0) AS converters
     FROM (
       SELECT properties.$session_id AS sid,
              argMin(properties.$current_url, timestamp) AS landing,
              countIf(event = '${signal}') AS hits
       FROM events
       WHERE timestamp > now() - INTERVAL ${days} DAY
       GROUP BY sid
     )
     WHERE ad_id != ''
     GROUP BY ad_id
     ORDER BY sessions DESC
     LIMIT 100`,
  );

  return rows
    .map(([adId, sessions, converters]) => ({
      adId: String(adId),
      sessions: Number(sessions),
      converters: Number(converters),
      rate: Number(sessions) ? Number(converters) / Number(sessions) : 0,
    }))
    .filter((r) => r.sessions >= minSessions)
    .sort((a, b) => b.rate - a.rate);
}

// Health check surfaced in /health and in the daily report, so the Purchase gap
// is visible rather than silently degrading every ranking.
export async function instrumentationHealth() {
  const { signal, counts } = await bestAvailableSignal({ days: 30 });
  return {
    rankingSignal: signal,
    counts,
    purchaseEventWired: (counts.Purchase || 0) > 0,
    note: (counts.Purchase || 0) > 0
      ? "PostHog Purchase is live — ranking on real revenue."
      : "PostHog has NO Purchase event; ranking on the buyer-signature proxy. Fix: route finalizeSuccess() through fireMetaEvent (or add posthog.capture('Purchase')) in vds-marketing-core components/ui/Products/SkillsCheckout.tsx.",
  };
}
