// Meta publish adapter via Composio REST. Creates a daily test adset under the
// fixed test campaign, builds a creative per ad (video or image), and launches
// PAUSED ads (the gate flips them ACTIVE on approval). Honors the $50/day cap.
import { config } from "../config.js";
import { graph } from "./graph.js";

const BASE = "https://backend.composio.dev/api/v3";

async function execTool(slug, args) {
  const res = await fetch(`${BASE}/tools/execute/${slug}`, {
    method: "POST",
    headers: { "x-api-key": config.composio.apiKey, "content-type": "application/json" },
    body: JSON.stringify({ user_id: config.composio.userId, arguments: args }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.successful === false || json.error) {
    const msg = json.error?.message || json.error || `${res.status}`;
    throw new Error(`Composio ${slug}: ${msg}`);
  }
  return json.data ?? json;
}

// Daily test adset: Purchase-optimized (never LINK_CLICKS — house rule).
//
// ⛔ Created via RAW GRAPH, not Composio's METAADS_CREATE_AD_SET.
//
// That tool failed every run with `(#100) Object with ID '<campaign_id>' does not
// exist, cannot be loaded due to missing permissions, or does not support this
// operation` (subcode 33), and the old comment here read that as a read-limited
// Meta role. It is not a permissions problem: an ad set is created at
// `/act_<account>/adsets` with `campaign_id` in the BODY, and posting to
// `/<campaign_id>/adsets` returns exactly that error. Confirmed by hand against
// this same account on 2026-09-10 — the identical call succeeded the moment the
// endpoint changed. Every other write in graph.js (createAd, createImageCreative,
// uploadImageBytes) already uses this shape and has always worked.
export async function createDailyAdset(dateStr) {
  if (!config.meta.testCampaignId) throw new Error("META_TEST_CAMPAIGN_ID not set");

  // Four ads share one small budget (Cristiano, 2026-09-10). Cap defensively so a
  // bad env value cannot quietly spend more than the test is meant to.
  const capped = Math.min(config.meta.dailyBudgetCapUsd, 50);

  const data = await graph("POST", `/${config.meta.accountId}/adsets`, {
    body: {
      name: `AdFactory ${dateStr} TEST`,
      campaign_id: config.meta.testCampaignId,
      daily_budget: Math.round(capped * 100), // cents
      billing_event: "IMPRESSIONS",
      optimization_goal: "OFFSITE_CONVERSIONS",
      // Raw Graph takes auto-bid without a bid_amount. The old WITH_BID_CAP +
      // bid_amount:5000 pair existed only to satisfy Composio's validator, which
      // demanded a field Meta itself forbids under WITHOUT_CAP.
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      promoted_object: JSON.stringify({
        pixel_id: config.meta.pixelId,
        custom_event_type: "PURCHASE",
      }),
      status: "PAUSED",
      // Meta's own targeting shape, not Composio's flattened locations[] form.
      targeting: JSON.stringify({
        geo_locations: { countries: ["US"] },
        age_min: 22,
        age_max: 65,
        targeting_automation: { advantage_audience: 0 },
      }),
    },
  });
  return data.id;
}

// Video creative. video_id must already be uploaded to the ad account.
export async function createVideoCreative({ name, videoId, thumbUrl, primaryText, headline, description }) {
  const data = await execTool("METAADS_CREATE_AD_CREATIVE", {
    account_id: config.meta.accountId,
    name,
    object_story_spec: {
      page_id: config.meta.pageId,
      video_data: {
        video_id: videoId,
        image_url: thumbUrl,
        title: headline, // Hormozi headline
        message: primaryText, // Hormozi primary
        link_description: description,
        call_to_action: { type: "LEARN_MORE", value: { link: config.offer.url } },
      },
    },
  });
  return data.id || data.creative_id;
}

// Static image creative. imageHash must already be uploaded.
export async function createImageCreative({ name, imageHash, primaryText, headline, description }) {
  const data = await execTool("METAADS_CREATE_AD_CREATIVE", {
    account_id: config.meta.accountId,
    name,
    object_story_spec: {
      page_id: config.meta.pageId,
      link_data: {
        image_hash: imageHash,
        link: config.offer.url,
        message: primaryText,
        name: headline,
        description,
        call_to_action: { type: "LEARN_MORE" },
      },
    },
  });
  return data.id || data.creative_id;
}

export async function createPausedAd({ name, adsetId, creativeId }) {
  const data = await execTool("METAADS_CREATE_AD", {
    account_id: config.meta.accountId,
    name,
    adset_id: adsetId,
    creative: { creative_id: creativeId },
    status: "PAUSED",
  });
  return data.id || data.ad_id;
}

export async function setAdStatus(adId, status) {
  return execTool("METAADS_UPDATE_AD", { ad_id: adId, status });
}
export async function setAdsetStatus(adsetId, status) {
  return execTool("METAADS_UPDATE_AD_SET", { ad_set_id: adsetId, status });
}

// Upload a video/image to the ad account so creatives can reference it.
// Composio exposes these; if a given slug is unavailable in the account's toolkit
// the pipeline records the asset URL and falls back to manual attach.
export async function uploadVideo(fileUrl, name) {
  const data = await execTool("METAADS_CREATE_AD_VIDEO", {
    account_id: config.meta.accountId,
    file_url: fileUrl,
    name,
  });
  return data.id || data.video_id;
}
export async function uploadImage(fileUrl, name) {
  const data = await execTool("METAADS_CREATE_AD_IMAGE", {
    account_id: config.meta.accountId,
    file_url: fileUrl,
    name,
  });
  // image creatives reference a hash, not an id
  return data.hash || data.image_hash || data.images?.[name]?.hash;
}
