# AdFactory Claw

Always-on OpenClaw agent. **Every day** it runs the exact pipeline we do by hand:

1. **Research** — picks the day's replication source / creative angle (rotating swipe pool + Claude re-angle), distinct per variant.
2. **Replicate (video)** — copies the proven frame-matched Remotion template (the `vt-founder-community-C-replica` build), injects fresh footage + copy, generates **Veo3** footage per beat (or falls back to bundled stand-ins), renders **mobile 1080×1920**, and **frame-checks** the render against the source with `skills/framecheck.sh` (the same source-over-render strip + karaoke phrase-boundary gotcha).
3. **Hormozi hook** — writes the on-screen hook + karaoke + end-card CTA **and** the Meta primary/headline/description in Alex Hormozi's direct-response style.
4. **Static ads** — two distinct branded 1080×1350 posters (headless-Chromium screenshot).
5. **Stage to Meta** — creates a fresh daily **test adset** under the existing test campaign, uploads each creative, launches **PAUSED** ads (Purchase-optimized, $50/day cap).
6. **Gate** — emails a preview (posters + frame-check strips + copy) with **Approve & launch / Reject** buttons. Nothing spends until you click. (`AUTONOMY=auto` to skip the gate.)

**Daily output: 2 mobile videos + 2 static ads = 4 ads.**

## Why these pieces

- Reuses the shipped skills: `viral-content-mining` (source pool), `ad-replication` + `framecheck.sh` (build + verify), `meta-ads-manager` patterns (publish), Hormozi copy rules.
- Same runtime shape as `adwatch-claw` (Cloud Run + Scheduler). AdWatch then monitors + auto-kills the losers — AdFactory feeds it fresh creative. They pair.

## Deploy (Cloud Run + Scheduler)

```bash
# 1. one-time: mint a Veo OAuth refresh token (Cloud Run can't run gcloud as you)
GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... npm run mint-veo-token

# 2. build + deploy
gcloud run deploy adfactory-claw --source . --region us-central1 \
  --memory 4Gi --cpu 4 --timeout 3600 --no-cpu-throttling \
  --set-env-vars "$(grep -v '^#' .env | xargs | sed 's/ /,/g')"

# 3. daily trigger (8am ET). /run returns immediately; build runs async.
gcloud scheduler jobs create http adfactory-daily \
  --schedule "0 8 * * *" --time-zone "America/New_York" \
  --uri "https://<service-url>/run" --http-method POST \
  --oidc-service-account-email <invoker-sa>

# set PUBLIC_BASE_URL to the deployed service URL so approve links work, then redeploy.
```

## Run once locally

```bash
cp .env.example .env   # fill keys
npm install && (cd template/video && npm install && npx remotion browser ensure)
npm run run-once
```

## Config knobs (.env)

| var | meaning |
|---|---|
| `DAILY_VIDEO_COUNT` / `DAILY_STATIC_COUNT` | mix (default 2 + 2) |
| `AUTONOMY` | `gate` (email preview) or `auto` (launch immediately) |
| `META_TEST_CAMPAIGN_ID` / `META_PAGE_ID` | required to stage to Meta; without them it builds + emails only |
| `DAILY_BUDGET_CAP_USD` | hard cap, default 50 |
| `VEO_ENABLED=false` | skip Veo, use bundled stand-in footage |
| `SWIPE_DIR` | mounted dir of viral source `.mp4`s to frame-match |

## Notes / gotchas

- Veo3 needs a **user-scoped** token, not a service account — hence the offline OAuth refresh-token flow (`scripts/mint-veo-token.mjs`).
- Ads stage **PAUSED**; the only thing that spends is your Approve click (or `AUTONOMY=auto`).
- Meta ad sets are always **Purchase**-optimized (never LINK_CLICKS) per house rule; if Composio can't set the conversion goal, fix the adset once in the UI and reuse `META_TEST_CAMPAIGN_ID`.
- Frame-check phrase-boundary gotcha is baked into `skills/framecheck.sh` (see ad-replication skill).

---

## The daily variant loop (autopilot)

`POST /variants` — its own Cloud Scheduler job, separate from `/run`.

`/run` invents new creative from scratch (research → video → static) and is slow,
expensive and gated. The variant loop only ever makes **small variations of creative
that has already converted**, and ships them into **the ad set that earned the
conversions**. It is cheap, safe to run unattended, and it is the loop that compounds.

### The offer is varritech.com, not the Skills Library

The claw sells **the agency**. Traffic goes to `varritech.com/prepare` — the gated
discovery-call page that shows past work, the Scalewright Method and the whole price
ladder in the open — and the conversion is a booked call, not a checkout.
`offer.goal = "lead"` drives everything downstream: which Meta action counts as a
conversion, which template renders, and what the copywriter is told to sell.

⛔ Two filters have to BOTH hold, and the second is not optional:

1. the ad converted on a **lead** action (`lead` / `complete_registration` / `schedule_total`)
2. its destination link contains `offer.linkMatch` (`/prepare`)

Without #2 the lead filter matches the **Skills checkout**, which fires
`CompleteRegistration` in volume — a live run scored the Skills V2 Ship ad at *85
conversions* and would have shipped agency variants straight into the Skills ad sets.

⛔ **The MRR guarantee never goes on a creative.** Its only permitted wording is
"if you're not at $10,000 MRR six months after launch, we keep working free until you
are" — two clauses that do not survive being squeezed into a badge, and the truncated
version ("$10K MRR guaranteed") is simultaneously an income claim and a
misrepresentation of a signed agreement. The unconditional triple guarantee is short
enough to render honestly, so that is what the template carries.

### What one cycle does

1. **Retire first, add second.** Pauses its own variants that have spent
   `VARIANTS_RETIRE_SPEND_USD` with zero attributed purchases. The live variant count
   stays flat instead of growing every day.
2. **Find the earners.** 90-day ad-level insights → static image ads with attributed
   conversions **for this offer** → keep only those whose ad set is **live right now**.
   Ranked by cost per conversion, not raw count.

   ⚠️ As of 2026-08-21 this is **empty**: every varritech.com campaign on the account
   is PAUSED, so the loop no-ops and says so. It will not stand up an ad set to fix
   that — creating one is a spend decision. Activate an agency ad set, or name the
   live one with `VARIANTS_TARGET_ADSET_ID`.
3. **Learn.** Ranks its own past variants in PostHog by conversion signal, attributed
   through `utm_content={{ad.id}}`. Winners and proven non-converters both go into the
   copy prompt: repeat what worked, never restate a losing angle.
4. **Write.** Claude with a Hormozi system prompt produces N variants, each changing
   exactly **one lever** (hook / price-frame / proof / guarantee / pain) so the test is
   readable.
5. **Render.** The variant's copy is poured into the same `.dc.html` templates authored
   in Claude Design (`template/statics/`), screenshotted at 1080×1350 @2x = **2160×2700**,
   matching every control creative on the account exactly.
6. **Ship.** Uploads the image, builds a creative with the full `object_story_spec`
   (headline + description + CTA, which the first-class Composio tools cannot express),
   and creates the ad **in the earning ad set**.

### The two rules it will not break

- ⛔ **Never duplicate a winner into a new campaign or ad set.** On 2026-08-17 the winners
  were copied into a fresh `WINNERS Consolidated` ad set at $300/day: the copy burned $309
  for 0 purchases while the starved original took $28, three days after the pair earned
  $493 on $99. A copied ad is a new ad id with zero conversion history inside an ad set
  with zero optimization record. Variants are **added** to the earning ad set. Never a new
  ad set, never a budget change.
- ⛔ **Conversion volume is the constraint, not money.** At ~4 purchases/week the optimizer
  cannot separate signal from noise, and flooding an earning ad set with zero-history
  creative triggers Meta's front-runner bias against the proven ad. Hence
  `VARIANTS_MAX_NEW_PER_ADSET=1` and `VARIANTS_MAX_LIVE_PER_ADSET=4`. Trickle, not firehose.

Safety rail: the loop can only ever pause an ad whose name starts with `Ad | AUTO |`,
which only it creates. It cannot touch a human-made ad, whatever the numbers say.

### The write path

`src/lib/graph.js` reaches the raw Meta Graph API **headlessly**, via Composio's proxy
tool, with nothing but `COMPOSIO_API_KEY`:

```
POST /api/v3/tools/execute/proxy  { connected_account_id, endpoint, method, body }
```

Proven 2026-08-21: a creative was created and deleted from a plain curl with no MCP
session and no Meta System User token. The long-standing "headless Meta writes are blocked
on an `ads_management` grant" note does **not** apply on this path.

⛔ `endpoint` must not carry the `/vXX.0/` prefix — the proxy prepends the version.

### The conversion signal

`GET /signal` reports which signal the ranking is actually using.

PostHog project 489511 has **never recorded a `Purchase` event** — the LP's
`finalizeSuccess()` called `fbq` directly and never `posthog.capture`. Ranking copy on
`Purchase` would silently rank everything at zero, which reads exactly like "no copy
works". So the loop uses a tiered signal and says which tier it got:

| tier | why |
|---|---|
| `Purchase` | real revenue — once vds-marketing-core#453 lands |
| `lp_buyer_signature` | clicks≥3 AND page_loads≥2. Catches 9/9 buyers at 24.8x lift, ~36/wk. Best proxy that exists today |
| `AddPaymentInfo` | 90x lift but ~10/wk, too sparse to rank on alone |
| `InitiateCheckout` | noisy floor, last resort |

### Rendering gotcha

⛔ Render over `http://127.0.0.1`, never `file://`. A `file://` page comes back **pure
white**: the stylesheet and Google Fonts never resolve under the headless shell's
file-origin rules, and `--virtual-time-budget` fires the screenshot on an unstyled page.
It fails silently — a valid 2160×2700 PNG of nothing. `renderVariant` serves the work dir
over loopback and refuses to ship any render under 120KB.
