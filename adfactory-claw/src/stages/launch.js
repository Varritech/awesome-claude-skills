// STAGE 5 — Publish the batch to Meta as PAUSED ads under a fresh daily test adset.
// Called at build time to stage everything; the approve gate flips ACTIVE later.
// If Meta upload tools are unavailable in the account toolkit, records the asset
// URLs and marks needsManualAttach so the email tells you to attach by hand.
import { config } from "../config.js";
import * as meta from "../lib/meta.js";

export async function stageToMeta({ batchId, ads }) {
  if (!config.meta.testCampaignId || !config.meta.pageId) {
    return { staged: false, reason: "META_TEST_CAMPAIGN_ID / META_PAGE_ID not set", ads };
  }
  // Meta staging is BEST-EFFORT: Composio's REST tool-execute runs metaads writes
  // under a read-limited Meta role (code 100/33 on CREATE_AD_SET) even though MCP
  // can write. If staging fails, the batch + assets are still saved and the preview
  // still emails — flagged so the ads get attached via MCP/UI on approval.
  let adsetId;
  try {
    adsetId = await meta.createDailyAdset(batchId);
  } catch (e) {
    console.error("[launch] adset create failed (REST write perms):", e.message);
    return { staged: false, reason: `Meta adset create failed: ${e.message}`, ads };
  }
  const out = [];
  for (const ad of ads) {
    try {
      let creativeId, metaAdId;
      if (ad.kind === "video") {
        const videoId = await meta.uploadVideo(ad.mp4Url, `adfactory-${batchId}-v${ad.variant}`);
        creativeId = await meta.createVideoCreative({
          name: `AF ${batchId} video ${ad.variant}`,
          videoId,
          thumbUrl: ad.posterUrl,
          primaryText: ad.copy.meta.primaryText,
          headline: ad.copy.meta.headline,
          description: ad.copy.meta.description,
        });
      } else {
        const imageHash = await meta.uploadImage(ad.imageUrl, `adfactory-${batchId}-s${ad.variant}`);
        creativeId = await meta.createImageCreative({
          name: `AF ${batchId} static ${ad.variant}`,
          imageHash,
          primaryText: ad.copy.meta.primaryText,
          headline: ad.copy.meta.headline,
          description: ad.copy.meta.description,
        });
      }
      metaAdId = await meta.createPausedAd({
        name: `AF ${batchId} ${ad.kind} ${ad.variant}`,
        adsetId,
        creativeId,
      });
      out.push({ ...ad, adsetId, creativeId, metaAdId, staged: true });
    } catch (e) {
      console.error(`[launch] stage failed for ${ad.kind} ${ad.variant}:`, e.message);
      out.push({ ...ad, adsetId, staged: false, needsManualAttach: true, error: e.message });
    }
  }
  return { staged: true, adsetId, ads: out };
}

// Flip the whole staged batch live (adset + ads -> ACTIVE), respecting the cap.
export async function goLive(batch) {
  if (!batch.adsetId) throw new Error("batch not staged to Meta");
  await meta.setAdsetStatus(batch.adsetId, "ACTIVE");
  const results = [];
  for (const ad of batch.ads) {
    if (!ad.metaAdId) continue;
    await meta.setAdStatus(ad.metaAdId, "ACTIVE");
    results.push(ad.metaAdId);
  }
  return results;
}
