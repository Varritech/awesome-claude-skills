import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAudience, isEdition } from '../audiences.js';

test('the Scalewright Inner Circle edition resolves to its hand-picked list', async () => {
  const list = await loadAudience('scalewright-inner-circle');
  assert.deepEqual(list.sort(), [
    'angus@vulcan-adv.com',
    'fernan_violinist@yahoo.com',
    'georgie@troublemaker-studio.com',
    'info@panaceacorporatewellness.com',
    'theadkinsgroup@outlook.com',
    'thebizhive@proton.me',
  ]);
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
