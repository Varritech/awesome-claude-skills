// One definition of "the same person". The ledger, the scraper, and the handoff
// must agree byte-for-byte or the never-again rule silently leaks: @Ana from the
// followers list and ana from a likers list would otherwise be two people.
export const normalizeHandle = (handle) =>
  String(handle ?? '').trim().replace(/^@/, '').toLowerCase();
