// Raw Meta Graph API, HEADLESS, via Composio's proxy tool.
//
// Why this file exists: Composio's first-class METAADS_* tools (src/lib/meta.js)
// cannot express `object_story_spec` fully — no headline, no link_description, no
// image_hash — and there is no UPDATE_AD / DELETE_AD tool at all. The workbench's
// `proxy_execute()` helper does all of that, but only inside a live MCP session.
//
// Proven 2026-08-21 that the same raw-Graph passthrough IS reachable headless with
// nothing but the plain COMPOSIO_API_KEY:
//
//   POST /api/v3/tools/execute/proxy
//   { connected_account_id, endpoint, method, body }
//
// A creative was created and deleted from a plain curl with no MCP session and no
// Meta System User token. So the long-standing "headless Meta writes are blocked on
// an ads_management grant" belief does not apply on this path.
//
// ⛔ `endpoint` must NOT carry the /vXX.0/ prefix — the proxy prepends the version,
// and passing your own gives `Unknown path components`.
import { config } from "../config.js";

const BASE = "https://backend.composio.dev/api/v3";

let cachedAccountId = null;

// Resolve the ACTIVE metaads connected account. Cached for the process lifetime.
// Env override wins so a known-good id can be pinned without a lookup.
export async function metaConnectedAccountId() {
  if (config.meta.connectedAccountId) return config.meta.connectedAccountId;
  if (cachedAccountId) return cachedAccountId;

  const url = `${BASE}/connected_accounts?toolkit_slugs=metaads&user_ids=${encodeURIComponent(
    config.composio.userId,
  )}`;
  const res = await fetch(url, { headers: { "x-api-key": config.composio.apiKey } });
  const json = await res.json().catch(() => ({}));
  const items = json.items || json.data || [];
  const active = items.find((i) => i.status === "ACTIVE");
  if (!active) {
    throw new Error(
      "no ACTIVE metaads connected account — reconnect Composio metaads, or set META_CONNECTED_ACCOUNT_ID",
    );
  }
  cachedAccountId = active.id;
  return cachedAccountId;
}

/**
 * Call the Meta Graph API.
 * @param {"GET"|"POST"|"DELETE"} method
 * @param {string} endpoint  e.g. "/act_123/ads" — NO version prefix
 * @param {object} [opts]
 * @param {object} [opts.body]        POST body (values must be scalars; nested
 *                                    objects have to be JSON.stringify'd by the caller,
 *                                    same as the Graph API itself requires)
 * @param {object} [opts.params]      query string params for GET
 */
export async function graph(method, endpoint, { body, params } = {}) {
  const connected_account_id = await metaConnectedAccountId();

  let ep = endpoint;
  if (params && Object.keys(params).length) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    ).toString();
    ep += (ep.includes("?") ? "&" : "?") + qs;
  }

  const res = await fetch(`${BASE}/tools/execute/proxy`, {
    method: "POST",
    headers: { "x-api-key": config.composio.apiKey, "content-type": "application/json" },
    body: JSON.stringify({ connected_account_id, endpoint: ep, method, ...(body ? { body } : {}) }),
  });

  const json = await res.json().catch(() => ({}));
  if (json.error && !json.data) {
    throw new Error(`graph ${method} ${endpoint}: ${json.error.message || JSON.stringify(json.error)}`);
  }
  const data = json.data ?? json;
  // Graph errors come back INSIDE data with a 4xx `status` alongside — a 200 from
  // Composio is not proof Meta accepted anything.
  if (data && data.error) {
    const e = data.error;
    throw new Error(
      `graph ${method} ${endpoint}: (${e.code}${e.error_subcode ? "/" + e.error_subcode : ""}) ${e.message}`,
    );
  }
  return data;
}

// ---------------------------------------------------------------- reads

export async function adInsights({ level = "ad", datePreset = "last_90d", fields, limit = 500 } = {}) {
  const data = await graph("GET", `/${config.meta.accountId}/insights`, {
    params: {
      level,
      date_preset: datePreset,
      fields:
        fields ||
        "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,actions,action_values",
      limit,
    },
  });
  return data.data || [];
}

export async function getObject(id, fields) {
  return graph("GET", `/${id}`, { params: { fields } });
}

export async function activeAdsets() {
  const data = await graph("GET", `/${config.meta.accountId}/adsets`, {
    params: {
      fields: "name,status,effective_status,daily_budget,campaign_id,optimization_goal",
      effective_status: JSON.stringify(["ACTIVE"]),
      limit: 200,
    },
  });
  return data.data || [];
}

// ---------------------------------------------------------------- writes

// Upload raw image bytes. Returns the image_hash creatives reference.
export async function uploadImageBytes(buffer) {
  const data = await graph("POST", `/${config.meta.accountId}/adimages`, {
    body: { bytes: Buffer.from(buffer).toString("base64") },
  });
  const first = Object.values(data.images || {})[0];
  if (!first?.hash) throw new Error(`adimages upload returned no hash: ${JSON.stringify(data).slice(0, 300)}`);
  return first.hash;
}

export async function createImageCreative({ name, imageHash, primaryText, headline, description, link, urlTags }) {
  const objectStorySpec = {
    page_id: config.meta.pageId,
    link_data: {
      link,
      message: primaryText,
      name: headline,
      description,
      image_hash: imageHash,
      // CTA comes from the offer: SHOP_NOW sells a checkout, LEARN_MORE opens a
      // gated prepare-then-book page. Wrong verb kills a lead ad.
      call_to_action: { type: config.offer.cta || "LEARN_MORE", value: { link } },
    },
  };
  const data = await graph("POST", `/${config.meta.accountId}/adcreatives`, {
    body: {
      name,
      object_story_spec: JSON.stringify(objectStorySpec),
      ...(urlTags ? { url_tags: urlTags } : {}),
    },
  });
  return data.id;
}

export async function createAd({ name, adsetId, creativeId, status = "PAUSED" }) {
  const data = await graph("POST", `/${config.meta.accountId}/ads`, {
    body: { name, adset_id: adsetId, creative: JSON.stringify({ creative_id: creativeId }), status },
  });
  return data.id;
}

export async function setAdStatus(adId, status) {
  return graph("POST", `/${adId}`, { body: { status } });
}

export async function deleteObject(id) {
  return graph("DELETE", `/${id}`);
}
