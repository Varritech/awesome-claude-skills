import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseConnections, parseThread } from '../src/linkedin-dom.js';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

describe('parseConnections', () => {
  it('reads slug, name, connected date and the message recipient id', () => {
    const rows = parseConnections(fx('connections.html'));
    expect(rows).toEqual([
      { slug: 'dana-whitfield', name: 'Dana Whitfield', headline: 'Owner, Whitfield HVAC', connectedOn: 'October 15, 2026', recipient: 'ACoAAdana' },
      { slug: 'galenbutler1', name: 'Galen Butler', headline: '', connectedOn: 'September 30, 2026', recipient: 'ACoAAgalen' },
    ]);
  });
});

describe('parseThread', () => {
  it('returns every message in order, tagged us or them, multi-part bodies joined', () => {
    const msgs = parseThread(fx('thread.html'), { me: 'Cristiano Varriale' });
    expect(msgs).toEqual([
      { from: 'us', name: 'Cristiano Varriale', text: 'Hi Dana, thanks for connecting.' },
      { from: 'them', name: 'Dana Whitfield', text: 'Mostly scheduling.' },
      { from: 'them', name: 'Dana Whitfield', text: 'We are 14 people.\nAnd quoting.' },
    ]);
  });

  it('an empty thread is an empty list', () => {
    expect(parseThread('<main><div>Drag your file here.</div></main>', { me: 'Cristiano Varriale' })).toEqual([]);
  });
});
