// The ledger: everyone this claw has ever invited, opened, or spoken with.
//
// ⛔ Cristiano 2026-10-16: "it must always be a real database". The live claw
// uses openDbLedger (Supabase tables linkedin_claw_leads + linkedin_claw_messages)
// and every write is in the database before it returns. createLedger (a file)
// is only for tests and the throwaway dry-run copy.
//
// One slug in here = that person has been touched. Nobody is invited twice and
// nobody gets a second opener. It is written BEFORE anything else after every
// confirmed browser action, and read on every run.

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { slugOf } from './handle.js';

/**
 * The ledger API over any backend. `save(entry, newMessage?)` runs after every
 * change; whatever it returns (a promise for the database) is what each write
 * returns, so callers `await` it and a failed save stops them.
 */
function ledgerOver(entries, save) {
  const get = (who) => entries[slugOf(who)];
  const must = (who) => {
    const e = get(who);
    if (!e) throw new Error(`${slugOf(who)}: not in the ledger`);
    return e;
  };

  return {
    has: (who) => Object.hasOwn(entries, slugOf(who)),
    get,
    all: () => Object.values(entries),
    size: () => Object.keys(entries).length,

    /** A connection request the browser confirmed was sent. */
    recordInvite(who, { at, name = null, headline = null, profileUrl = null, search = null }) {
      const slug = slugOf(who);
      if (entries[slug]) throw new Error(`${slug}: already in the ledger, never invite twice`);
      entries[slug] = { slug, name, headline, profileUrl, search, invitedAt: at, messages: [] };
      return save(entries[slug]);
    },

    /** An existing connection we are about to open (no invite from us). */
    recordExisting(who, { at, name = null, headline = null, recipient }) {
      const slug = slugOf(who);
      if (entries[slug]) throw new Error(`${slug}: already in the ledger`);
      entries[slug] = { slug, name, headline, recipient, existing: true, foundAt: at, messages: [] };
      return save(entries[slug]);
    },

    /** Someone we looked at and will never contact (already connected, ICP miss on the profile...). */
    recordSkip(who, { at, reason, name = null }) {
      const slug = slugOf(who);
      if (entries[slug]) return false;
      entries[slug] = { slug, name, status: 'skipped', reason, at, messages: [] };
      return Promise.resolve(save(entries[slug])).then(() => true);
    },

    markAccepted(who, { at }) {
      const e = must(who);
      if (e.acceptedAt) return undefined;
      e.acceptedAt = at;
      return save(e);
    },

    /** Invite still pending past its shelf life, withdrawn to keep the pending count low. */
    markWithdrawn(who, { at }) {
      const e = must(who);
      e.withdrawnAt = at;
      return save(e);
    },

    /**
     * Every message in the thread, ours and theirs, in order. The sales
     * conversation is drafted from THIS, so it must hold what was actually
     * on screen, not what we meant to send.
     */
    recordMessage(who, { at, from, text, kind = null }) {
      const e = must(who);
      const m = { at, from, text, ...(kind ? { kind } : {}) };
      e.messages = [...(e.messages ?? []), m];
      if (from === 'them') e.replied = true;
      // The record of who THIS claw messaged. Cristiano's own messages are
      // never recorded as ours, so once he owns a thread it stays his.
      if (from === 'us' && kind !== 'history' && e.owner !== 'cristiano') { e.owner = 'claw'; e.clawMessagedAt = at; }
      return save(e, { seq: e.messages.length - 1, m });
    },

    setStage(who, fields) {
      const e = must(who);
      Object.assign(e, fields);
      return save(e);
    },

    /** Invites sent within the last `windowMs`. */
    invitesSince(windowMs, now = Date.now()) {
      const cutoff = +now - windowMs;
      return Object.values(entries).filter((e) => e.invitedAt && Date.parse(e.invitedAt) >= cutoff).length;
    },

    /** Messages WE sent within the last `windowMs`. */
    sentSince(windowMs, now = Date.now()) {
      const cutoff = +now - windowMs;
      let n = 0;
      for (const e of Object.values(entries)) {
        for (const m of e.messages ?? []) if (m.from === 'us' && m.kind !== 'history' && Date.parse(m.at) >= cutoff) n += 1;
      }
      return n;
    },

    firstInviteAt() {
      const ts = Object.values(entries).map((e) => e.invitedAt).filter(Boolean).map(Date.parse);
      return ts.length ? new Date(Math.min(...ts)) : null;
    },
  };
}

/** A JSON file ledger: tests and the dry-run copy only, never the live claw. */
export function createLedger({ path }) {
  let entries = {};
  try { entries = JSON.parse(readFileSync(path, 'utf8')); } catch { entries = {}; }
  return ledgerOver(entries, () => {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(entries, null, 2));
    renameSync(tmp, path); // atomic: a crash mid-write never leaves half a ledger
  });
}

/**
 * The live ledger, in the database. Loads every lead on open (a database that
 * cannot be read throws, so the run stops before touching LinkedIn); each
 * write upserts the lead, then inserts the new message, before returning.
 */
export async function openDbLedger({ store }) {
  const entries = {};
  for (const e of await store.load()) entries[e.slug] = e;
  return ledgerOver(entries, async (e, msg) => {
    await store.saveEntry(e);
    if (msg) await store.addMessage(e.slug, msg.seq, msg.m);
  });
}

/** Supabase over REST with the service-role key (project ladk). */
export function supabaseStore({ url, key, fetchImpl = fetch }) {
  const headers = (prefer) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) });
  const call = async (path, opts = {}) => {
    const res = await fetchImpl(`${url}/rest/v1/${path}`, opts);
    if (!res.ok) throw new Error(`supabase ${path.split('?')[0]} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res;
  };
  return {
    async load() {
      const res = await call('linkedin_claw_leads?select=data&limit=100000', { headers: headers() });
      return (await res.json()).map((r) => r.data);
    },
    async saveEntry(e) {
      const row = {
        slug: e.slug, name: e.name ?? null, headline: e.headline ?? null, owner: e.owner ?? null, status: e.status ?? null,
        invited_at: e.invitedAt ?? null, accepted_at: e.acceptedAt ?? null, claw_messaged_at: e.clawMessagedAt ?? null,
        taken_over_at: e.takenOverAt ?? null, handoff: !!e.handoff, booked_at: e.booked?.start ?? null,
        data: e, updated_at: new Date().toISOString(),
      };
      await call('linkedin_claw_leads?on_conflict=slug', { method: 'POST', headers: headers('resolution=merge-duplicates,return=minimal'), body: JSON.stringify(row) });
    },
    async addMessage(slug, seq, m) {
      const row = { slug, seq, at: m.at, from_side: m.from, by_claw: m.from === 'us' && m.kind !== 'history', kind: m.kind ?? null, text: m.text };
      await call('linkedin_claw_messages?on_conflict=slug,seq', { method: 'POST', headers: headers('resolution=ignore-duplicates,return=minimal'), body: JSON.stringify(row) });
    },
  };
}
