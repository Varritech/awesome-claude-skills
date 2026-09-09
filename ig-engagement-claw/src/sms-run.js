/**
 * One tick of the SMS concierge.
 *
 * Order is deliberate and is asserted in the tests: answer the people who have
 * already written to us FIRST, then introduce ourselves to new leads with
 * whatever budget is left. Doing it the other way round lets a live
 * conversation go cold while the claw is busy starting new ones.
 *
 * Every seam is injected. Nothing here reaches the network on its own, which
 * is what makes it testable without texting a stranger.
 */

import { planFirstTouch, classifyInbound, firstTouchText, draftReply, SEND_WINDOW } from './sms.js';
import { isInbound } from './quo.js';

/**
 * @param {object}  o
 * @param {boolean} o.enabled  master switch. OFF unless SMS_ENABLED=1.
 * @returns a report: what was sent, what was held, what broke.
 */
export async function smsTick({
  enabled = false,
  leadSource,
  quo,
  ledger,
  llm,
  now = new Date(),
  cap = 5,
  rate = { perHour: 8, perDay: 40 },
  window = SEND_WINDOW,
  killSwitch = false,
  /*
   * How far back a conversation stays worth polling. The reply pass costs one
   * OpenPhone call per person, so unbounded it grows with the ledger until a
   * tick is nothing but polling people who went quiet in June. Measured from
   * the LAST message either side sent, so an active thread never ages out.
   */
  threadLookbackDays = Number(process.env.SMS_THREAD_LOOKBACK_DAYS ?? 14),
  log = () => {},
}) {
  const report = { enabled, firstTouches: 0, replies: 0, held: 0, optedOut: 0, errors: [] };

  // ⛔ Ships inert. This process texts real phone numbers from the number the
  // whole business texts from, so it does nothing at all until someone
  // deliberately turns it on.
  if (!enabled || killSwitch) {
    log('[sms] disabled, nothing sent');
    return report;
  }

  /* ---- 1. People mid-conversation. -------------------------------------
   *
   * Not rate-limited by the cold-send budget and not held for quiet hours:
   * they texted US. Waiting until 9am to answer somebody who wrote at 8:40pm
   * is worse behaviour than replying, and it is not a marketing message.
   */
  const lookbackCutoff = now.getTime() - threadLookbackDays * 86_400_000;

  for (const entry of ledger.all()) {
    if (entry.status === 'opted-out') continue;
    if (!entry.at) continue;

    const follows = entry.followUps ?? [];
    const lastSpoke = Date.parse(follows.length ? follows[follows.length - 1].at : entry.at);
    if (!Number.isFinite(lastSpoke) || lastSpoke < lookbackCutoff) continue;

    let thread;
    try {
      thread = await quo.thread(entry.handle);
    } catch (e) {
      report.errors.push(`thread ${entry.handle}: ${e.message}`);
      continue;
    }

    const last = thread[thread.length - 1];
    // Nothing new from them since we last spoke. Silence is not a prompt.
    if (!last || !isInbound(last)) continue;

    if (classifyInbound(last.text) === 'stop') {
      // ⛔ No confirmation text. "No problem, you're unsubscribed" is one more
      // unwanted message to somebody who just asked us to stop.
      ledger.record(entry.handle, { ...entry, status: 'opted-out', optedOutAt: now.toISOString() });
      report.optedOut += 1;
      log(`[sms] opted out ${entry.handle}`);
      continue;
    }

    let text;
    try {
      text = await draftReply({ thread, lead: { email: entry.email }, llm });
    } catch (e) {
      report.errors.push(`draft ${entry.handle}: ${e.message}`);
      continue;
    }

    // A guard rejected it. Leave the thread for a human rather than sending
    // something that merely sounds safe.
    if (!text) {
      report.held += 1;
      log(`[sms] held a reply to ${entry.handle}`);
      continue;
    }

    try {
      await quo.send({ to: entry.handle, text });
    } catch (e) {
      report.errors.push(`send ${entry.handle}: ${e.message}`);
      continue;
    }
    // Recorded only after the send actually returned. An unrecorded send is
    // retried; a wrongly recorded one is a person we never answer.
    ledger.recordFollowUp(entry.handle, { at: now.toISOString(), text });
    report.replies += 1;
  }

  /* ---- 2. New leads. ---------------------------------------------------- */
  let leads = [];
  try {
    leads = await leadSource.recent();
  } catch (e) {
    report.errors.push(`leads: ${e.message}`);
    return report;
  }

  const batch = planFirstTouch({ leads, ledger, now, cap, rate, window, killSwitch });
  for (const lead of batch) {
    const text = firstTouchText(lead);
    try {
      await quo.send({ to: lead.phone, text });
    } catch (e) {
      report.errors.push(`send ${lead.phone}: ${e.message}`);
      continue;
    }
    ledger.record(lead.phone, {
      at: now.toISOString(),
      text,
      email: lead.email ?? null,
      source: 'skills-free-pack',
    });
    report.firstTouches += 1;
  }

  return report;
}
