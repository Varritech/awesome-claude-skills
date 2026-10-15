// One run of the claw, in four rounds. Every external effect goes through the
// injected `browser`, so the whole path is tested without LinkedIn.
//
// The rules that keep Cristiano's account and reputation safe live here:
//   - only ICP strangers get invited, within the daily ramp;
//   - only people THIS claw invited ever get a message (his inbox holds client
//     threads, disputes and partners; none of them may be touched);
//   - a send counts only once the browser has read it back in the thread;
//   - a reply or a handoff ends automated follow-ups for good.

import { matchesIcp } from './prospects.js';
import { connectBudget } from './budget.js';
import { openerFor, followUpFor, inviteNoteFor, openerExistingFor } from './copy.js';
import { draftReply } from './sales.js';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
export const FOLLOW_UP_DAYS = [3, 7];

function messageBudget(ledger, rate, now) {
  if (!rate?.perHour) return Infinity;
  return Math.max(0, rate.perHour - ledger.sentSince(HOUR, now));
}

const isoNow = (now) => new Date(now).toISOString();

export async function inviteRound({ ledger, browser, now = new Date(), searches, exclude = [], maxPages = 3, dailyCap = null }) {
  const budget = connectBudget({ ledger, now, dailyCap });
  const out = { budget, invited: [], error: null };
  if (budget <= 0 || !searches?.length) return out;
  const skip = new Set(exclude.map((s) => s.toLowerCase()));
  const tried = new Set(); // one attempt per person per run, even if they show up on every page

  for (const search of searches) {
    for (let page = 1; page <= maxPages && out.invited.length < budget; page++) {
      const rows = await browser.searchPage(search, page);
      if (!rows.length) break;
      const fresh = rows.filter((r) => r.canConnect && matchesIcp(r) && !ledger.has(r.slug) && !skip.has(r.slug) && !tried.has(r.slug));
      for (const r of fresh) {
        if (out.invited.length >= budget) break;
        tried.add(r.slug);
        // The note rides with the request while LinkedIn's monthly note
        // allowance lasts; past it the request goes plain and the opener on
        // accept carries the message instead.
        const note = inviteNoteFor({ name: r.name });
        let res;
        try {
          res = await browser.sendInvite(r.slug, { note });
        } catch (err) {
          out.error = String(err?.message ?? err);
          return out; // a limit/checkpoint: stop the round, never retry in a loop
        }
        const ok = res === true || res?.ok === true;
        if (!ok) continue;
        const noted = res === true ? false : !!res.noted;
        ledger.recordInvite(r.slug, { at: isoNow(now), name: r.name, headline: r.headline, search });
        ledger.setStage(r.slug, { inviteNote: noted ? note : null });
        out.invited.push(r.slug);
      }
    }
    if (out.invited.length >= budget) break;
  }
  return out;
}

export async function acceptRound({ ledger, browser, now = new Date(), rate }) {
  const out = { accepted: [], opened: [], error: null };
  const pending = ledger.all().filter((e) => e.invitedAt && !e.acceptedAt);
  const unopened = () => ledger.all().filter((e) => e.acceptedAt && e.recipient && !(e.messages ?? []).length && !e.handoff);
  if (!pending.length && !unopened().length) return out;

  if (pending.length) {
    for (const c of await browser.connections()) {
      const e = ledger.get(c.slug);
      // Only rows we invited. A connection that is not in the ledger as an
      // invite is someone Cristiano already knows: never touched.
      if (!e || !e.invitedAt || e.acceptedAt) continue;
      ledger.markAccepted(c.slug, { at: isoNow(now) });
      ledger.setStage(c.slug, { recipient: c.recipient ?? null, ...(e.name ? {} : { name: c.name }) });
      out.accepted.push(c.slug);
    }
  }

  let left = messageBudget(ledger, rate, now);
  for (const e of unopened()) {
    if (left <= 0) break;
    const text = openerFor({ name: e.name });
    try {
      if (!(await browser.sendMessage({ slug: e.slug, recipient: e.recipient, name: e.name, text }))) continue;
    } catch (err) {
      out.error = String(err?.message ?? err);
      break;
    }
    ledger.recordMessage(e.slug, { at: isoNow(now), from: 'us', text, kind: 'opener' });
    out.opened.push(e.slug);
    left -= 1;
  }
  return out;
}

/** Folds the live thread into the ledger. Returns the messages from them we had not seen. */
function syncThread(ledger, slug, thread, now) {
  const e = ledger.get(slug);
  const knownTheirs = (e.messages ?? []).filter((m) => m.from === 'them').length;
  const theirs = thread.filter((m) => m.from === 'them');
  const fresh = theirs.slice(knownTheirs);
  for (const m of fresh) ledger.recordMessage(slug, { at: isoNow(now), from: 'them', text: m.text });
  return fresh;
}

export async function followUpRound({ ledger, browser, now = new Date(), rate }) {
  const out = { sent: [], error: null };
  let left = messageBudget(ledger, rate, now);
  const due = [];
  for (const e of ledger.all()) {
    if (!e.recipient || e.replied || e.handoff || e.closed) continue;
    const ours = (e.messages ?? []).filter((m) => m.from === 'us');
    if (!ours.length) continue;
    const knocks = ours.filter((m) => /^followup-/.test(m.kind ?? '')).length;
    if (knocks >= FOLLOW_UP_DAYS.length) continue;
    const last = Date.parse(ours.at(-1).at);
    if (+now - last < FOLLOW_UP_DAYS[knocks] * DAY) continue;
    due.push({ e, number: knocks + 1, silent: +now - last });
  }
  due.sort((a, b) => b.silent - a.silent);

  for (const { e, number } of due) {
    if (left <= 0) break;
    // Look before knocking: a reply LinkedIn shows us beats our ledger.
    let thread;
    try {
      thread = await browser.readThread({ slug: e.slug, recipient: e.recipient, name: e.name });
    } catch (err) {
      // A thread that will not open is not a quiet thread: never knock blind.
      // Skip this person; a signed-out/frozen session still fails every one.
      out.error = String(err?.message ?? err);
      if (/signed out|checkpoint|DevTools|frozen/i.test(out.error)) break;
      continue;
    }
    const fresh = syncThread(ledger, e.slug, thread, now);
    if (fresh.length) continue;
    const text = followUpFor({ name: e.name, number });
    try {
      if (!(await browser.sendMessage({ slug: e.slug, recipient: e.recipient, name: e.name, text }))) continue;
    } catch (err) {
      out.error = String(err?.message ?? err);
      break;
    }
    ledger.recordMessage(e.slug, { at: isoNow(now), from: 'us', text, kind: `followup-${number}` });
    out.sent.push(e.slug);
    left -= 1;
  }
  return out;
}

export async function replyRound({ ledger, browser, llm, now = new Date(), rate, maxThreads = 15, activeDays = 45 }) {
  const out = { replied: [], handoffs: [], held: [], error: null };
  let left = messageBudget(ledger, rate, now);
  const active = ledger.all()
    .filter((e) => e.recipient && !e.handoff && !e.closed && (e.messages ?? []).some((m) => m.from === 'us'))
    .filter((e) => +now - Date.parse(e.messages.at(-1).at) < activeDays * DAY)
    .sort((a, b) => Date.parse(a.lastCheckedAt ?? 0) - Date.parse(b.lastCheckedAt ?? 0))
    .slice(0, maxThreads);

  for (const e of active) {
    if (left <= 0) break;
    let thread;
    try {
      thread = await browser.readThread({ slug: e.slug, recipient: e.recipient, name: e.name });
    } catch (err) {
      out.error = String(err?.message ?? err);
      if (/signed out|checkpoint|DevTools|frozen/i.test(out.error)) break;
      continue;
    }
    ledger.setStage(e.slug, { lastCheckedAt: isoNow(now) });
    syncThread(ledger, e.slug, thread, now);
    if (thread.at(-1)?.from !== 'them') continue;

    const draft = await draftReply({ lead: ledger.get(e.slug), llm });
    if (draft.action === 'handoff') {
      ledger.setStage(e.slug, { handoff: true, handoffReason: draft.reason, handoffAt: isoNow(now) });
      out.handoffs.push({ slug: e.slug, reason: draft.reason });
      continue;
    }
    if (draft.action !== 'send') { out.held.push({ slug: e.slug, reason: draft.reason }); continue; }
    try {
      if (!(await browser.sendMessage({ slug: e.slug, recipient: e.recipient, name: e.name, text: draft.text }))) continue;
    } catch (err) {
      out.error = String(err?.message ?? err);
      break;
    }
    ledger.recordMessage(e.slug, { at: isoNow(now), from: 'us', text: draft.text, kind: 'reply' });
    if (draft.qualified !== null) ledger.setStage(e.slug, { qualified: draft.qualified });
    out.replied.push(e.slug);
    left -= 1;
  }
  return out;
}

/**
 * People ALREADY connected with Cristiano who look like owners. Opened only if
 * there has never been a message between them: an existing thread means a
 * client, partner or friend (his inbox holds client disputes), so it is
 * recorded as skipped and never touched again.
 */
export async function existingRound({ ledger, browser, now = new Date(), rate, searches, cursor, dailyCap = 20, maxPages = 5 }) {
  const out = { messaged: [], skipped: [], error: null };
  if (!searches?.length || !dailyCap) return out;
  const sentToday = ledger.all().reduce((n, e) => n + (e.messages ?? [])
    .filter((m) => m.kind === 'opener-existing' && +now - Date.parse(m.at) < DAY).length, 0);
  let left = Math.min(dailyCap - sentToday, messageBudget(ledger, rate, now));
  if (left <= 0) return out;

  let { search = 0, page = 1 } = cursor.get() ?? {};
  for (let loaded = 0; loaded < maxPages && left > 0; loaded++) {
    if (search >= searches.length) { search = 0; page = 1; }
    const rows = await browser.searchPage(searches[search], page);
    if (!rows.length) { search += 1; page = 1; cursor.set({ search, page }); continue; }
    const fresh = rows.filter((r) => r.degree === '1st' && r.recipient && matchesIcp(r) && !ledger.has(r.slug));
    for (const r of fresh) {
      if (left <= 0) break;
      // ⛔ 2026-10-15: an unloaded pane read as "no history" and Anshul, an
      // existing contact, was queued for a cold pitch. Only a thread that
      // visibly loaded for THIS person counts as empty; anything else = skip
      // this run, record nothing, try again next run.
      let thread;
      try {
        thread = await browser.readThread({ slug: r.slug, recipient: r.recipient, name: r.name });
      } catch {
        continue;
      }
      if (thread.length) {
        ledger.recordSkip(r.slug, { at: isoNow(now), reason: 'existing-thread', name: r.name });
        out.skipped.push(r.slug);
        continue;
      }
      const text = openerExistingFor({ name: r.name });
      try {
        if (!(await browser.sendMessage({ slug: r.slug, recipient: r.recipient, name: r.name, text }))) continue;
      } catch (err) {
        out.error = String(err?.message ?? err);
        cursor.set({ search, page });
        return out;
      }
      ledger.recordExisting(r.slug, { at: isoNow(now), name: r.name, headline: r.headline, recipient: r.recipient });
      ledger.recordMessage(r.slug, { at: isoNow(now), from: 'us', text, kind: 'opener-existing' });
      out.messaged.push(r.slug);
      left -= 1;
    }
    // Page fully handled (nobody new left on it) -> move on next time.
    if (left > 0) page += 1;
    cursor.set({ search, page });
  }
  return out;
}
