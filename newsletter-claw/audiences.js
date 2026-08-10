// Newsletter editions. An edition = a named newsletter with its own audience.
//
// "varritech-minute" is the original broadcast: the ~178-lead union assembled by
// loadLeads() (skills buyers + community + playbook leads + the CRM leads table).
//
// "scalewright-inner-circle" is the Scalewright Circle list — hand-picked, static,
// and deliberately NOT derived from the lead tables. These are named people
// Cristiano chose one at a time (2026-08-10); a query that "helpfully" widened it
// would silently turn a private note into a broadcast.
import { loadLeads, mergeLeads } from './leads.js';

export const SCALEWRIGHT_INNER_CIRCLE = [
  'angus@vulcan-adv.com',
  'fernan_violinist@yahoo.com',
  'thebizhive@proton.me',
  'georgie@troublemaker-studio.com',
  'info@panaceacorporatewellness.com',
  'theadkinsgroup@outlook.com',
];

const EDITIONS = {
  'varritech-minute': loadLeads,
  'scalewright-inner-circle': async () => mergeLeads([SCALEWRIGHT_INNER_CIRCLE]),
};

// Subject-line masthead per edition. ⛔ The brand is "Scalewright" — one word,
// lowercase w. Cristiano says "ScaleRight" out loud and the ad files are named
// scaleright-*, but every product (Method / Installation / Managed / Circle) is
// Scalewright. See [[project_scalewright_installation_mrr_guarantee_contract]].
export const MASTHEADS = {
  'varritech-minute': 'Varritech Minute',
  'scalewright-inner-circle': 'Scalewright Inner Circle',
};

export function isEdition(edition) {
  return Object.prototype.hasOwnProperty.call(EDITIONS, edition);
}

export async function loadAudience(edition) {
  // Deliberately no default. Falling back to the broadcast list on a typo
  // ("scaleright-" — the spelling trap) would send a 6-person note to 178 people.
  if (!isEdition(edition)) throw new Error(`unknown edition: ${edition}`);
  return EDITIONS[edition]();
}
