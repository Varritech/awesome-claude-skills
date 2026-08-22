// Central config — all from env. No secrets in code.
const env = process.env;

export const config = {
  // identity
  clawId: env.CLAW_ID || "adfactory",

  // creative subject (fixed per the engagement): Skills Library offer
  offer: {
    name: env.OFFER_NAME || "Claude Code Skills Library",
    pitch:
      env.OFFER_PITCH ||
      "70+ production Claude Code skills that turn one prompt into shipped work — ads, apps, audits, outreach.",
    url: env.OFFER_URL || "https://varritech.com/products/claude-skills-library-pro",
    brand: {
      // skills brand = Varritech chartreuse/indigo (same palette as the C-replica)
      accent: env.BRAND_ACCENT || "#99FF32",
      indigoDeep: env.BRAND_INDIGO_DEEP || "#190336",
      electricIndigo: env.BRAND_ELECTRIC || "#8638EE",
      font: env.BRAND_FONT || "Chakra Petch",
      logoUrl: env.BRAND_LOGO_URL || "",
    },
  },

  // what to mine each day (niche slug for viral-content-mining)
  niche: env.MINING_NICHE || "claude-code-skills",

  // daily output mix
  counts: {
    video: Number(env.DAILY_VIDEO_COUNT || 2),
    static: Number(env.DAILY_STATIC_COUNT || 2),
  },

  // Meta
  meta: {
    accountId: env.META_AD_ACCOUNT_ID || "act_1058527832767816",
    pixelId: env.META_PIXEL_ID || "1575933943079817",
    pageId: env.META_PAGE_ID || "",
    // the existing test campaign these creatives join (one test campaign, new adset/day)
    testCampaignId: env.META_TEST_CAMPAIGN_ID || "",
    dailyBudgetCapUsd: Number(env.DAILY_BUDGET_CAP_USD || 50),
    // Composio connected-account id for the raw-Graph proxy path (src/lib/graph.js).
    // Optional — graph.js resolves the ACTIVE metaads connection when this is blank.
    connectedAccountId: env.META_CONNECTED_ACCOUNT_ID || "",
  },

  // PostHog — the variant loop's feedback signal. Project 489511 = varritech /
  // Claude Skills Library funnel.
  posthog: {
    apiKey: env.POSTHOG_API_KEY || "",
    projectId: env.POSTHOG_PROJECT_ID || "489511",
  },

  // approval: 'gate' (email preview, wait for go) | 'auto' (launch immediately)
  autonomy: env.AUTONOMY || "gate",
  // signed approve/reject links point back here
  publicBaseUrl: env.PUBLIC_BASE_URL || "",
  approveSecret: env.APPROVE_SECRET || "change-me",

  // GCS asset library
  gcs: {
    bucket: env.GCS_BUCKET || "varritech-public-assets",
    prefix: env.GCS_PREFIX || "videos/adfactory",
    publicBase: "https://storage.googleapis.com",
  },

  // Veo3 (Vertex) — offline OAuth refresh token (Cloud Run can't run gcloud as the user)
  veo: {
    project: env.VEO_PROJECT || "varribrain",
    location: env.VEO_LOCATION || "us-central1",
    model: env.VEO_MODEL || "veo-3.0-generate-001",
    // OAuth installed-app creds + refresh token minted once locally
    clientId: env.GOOGLE_OAUTH_CLIENT_ID || "",
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET || "",
    refreshToken: env.GOOGLE_OAUTH_REFRESH_TOKEN || "",
    // if Veo unavailable, fall back to code-built stand-in backgrounds (still ships an ad)
    enabled: env.VEO_ENABLED !== "false",
  },

  // ElevenLabs VO (Liam) for the video ads
  eleven: {
    apiKey: env.ELEVENLABS_API_KEY || "",
    voiceId: env.ELEVEN_VOICE_ID || "TX3LPaxmHKxFdv7VOQHJ", // Liam
  },

  // Composio (Meta create/act)
  composio: {
    apiKey: env.COMPOSIO_API_KEY || "",
    userId: env.COMPOSIO_USER_ID || "default",
  },

  // Claude
  anthropic: {
    apiKey: env.ANTHROPIC_API_KEY || "",
    model: env.CLAW_MODEL || "claude-opus-4-8",
  },

  // email — default Composio GMAIL (reuses Composio key); 'smtp' to use nodemailer
  email: {
    transport: env.EMAIL_TRANSPORT || "composio",
    to: env.OWNER_EMAIL || "christian@varritech.com",
    smtpHost: env.SMTP_HOST || "",
    smtpPort: Number(env.SMTP_PORT || 587),
    smtpSecure: env.SMTP_SECURE === "true",
    smtpUser: env.SMTP_USER || "",
    smtpPass: env.SMTP_PASS || "",
    from: env.SMTP_FROM || "AdFactory Claw <ads@varritech.com>",
  },

  // workspace (ephemeral on Cloud Run; persisted artifacts go to GCS)
  workdir: env.WORKDIR || "/tmp/adfactory",
};

export function missingCritical() {
  const m = [];
  if (!config.anthropic.apiKey) m.push("ANTHROPIC_API_KEY");
  if (!config.composio.apiKey) m.push("COMPOSIO_API_KEY");
  // email uses Composio GMAIL by default (covered by COMPOSIO_API_KEY); SMTP only if chosen
  if (config.email.transport === "smtp" && !config.email.smtpHost)
    m.push("SMTP_HOST (EMAIL_TRANSPORT=smtp)");
  return m;
}
