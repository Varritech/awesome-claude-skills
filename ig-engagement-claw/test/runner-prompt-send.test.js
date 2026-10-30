/*
 * The agent reads runner-prompt.md, not src/, so the two send rules Cristiano
 * set on 2026-10-30 are pinned here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { config } from '../src/config.js';

const prompt = readFileSync(new URL('../runner-prompt.md', import.meta.url), 'utf8');
const section = (from, to) => prompt.slice(prompt.indexOf(from), prompt.indexOf(to));

describe('runner-prompt.md send rules', () => {
  it('runs the friend check before opening a profile, for openers and follow-ups', () => {
    const send = section('## 3. Send', '## 3b.');
    expect(send.indexOf('friend-check')).toBeGreaterThan(-1);
    expect(send.indexOf('friend-check')).toBeLessThan(send.indexOf('browser_navigate'));
    expect(section('## 3b.', '## 4. Commit')).toMatch(/friend-check/);
  });

  it('passes the source on openers so commenters get messaged, but not on follow-ups', () => {
    expect(section('## 3. Send', '## 3b.')).toContain('friend-check "<handle>" "<source>"');
    expect(section('## 3b.', '## 4. Commit')).not.toContain('<source>');
  });

  it('looks up the followers of the configured personal account', () => {
    expect(prompt).toContain(`/api/v1/friendships/${config().friendProfileId}/followers/`);
  });

  it('picks the prioritized message and never pays for one', () => {
    const send = section('## 3. Send', '## 3b.');
    expect(send).toMatch(/exactly\*{0,2} `Send prioritized message`/);
    expect(send).toMatch(/never pay/i);
  });
});
