import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAudience, isEdition } from '../audiences.js';

test('the Scalewright Inner Circle edition resolves to its hand-picked list', async () => {
  const list = await loadAudience('scalewright-inner-circle');
  assert.equal(list.length, 30);
  // spot-check one member from each cohort the list was assembled from
  for (const email of [
    'angus@vulcan-adv.com',                    // invited founder, never joined Slack
    'info@panaceacorporatewellness.com',       // HubSpot prospect added by hand
    'cjtufano@getcherrypicker.com',            // current Slack member
    'mark@neuronovaeducation.org',             // former Slack member
    'ceo@praxia.ch',                           // join-form applicant
  ]) {
    assert.ok(list.includes(email), `expected ${email} in the Inner Circle`);
  }
});

// Every name below was removed on an explicit instruction. Encoding them as a
// test means a future "just add everyone" edit can't quietly reinstate them.
test('deliberately excluded people stay out of the Inner Circle', async () => {
  const list = await loadAudience('scalewright-inner-circle');
  for (const email of [
    'llanauxjr@hotmail.com',                   // Laniel — removed 2026-08-10
    'hannah.melotto@melottogroup.com',         // Hannah Melotto — removed 2026-08-10
    'greghillgb@gmail.com',                    // Greg Hill — open billing dispute
    'christian@varritech.com',                 // sender
    'jake@varritech.com',                      // Varritech staff, not a member
    'guido@varritech.com',
    'johaimalin@varritech.com',
    't@t.com',                                 // junk rows from community_invites
    'support@nivara-wellington.com',
  ]) {
    assert.ok(!list.includes(email), `${email} must NOT be in the Inner Circle`);
  }
});

test('the Inner Circle has no duplicates and no malformed addresses', async () => {
  const list = await loadAudience('scalewright-inner-circle');
  assert.equal(new Set(list.map((e) => e.toLowerCase())).size, list.length);
  for (const e of list) assert.match(e, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
});

// The failure that matters: an unknown/typo'd edition must NOT quietly resolve to
// the 178-lead broadcast. A private 6-person note going out to the whole list is
// not recoverable, so this fails loudly instead.
test('an unknown edition throws rather than falling back to the broadcast list', async () => {
  await assert.rejects(() => loadAudience('scaleright-inner-circle'), /unknown edition/i);
  await assert.rejects(() => loadAudience(undefined), /unknown edition/i);
});

test('isEdition recognises the known editions only', () => {
  assert.equal(isEdition('scalewright-inner-circle'), true);
  assert.equal(isEdition('varritech-minute'), true);
  assert.equal(isEdition('scaleright-inner-circle'), false);
  assert.equal(isEdition(undefined), false);
});
