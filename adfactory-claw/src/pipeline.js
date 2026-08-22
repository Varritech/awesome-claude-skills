// The daily run: research -> hook -> build (2 video + 2 static) -> stage to Meta
// (paused) -> gate (email preview) OR auto-launch. Idempotent per batch id (date).
import { config } from "./config.js";
import { research } from "./stages/research.js";
import { writeCopy } from "./stages/hook.js";
import { buildVideo } from "./stages/build-video.js";
import { buildStatic } from "./stages/build-static.js";
import { stageToMeta, goLive } from "./stages/launch.js";
import { sendPreview, sendLaunchedReport } from "./stages/preview.js";
import { runVariantCycle } from "./stages/variants.js";
import { saveBatch, loadBatch } from "./lib/state.js";

const dateStr = (d = new Date()) => d.toISOString().slice(0, 10);
const dayIndex = () => Math.floor(Date.now() / 86_400_000);

export async function runDaily({ batchId = dateStr() } = {}) {
  const existing = await loadBatch(batchId);
  if (existing && existing.ads?.length) {
    console.log(`[pipeline] batch ${batchId} already built; skipping rebuild`);
    return existing;
  }

  const di = dayIndex();
  const ads = [];

  // VIDEOS
  for (let v = 0; v < config.counts.video; v++) {
    const plan = await research({ dayIndex: di, variant: v });
    const copy = await writeCopy({ angle: plan.angle, beats: plan.beats, kind: "video" });
    const built = await buildVideo({ batchId, variant: v, plan, copy });
    ads.push(built);
  }

  // STATICS
  for (let v = 0; v < config.counts.static; v++) {
    const plan = await research({ dayIndex: di, variant: v + 100 }); // distinct angle space
    const copy = await writeCopy({ angle: plan.angle, beats: plan.beats, kind: "static" });
    const built = await buildStatic({ batchId, variant: v, copy });
    ads.push(built);
  }

  // stage to Meta (paused)
  const staged = await stageToMeta({ batchId, ads });
  const batch = {
    id: batchId,
    builtAt: new Date().toISOString(),
    adsetId: staged.adsetId || null,
    staged: staged.staged,
    ads: staged.ads || ads,
    status: "pending",
  };
  await saveBatch(batch);

  if (config.autonomy === "auto") {
    return approveBatch(batchId);
  }
  await sendPreview({ batch });
  console.log(`[pipeline] batch ${batchId} built + preview emailed (gated)`);
  return batch;
}

export async function approveBatch(batchId) {
  const batch = await loadBatch(batchId);
  if (!batch) throw new Error(`batch ${batchId} not found`);
  if (batch.status === "live") return batch;
  const liveIds = batch.staged ? await goLive(batch) : [];
  batch.status = "live";
  batch.liveIds = liveIds;
  batch.launchedAt = new Date().toISOString();
  await saveBatch(batch);
  await sendLaunchedReport({ batch, liveIds });
  return batch;
}

/**
 * The daily variant run — separate from runDaily() on purpose.
 *
 * runDaily() invents NEW creative from scratch (research -> video -> static) and is
 * a slow, expensive, gated pipeline. This one only ever makes small variations of
 * creative that has ALREADY produced sales, and ships them into the ad set that
 * earned them. It is cheap, it is safe to run unattended, and it is the loop that
 * actually compounds — so it gets its own schedule and its own state key.
 */
export async function runVariants({ batchId = `var-${dateStr()}`, dryRun = false } = {}) {
  const existing = await loadBatch(batchId);
  if (existing && existing.shipped?.length) {
    console.log(`[variants] ${batchId} already ran; skipping`);
    return existing;
  }
  const result = await runVariantCycle({ batchId, dryRun });
  const batch = {
    id: batchId,
    kind: "variants",
    builtAt: new Date().toISOString(),
    status: config.autonomy === "auto" ? "live" : "pending",
    ...result,
  };
  if (!dryRun) await saveBatch(batch);
  console.log(
    `[variants] ${batchId}: ${result.shipped.filter((s) => s.adId).length} shipped, ` +
      `${result.retired.length} retired, signal=${result.learning?.health?.rankingSignal || "none"}`,
  );
  return batch;
}

export async function rejectBatch(batchId) {
  const batch = await loadBatch(batchId);
  if (!batch) throw new Error(`batch ${batchId} not found`);
  batch.status = "rejected";
  await saveBatch(batch);
  return batch;
}
