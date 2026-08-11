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

// Assembled 2026-08-10 from every person ever associated with the Varritech
// Founder Ecosystem (37 distinct), then narrowed by explicit instruction.
// Sources: the #varritech-founder-ecosystem Slack roster + its join/leave
// timeline, the channel's pinned welcome post, and the Supabase
// `community_invites` join-form table.
export const SCALEWRIGHT_INNER_CIRCLE = [
  // Invited founders who never joined Slack
  'angus@vulcan-adv.com',              // Angus McLaughlin — LazyChef / Vulcan Advisory
  'fernan_violinist@yahoo.com',        // Fernando — Supreme
  'thebizhive@proton.me',              // Zack — Varto
  'georgie@troublemaker-studio.com',   // Georgie — ffreya / Troublemaker Studio

  // Added by hand from HubSpot (never Founder Ecosystem members)
  'info@panaceacorporatewellness.com', // Magnolia Sarshar — Panacea Corporate Wellness
  'theadkinsgroup@outlook.com',        // Mickey Adkins — The Adkins Group

  // Current Slack members (external founders only — Varritech staff excluded)
  'cjtufano@getcherrypicker.com',      // CJ Tufano — Cherrypicker
  'contact@thecohive.com',             // Chiamaka — CoHive
  'jitka@portabletenant.com',          // Jitka — Portable Tenant
  'guyriches28@gmail.com',             // Guy Riches — ffreya
  'kareem663@gmail.com',               // Kareem Maize — ConvergeFlow
  'carroll.denzel@yahoo.com',          // Denzel Carroll — Renaissance

  // Former Slack members (joined at one point, since left)
  'mark@neuronovaeducation.org',       // Mark — NeuroNova
  'leonardovinciguerra1998@gmail.com', // Leonardo Vinciguerra — Aldara
  'tyron@thunderinc.info',             // Tyron — Fiesta by Thunder
  'am@innovasol.co.uk',                // Ali — Innovasol / PilotsLogAI
  'admin@drpksolutions.com',           // PKCS LLC — Priscilla Kucer Consulting
  'mehul.patel@pathogensai.com',       // Dr Mehul Patel — PathogensAI
  'erick@ucentered.co.uk',             // Erick M — Ucentered
  'daresanusi@gmail.com',              // Daniel Sanusi — VOX
  'nayyaroz@gmail.com',                // nayyaroz
  'ikeudeokoro@gmail.com',             // Ike Udeokoro — Notove AI
  'principalaisystemsarchitect@gmail.com', // "Ai Systems Architect"

  // Applied through the /community join form (community_invites)
  'dhoods31@gmail.com',                // Alex
  'ceo@praxia.ch',                     // Charlie — Praxia
  'erik.huber@reelworld.com',          // Erik Huber — Reelworld
  'jayar@j2-i.com',                    // Jay-Ar Jamon — J2i
];

// ⛔ Removed on explicit instruction — do NOT reinstate without asking:
//   Laniel `llanauxjr@hotmail.com` + Hannah Melotto `hannah.melotto@melottogroup.com`
//     (both applied for tier=scalewright_circle; dropped 2026-08-10)
//   Lehlohonolo `sefakolucy854@gmail.com`, Nicole Moxey `moxiclear8@gmail.com`,
//     Nathan Hill `idea.atm2346@gmail.com` (join-form applicants, dropped 2026-08-11)
//   Walson (Phleekz) — no email ever looked up
//   Greg / Gregory Hill (TutorAssist) `greghillgb@gmail.com` — open £23k billing dispute
// Also absent by design: Varritech staff (christian@, jake@, guido@, johaimalin@),
// ryan/Parkplan (former member, email unrecoverable), and the junk community_invites
// rows (t@t.com, "Scammer", diag/probe addresses).

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
