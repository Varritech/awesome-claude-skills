export const config = () => ({
  statePath: process.env.CLAW_STATE || new URL('../state/contacted.json', import.meta.url).pathname,
  cap: Number(process.env.HOURLY_CAP ?? 6),
  killSwitch: process.env.KILL_SWITCH === '1',
  timeZone: process.env.CLAW_TZ || 'America/New_York',
  startHour: Number(process.env.START_HOUR ?? 9),
  endHour: Number(process.env.END_HOUR ?? 20),
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.CLAW_MODEL || 'claude-sonnet-5',
  firestoreCollectionPrefix: process.env.FS_PREFIX || '',
  project: process.env.GOOGLE_CLOUD_PROJECT || 'varritech-dev',
});
