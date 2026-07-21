/**
 * US-only lead filtering.
 *
 * Cristiano wants all leads pulled from American sources for now. We pass
 * location="United States" to the provider as a query constraint, but we also
 * post-filter results as a safety net — provider data is messy and sometimes
 * tagged with a US city but a non-US country, or vice versa.
 */

// 50 state abbreviations + DC + territories commonly grouped with US lead data.
const US_STATE_ABBRS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY','DC','PR',
]);

const US_STATE_NAMES: readonly string[] = [
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
  'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
  'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
  'minnesota','mississippi','missouri','montana','nebraska','nevada','new hampshire',
  'new jersey','new mexico','new york','north carolina','north dakota','ohio',
  'oklahoma','oregon','pennsylvania','rhode island','south carolina','south dakota',
  'tennessee','texas','utah','vermont','virginia','washington','west virginia',
  'wisconsin','wyoming',
  'district of columbia', 'puerto rico',
];

/** True if a free-text location string indicates the United States. */
export function isUsLocation(location: string | undefined | null): boolean {
  if (!location) return false;
  const loc = location.trim();
  if (!loc) return false;
  const lower = loc.toLowerCase();

  if (/(united states|^usa\b|\busa\b|u\.s\.a?\.?|\bamerica\b)/i.test(loc)) return true;

  // "City, ST" or trailing "ST" token.
  const tail = loc.split(',').pop()?.trim() ?? '';
  if (US_STATE_ABBRS.has(tail.toUpperCase())) return true;

  // Full state name anywhere in the string.
  for (const name of US_STATE_NAMES) {
    if (lower.includes(name)) return true;
  }
  return false;
}

/** Keep only leads whose location is in the US. Preserves order. */
export function filterUsOnly<T extends { location?: string }>(leads: T[]): T[] {
  return leads.filter((l) => isUsLocation(l.location));
}