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
import { openerFor, followUpFor } from './copy.js';
import { draftReply } from './sales.js';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
export const FOLLOW_UP_DAYS = [3, 7];

function messageBudget(ledger, rate, now) {
  if (!rate?.perHour) return Infinity;
  return Math.max(0, rate.perHour - ledger.sentSince(HOUR, now));
}

const isoNow = (now) => new Date(now).toISOString();

export async function inviteRound({ ledger, browser, now = new Date(), searches, exclude = [], maxPages = 3 }) {
  const budget = connectBudget({ ledger, now });
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
        try {
          if (!(await browser.sendInvite(r.slug))) continue;
        } catch (err) {
          out.error = String(err?.message ?? err);
          return out; // a limit/checkpoint: stop the round, never retry in a loop
        }
        ledger.recordInvite(r.slug, { at: isoNow(now), name: r.name, headline: r.headline, search });
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
      if (!(await browser.sendMessage({ slug: e.slug, recipient: e.recipient, text }))) continue;
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
    const fresh = syncThread(ledger, e.slug, await browser.readThread({ slug: e.slug, recipient: e.recipient }), now);
    if (fresh.length) continue;
    const text = followUpFor({ name: e.name, number });
    try {
      if (!(await browser.sendMessage({ slug: e.slug, recipient: e.recipient, text }))) continue;
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
    const thread = await browser.readThread({ slug: e.slug, recipient: e.recipient });
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
      if (!(await browser.sendMessage({ slug: e.slug, recipient: e.recipient, text: draft.text }))) continue;
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
