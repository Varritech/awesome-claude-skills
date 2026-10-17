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
import { draftReply, bookedText } from './sales.js';
import { spreadSlots } from './calendar.js';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
export const FOLLOW_UP_DAYS = [3, 7];

function messageBudget(ledger, rate, now) {
  if (!rate?.perHour) return Infinity;
  return Math.max(0, rate.perHour - ledger.sentSince(HOUR, now));
}

const isoNow = (now) => new Date(now).toISOString();
/** Name is on the do-not-message list (case-insensitive, matches a listed name anywhere in theirs: "Jitka" blocks "Jitka Valova"). */
export const blocked = (name, list = []) => { const n = norm(name); return list.some((x) => x && n.includes(norm(x))); };
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

export async function inviteRound({ ledger, browser, now = new Date(), searches, exclude = [], maxPages = 3, dailyCap = null, doNotMessage = [] }) {
  const budget = connectBudget({ ledger, now, dailyCap });
  const out = { budget, invited: [], error: null };
  if (budget <= 0 || !searches?.length) return out;
  const skip = new Set(exclude.map((s) => s.toLowerCase()));
  const tried = new Set(); // one attempt per person per run, even if they show up on every page

  for (const search of searches) {
    for (let page = 1; page <= maxPages && out.invited.length < budget; page++) {
      const rows = await browser.searchPage(search, page);
      if (!rows.length) break;
      const fresh = rows.filter((r) => r.canConnect && matchesIcp(r) && !ledger.has(r.slug) && !skip.has(r.slug) && !tried.has(r.slug) && !blocked(r.name, doNotMessage));
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
        await ledger.recordInvite(r.slug, { at: isoNow(now), name: r.name, headline: r.headline, search });
        await ledger.setStage(r.slug, { inviteNote: noted ? note : null });
        out.invited.push(r.slug);
      }
    }
    if (out.invited.length >= budget) break;
  }
  return out;
}

export async function acceptRound({ ledger, browser, now = new Date(), rate, doNotMessage = [] }) {
  const out = { accepted: [], opened: [], takenOver: [], error: null };
  const pending = ledger.all().filter((e) => e.invitedAt && !e.acceptedAt);
  const unopened = () => ledger.all().filter((e) => e.acceptedAt && e.recipient && !(e.messages ?? []).length && !e.handoff);
  if (!pending.length && !unopened().length) return out;

  if (pending.length) {
    for (const c of await browser.connections()) {
      const e = ledger.get(c.slug);
      // Only rows we invited. A connection that is not in the ledger as an
      // invite is someone Cristiano already knows: never touched.
      if (!e || !e.invitedAt || e.acceptedAt) continue;
      await ledger.markAccepted(c.slug, { at: isoNow(now) });
      await ledger.setStage(c.slug, { recipient: c.recipient ?? null, ...(e.name ? {} : { name: c.name }) });
      out.accepted.push(c.slug);
    }
  }

  let left = messageBudget(ledger, rate, now);
  for (const e of unopened()) {
    if (left <= 0) break;
    if (blocked(e.name, doNotMessage)) continue;
    // Look first: he may have written to them himself since they accepted.
    let thread;
    try {
      thread = await browser.readThread({ slug: e.slug, recipient: e.recipient, name: e.name });
    } catch (err) {
      out.error = String(err?.message ?? err);
      if (/signed out|checkpoint|DevTools|frozen/i.test(out.error)) break;
      continue;
    }
    const his = cristianoLine(e, thread);
    if (his) { await takeOver(ledger, e.slug, his, now, out); continue; }
    const text = openerFor({ name: e.name });
    try {
      if (!(await browser.sendMessage({ slug: e.slug, recipient: e.recipient, name: e.name, text }))) continue;
    } catch (err) {
      out.error = String(err?.message ?? err);
      break;
    }
    await ledger.recordMessage(e.slug, { at: isoNow(now), from: 'us', text, kind: 'opener' });
    out.opened.push(e.slug);
    left -= 1;
  }
  return out;
}

/**
 * Cristiano 2026-10-16: "As soon as I've touched a conversation, it's now
 * mine." His messages and the claw's come from the same account, so the only
 * tell is the text: a line from our side that the claw never sent (nor the
 * invite note) means he wrote it. Returns that line, or null.
 */
export function cristianoLine(entry, thread) {
  const sent = [entry.inviteNote, ...(entry.messages ?? []).filter((m) => m.from === 'us' && m.kind !== 'history').map((m) => m.text)]
    .filter(Boolean).map(norm);
  const ours = (t) => {
    const n = norm(t);
    return sent.some((s) => s === n || (n.length >= 40 && s.startsWith(n.slice(0, 40))) || (s.length >= 40 && n.startsWith(s.slice(0, 40))));
  };
  return thread.find((m) => m.from === 'us' && !ours(m.text))?.text ?? null;
}

async function takeOver(ledger, slug, text, now, out) {
  await ledger.setStage(slug, { owner: 'cristiano', takenOverAt: isoNow(now), takenOverLine: text, handoff: true, handoffReason: 'Cristiano wrote in the thread', handoffAt: isoNow(now) });
  out.takenOver.push({ slug, text });
}

/** Folds the live thread into the ledger. Returns the messages from them we had not seen. */
async function syncThread(ledger, slug, thread, now) {
  const e = ledger.get(slug);
  const knownTheirs = (e.messages ?? []).filter((m) => m.from === 'them').length;
  const theirs = thread.filter((m) => m.from === 'them');
  const fresh = theirs.slice(knownTheirs);
  for (const m of fresh) await ledger.recordMessage(slug, { at: isoNow(now), from: 'them', text: m.text });
  return fresh;
}

export async function followUpRound({ ledger, browser, now = new Date(), rate, doNotMessage = [] }) {
  const out = { sent: [], error: null };
  let left = messageBudget(ledger, rate, now);
  const due = [];
  for (const e of ledger.all()) {
    if (!e.recipient || e.replied || e.handoff || e.closed || blocked(e.name, doNotMessage)) continue;
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
    const fresh = await syncThread(ledger, e.slug, thread, now);
    if (fresh.length) continue;
    const text = followUpFor({ name: e.name, number });
    try {
      if (!(await browser.sendMessage({ slug: e.slug, recipient: e.recipient, name: e.name, text }))) continue;
    } catch (err) {
      out.error = String(err?.message ?? err);
      break;
    }
    await ledger.recordMessage(e.slug, { at: isoNow(now), from: 'us', text, kind: `followup-${number}` });
    out.sent.push(e.slug);
    left -= 1;
  }
  return out;
}

export async function replyRound({ ledger, browser, llm, calendar = null, dryBook = false, now = new Date(), rate, maxThreads = 15, activeDays = 45, inbox = null, doNotMessage = [] }) {
  const out = { replied: [], handoffs: [], held: [], booked: [], takenOver: [], error: null };
  // Free slots are read once per run, only when someone actually wrote back.
  let slots = null;
  const openSlots = async () => {
    if (slots) return slots;
    try { slots = calendar ? spreadSlots(await calendar.freeSlots({ now })) : []; } catch (err) { slots = []; out.calendarError = String(err?.message ?? err); }
    return slots;
  };
  let left = messageBudget(ledger, rate, now);
  // With the inbox list (one click per run), only leads whose newest line is
  // from THEM are opened. Without it, fall back to checking threads in rotation.
  const theyWroteLast = inbox ? new Set(inbox.filter((r) => !r.fromUs).map((r) => norm(r.name))) : null;
  const active = ledger.all()
    .filter((e) => e.recipient && !e.handoff && !e.closed && (e.messages ?? []).some((m) => m.from === 'us'))
    .filter((e) => !theyWroteLast || theyWroteLast.has(norm(e.name)))
    .filter((e) => !blocked(e.name, doNotMessage))
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
    await ledger.setStage(e.slug, { lastCheckedAt: isoNow(now) });
    const his = cristianoLine(e, thread);
    if (his) { await syncThread(ledger, e.slug, thread, now); await takeOver(ledger, e.slug, his, now, out); continue; }
    await syncThread(ledger, e.slug, thread, now);
    if (thread.at(-1)?.from !== 'them') continue;

    const draft = await draftReply({ lead: ledger.get(e.slug), llm, slots: await openSlots() });
    if (draft.action === 'handoff') {
      await ledger.setStage(e.slug, { handoff: true, handoffReason: draft.reason, handoffAt: isoNow(now) });
      out.handoffs.push({ slug: e.slug, reason: draft.reason });
      continue;
    }
    let text = draft.text;
    if (draft.action === 'book') {
      if (dryBook) { out.held.push({ slug: e.slug, reason: `dry: would book ${draft.label} for ${draft.email}` }); continue; }
      let res;
      try {
        res = await calendar.book({ start: draft.start, email: draft.email, name: e.name, company: e.headline ?? null, now });
      } catch (err) {
        res = { ok: false, reason: `calendar: ${String(err?.message ?? err)}` };
      }
      if (!res.ok) { out.held.push({ slug: e.slug, reason: res.reason }); slots = null; continue; }
      // The event exists now: record it BEFORE the DM, so a failed send can never double-book.
      await ledger.setStage(e.slug, {
        qualified: true, booked: { eventId: res.eventId, start: draft.start, label: draft.label, email: draft.email, at: isoNow(now) },
        handoff: true, handoffReason: `booked call ${draft.label} (${draft.email})`, handoffAt: isoNow(now),
      });
      out.booked.push({ slug: e.slug, at: draft.label, email: draft.email });
      slots = (slots ?? []).filter((x) => x.start !== draft.start);
      text = bookedText({ label: draft.label, email: draft.email });
    } else if (draft.action !== 'send') { out.held.push({ slug: e.slug, reason: draft.reason }); continue; }
    try {
      if (!(await browser.sendMessage({ slug: e.slug, recipient: e.recipient, name: e.name, text }))) continue;
    } catch (err) {
      out.error = String(err?.message ?? err);
      break;
    }
    await ledger.recordMessage(e.slug, { at: isoNow(now), from: 'us', text, kind: draft.action === 'book' ? 'booked' : 'reply' });
    if (draft.qualified !== null) await ledger.setStage(e.slug, { qualified: draft.qualified });
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
export async function existingRound({ ledger, browser, now = new Date(), rate, searches, cursor, dailyCap = 20, maxPages = 5, doNotMessage = [] }) {
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
    const fresh = rows.filter((r) => r.degree === '1st' && r.recipient && matchesIcp(r) && !ledger.has(r.slug) && !blocked(r.name, doNotMessage));
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
        await ledger.recordSkip(r.slug, { at: isoNow(now), reason: 'existing-thread', name: r.name });
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
      await ledger.recordExisting(r.slug, { at: isoNow(now), name: r.name, headline: r.headline, recipient: r.recipient });
      await ledger.recordMessage(r.slug, { at: isoNow(now), from: 'us', text, kind: 'opener-existing' });
      out.messaged.push(r.slug);
      left -= 1;
    }
    // Page fully handled (nobody new left on it) -> move on next time.
    if (left > 0) page += 1;
    cursor.set({ search, page });
  }
  return out;
}

/**
 * People who messaged Cristiano FIRST and are not claw leads (Cristiano
 * 2026-10-15: "you can send them if they're not your leads, but you have to
 * check to see if they're qualified founders before you send").
 *
 * Each is profiled once (title, company, company details from their profile),
 * screened by `qualify`, and the decision is recorded so nobody is profiled or
 * judged twice. Qualified people become leads and get the sales reply; from
 * then on replyRound carries the conversation.
 */
export async function inboundRound({ ledger, browser, llm, qualify, now = new Date(), rate, inbox, exclude = [], maxPerRun = 4, doNotMessage = [] }) {
  const out = { replied: [], skipped: [], handoffs: [], held: [], error: null };
  if (!inbox?.length) return out;
  const excluded = new Set(exclude.map((n) => norm(n)));
  const known = new Set(ledger.all().map((e) => norm(e.name)).filter(Boolean));
  let left = messageBudget(ledger, rate, now);
  let looked = 0;
  for (const row of inbox) {
    if (left <= 0 || looked >= maxPerRun) break;
    if (row.fromUs || /^Sponsored\b/i.test(row.snippet ?? '')) continue;
    if (excluded.has(norm(row.name)) || known.has(norm(row.name)) || blocked(row.name, doNotMessage)) continue;
    looked += 1;
    let profile;
    let thread;
    try {
      profile = await browser.profileOf({ name: row.name });
      if (!profile?.slug) continue; // could not find them: try again another run
      if (ledger.has(profile.slug)) continue;
      thread = await browser.readThread({ slug: profile.slug, name: profile.name ?? row.name });
    } catch (err) {
      out.error = String(err?.message ?? err);
      if (/signed out|checkpoint|DevTools|frozen/i.test(out.error)) break;
      continue;
    }
    const verdict = await qualify({ profile, thread, llm });
    if (!verdict.qualified) {
      await ledger.recordSkip(profile.slug, { at: isoNow(now), reason: `inbound-unqualified: ${verdict.reason}`, name: profile.name ?? row.name });
      out.skipped.push(profile.slug);
      continue;
    }
    await ledger.recordExisting(profile.slug, { at: isoNow(now), name: profile.name ?? row.name, headline: profile.headline, recipient: profile.recipient ?? null });
    await ledger.setStage(profile.slug, { inbound: true, qualifiedBy: verdict.reason, title: profile.title, company: profile.company, companyInfo: profile.companyInfo, qualified: true });
    for (const m of thread) await ledger.recordMessage(profile.slug, { at: isoNow(now), from: m.from, text: m.text, kind: 'history' });
    const draft = await draftReply({ lead: ledger.get(profile.slug), llm });
    if (draft.action === 'handoff') {
      await ledger.setStage(profile.slug, { handoff: true, handoffReason: draft.reason, handoffAt: isoNow(now) });
      out.handoffs.push({ slug: profile.slug, reason: draft.reason });
      continue;
    }
    if (draft.action !== 'send') { out.held.push({ slug: profile.slug, reason: draft.reason }); continue; }
    try {
      if (!(await browser.sendMessage({ slug: profile.slug, name: profile.name ?? row.name, text: draft.text }))) continue;
    } catch (err) {
      out.error = String(err?.message ?? err);
      break;
    }
    await ledger.recordMessage(profile.slug, { at: isoNow(now), from: 'us', text: draft.text, kind: 'reply' });
    out.replied.push(profile.slug);
    left -= 1;
  }
  return out;
}
