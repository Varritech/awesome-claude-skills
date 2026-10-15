import { describe, it, expect } from 'vitest';
import { openerFor, followUpFor, firstNameOf, CALENDLY_URL } from '../src/copy.js';

describe('openerFor', () => {
  it('greets by first name and carries the whole offer, with no link and no em dash', () => {
    const text = openerFor({ name: 'Dana Whitfield, MBA' });
    expect(text.startsWith('Hi Dana,')).toBe(true);
    expect(text).toMatch(/done-for-you AI agents/);
    expect(text).toMatch(/up to 80%/);
    expect(text).toMatch(/free/);
    expect(text).toMatch(/only pay/);
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/[—–]/);
    expect(text.trim().endsWith('?')).toBe(true);
  });

  it('falls back to a plain greeting when the name is unusable', () => {
    expect(openerFor({ name: '' }).startsWith('Hi there,')).toBe(true);
    expect(firstNameOf('LinkedIn Member')).toBe('');
    expect(firstNameOf('dr. sam o\'neil')).toBe('Sam');
  });
});

describe('followUpFor', () => {
  it('knock one explains the process, knock two closes with the calendar link', () => {
    const one = followUpFor({ name: 'Dana Whitfield', number: 1 });
    expect(one).toMatch(/call/);
    expect(one).toMatch(/build/);
    expect(one).not.toMatch(/https?:\/\//);
    const two = followUpFor({ name: 'Dana Whitfield', number: 2 });
    expect(two).toContain(CALENDLY_URL);
  });

  it('there is no knock three', () => {
    expect(followUpFor({ name: 'Dana', number: 3 })).toBe(null);
  });
});

import { inviteNoteFor, INVITE_NOTE_MAX } from '../src/copy.js';

describe('inviteNoteFor', () => {
  it('fits LinkedIn\'s 200-char free note limit even for a long first name, and carries the offer', () => {
    const long = inviteNoteFor({ name: 'Maximiliana-Josephine Whitfield-Brown' });
    expect(INVITE_NOTE_MAX).toBe(200);
    expect(long.length).toBeLessThanOrEqual(200);
    const note = inviteNoteFor({ name: 'Dana Whitfield' });
    expect(note.startsWith('Hi Dana,')).toBe(true);
    expect(note).toMatch(/done-for-you AI agents/);
    expect(note).toMatch(/80%/);
    expect(note).toMatch(/free/);
    expect(note).not.toMatch(/https?:\/\/|[—–]/);
  });
});
