// Is someone who messaged Cristiano first a qualified founder worth a sales reply?
//
// Cristiano 2026-10-15: "you have to check to see if they're qualified founders
// before you send ... You go to their profile, and you see what their job title
// is. You see information about the company." So the input is what the claw read
// on their PROFILE (current title + company from Experience, company details),
// plus the thread itself. A title check runs first in code; the model then rules
// on the company and the conversation. Anything but a clear yes = no.

import { matchesIcp } from './prospects.js';
import { OFFER, QUALIFIER } from './sales.js';

function parseJsonObject(raw) {
  const s = String(raw ?? '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

export function buildQualifyPrompt({ profile, thread }) {
  const convo = (thread ?? []).map((m) => `${m.from === 'us' ? 'Cristiano' : profile.name || 'Them'}: ${m.text}`).join('\n') || '(no messages read)';
  return [
    'You screen LinkedIn conversations for Cristiano, founder of Varritech.',
    `What Varritech sells: ${OFFER}`,
    QUALIFIER,
    '',
    'From their LinkedIn profile:',
    `- Name: ${profile.name ?? 'unknown'}`,
    `- Headline: ${profile.headline ?? 'unknown'}`,
    `- Current title: ${profile.title ?? 'unknown'}`,
    `- Current company: ${profile.company ?? 'unknown'}`,
    `- Company details: ${profile.companyInfo ?? 'unknown'}`,
    '',
    'The conversation (oldest first):',
    convo,
    '',
    'Answer qualified=true ONLY if ALL hold:',
    '1. They own or run a real operating business (founder/owner/CEO of it, not an employee, not a solo side project with no customers).',
    '2. The company could plausibly hand repetitive operations to AI agents (has a team or customers and manual work).',
    '3. The conversation is open to a sales reply: NOT an existing client or partner relationship, NOT a dispute or complaint about fees, NOT them pitching their own services or asking for work, NOT a recruiter, job seeker, investor chat or spam.',
    'When unsure, answer false.',
    'Reply with ONLY JSON: {"qualified": true|false, "reason": "<short reason>"}',
  ].join('\n');
}

export async function qualifyInbound({ profile, thread, llm }) {
  const title = `${profile.title ?? ''} ${profile.headline ?? ''}`;
  if (!matchesIcp({ headline: title })) return { qualified: false, reason: `not an owner/founder (${(profile.title || profile.headline || 'no title').slice(0, 60)})` };
  const out = parseJsonObject(await llm({ prompt: buildQualifyPrompt({ profile, thread }) }));
  if (!out || typeof out.qualified !== 'boolean') return { qualified: false, reason: 'screening answer unreadable' };
  return { qualified: out.qualified === true, reason: String(out.reason || (out.qualified ? 'qualified' : 'not qualified')).slice(0, 160) };
}
