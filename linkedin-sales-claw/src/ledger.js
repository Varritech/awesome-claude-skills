// The ledger: everyone this claw has ever invited, opened, or spoken with.
//
// One slug in here = that person has been touched. Nobody is invited twice and
// nobody gets a second opener. It is written BEFORE anything else after every
// confirmed browser action, and read on every run.

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { slugOf } from './handle.js';

export function createLedger({ path }) {
  let entries = {};
  try { entries = JSON.parse(readFileSync(path, 'utf8')); } catch { entries = {}; }

  const persist = () => {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(entries, null, 2));
    renameSync(tmp, path); // atomic: a crash mid-write never leaves half a ledger
  };
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
      persist();
    },

    /** An existing connection we are about to open (no invite from us). */
    recordExisting(who, { at, name = null, headline = null, recipient }) {
      const slug = slugOf(who);
      if (entries[slug]) throw new Error(`${slug}: already in the ledger`);
      entries[slug] = { slug, name, headline, recipient, existing: true, foundAt: at, messages: [] };
      persist();
    },

    /** Someone we looked at and will never contact (already connected, ICP miss on the profile...). */
    recordSkip(who, { at, reason, name = null }) {
      const slug = slugOf(who);
      if (entries[slug]) return false;
      entries[slug] = { slug, name, status: 'skipped', reason, at, messages: [] };
      persist();
      return true;
    },

    markAccepted(who, { at }) {
      const e = must(who);
      if (!e.acceptedAt) { e.acceptedAt = at; persist(); }
    },

    /** Invite still pending past its shelf life, withdrawn to keep the pending count low. */
    markWithdrawn(who, { at }) {
      const e = must(who);
      e.withdrawnAt = at;
      persist();
    },

    /**
     * Every message in the thread, ours and theirs, in order. The sales
     * conversation is drafted from THIS, so it must hold what was actually
     * on screen, not what we meant to send.
     */
    recordMessage(who, { at, from, text, kind = null }) {
      const e = must(who);
      e.messages = [...(e.messages ?? []), { at, from, text, ...(kind ? { kind } : {}) }];
      if (from === 'them') e.replied = true;
      persist();
    },

    setStage(who, fields) {
      Object.assign(must(who), fields);
      persist();
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
        for (const m of e.messages ?? []) if (m.from === 'us' && Date.parse(m.at) >= cutoff) n += 1;
      }
      return n;
    },

    firstInviteAt() {
      const ts = Object.values(entries).map((e) => e.invitedAt).filter(Boolean).map(Date.parse);
      return ts.length ? new Date(Math.min(...ts)) : null;
    },
  };
}
