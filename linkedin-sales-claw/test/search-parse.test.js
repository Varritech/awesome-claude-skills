import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSearchResults } from '../src/linkedin-dom.js';

const html = readFileSync(new URL('./fixtures/search.html', import.meta.url), 'utf8');

describe('parseSearchResults', () => {
  it('reads one row per person: slug, name, degree, headline, location, connectable', () => {
    const rows = parseSearchResults(html);
    expect(rows.map((r) => r.slug)).toEqual(['dana-whitfield', 'raj-patel-9a1', 'lee-chen']);
    expect(rows[0]).toMatchObject({
      name: 'Dana Whitfield', degree: '2nd', headline: 'Owner, Whitfield HVAC & Plumbing',
      location: 'Austin, Texas, United States', canConnect: true,
    });
    expect(rows[1]).toMatchObject({ degree: '3rd+', canConnect: true });
  });

  it('a card with no Connect link (Message/Follow only) is not connectable', () => {
    expect(parseSearchResults(html)[2].canConnect).toBe(false);
  });

  it('accepts the JSON-string form the MCP extract tool returns', () => {
    expect(parseSearchResults(JSON.stringify(html)).length).toBe(3);
  });
});
