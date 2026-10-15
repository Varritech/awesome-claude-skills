// Fixed copy. The offer has to land word for word: "up to 80%", "free", "only
// pay if it worked". A model paraphrasing that into "we guarantee 80%" or
// inventing a price is a far worse outcome than zero personalisation, so the
// cold messages are templates and only the first name varies.
//
// No em dashes anywhere (Cristiano's standing rule for everything sent as him).

export const CALENDLY_URL = process.env.CALENDLY_URL || 'https://calendly.com/christian-varritech/30min';

const HONORIFIC_RE = /^(dr|mr|mrs|ms|mx|prof)\.?$/i;

/** "Dana Whitfield, MBA" -> "Dana". Empty when LinkedIn hides the name. */
export function firstNameOf(name) {
  const raw = String(name ?? '').split(',')[0].trim();
  if (!raw || /^linkedin member$/i.test(raw)) return '';
  const word = raw.split(/\s+/).find((w) => !HONORIFIC_RE.test(w)) ?? '';
  if (!/^[\p{L}][\p{L}'-]*$/u.test(word)) return '';
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

const hi = (name) => `Hi ${firstNameOf(name) || 'there'},`;

export function openerFor({ name }) {
  return [
    hi(name),
    'thanks for connecting. I run Varritech, we build done-for-you AI agents that take over up to 80% of a company\'s day-to-day operations.',
    'Right now we build the first one free for qualified businesses, and you only pay us if it actually automated work or added revenue.',
    'Curious, what eats most of your team\'s time right now?',
  ].join(' ');
}

export function followUpFor({ name, number }) {
  if (number === 1) {
    return [
      hi(name),
      'here is how it works.',
      'We get on a 30 minute call and map where your team\'s hours go.',
      'We pick the process with the biggest payoff, build the agent for free and run it inside your business.',
      'Then you decide if it was worth paying for. Want me to take a look at yours?',
    ].join(' ');
  }
  if (number === 2) {
    return [
      hi(name),
      'last note from me.',
      'If handing a chunk of your operations to AI agents is ever on the list, the free build stands.',
      `My calendar, if it helps: ${CALENDLY_URL}`,
    ].join(' ');
  }
  return null;
}

// LinkedIn caps a connection note at 200 characters on a free account (300 on
// Premium). Written to fit 200 so it never gets cut off mid-sentence.
export const INVITE_NOTE_MAX = 200;

export function inviteNoteFor({ name }) {
  const body = 'I run Varritech. We build done-for-you AI agents that take over up to 80% of a company\'s operations. First build is free for qualified owners, you only pay if it works. Open to connect?';
  const full = `${hi(name)} ${body}`;
  return full.length <= INVITE_NOTE_MAX ? full : `Hi there, ${body}`;
}
