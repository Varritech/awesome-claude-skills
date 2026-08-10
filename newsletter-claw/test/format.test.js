import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSubject } from '../format.js';

test('subject line uses Varritech Minute prefix with the hook', () => {
  assert.equal(
    renderSubject('What a $283 dead ad taught us'),
    'Varritech Minute: What a $283 dead ad taught us'
  );
});

test('subject line carries the edition masthead, not always Varritech Minute', () => {
  assert.equal(
    renderSubject('What a $283 dead ad taught us', 'scalewright-inner-circle'),
    'Scalewright Inner Circle: What a $283 dead ad taught us'
  );
  // unchanged default keeps the original broadcast masthead
  assert.equal(
    renderSubject('hook', 'varritech-minute'),
    'Varritech Minute: hook'
  );
});

import { renderHtml } from '../format.js';

const draft = {
  hook: 'What a $283 dead ad taught us',
  paragraphs: [
    'Last week one of our ads burned $283 with zero sales.',
    'The claw watching it killed it automatically at 3am.'
  ],
  steps: [
    'Pulled every active ad and its spend',
    'Flagged anything with $0 sales past $100 spend',
    'Auto-killed the losers, emailed the receipts'
  ],
  cta: { text: 'See how the AdWatch claw works', url: 'https://varritech.com/openclaw' },
  ps: { text: 'Grab the Skills Library', url: 'https://varritech.com/products/claude-skills-library-pro' }
};

test('html renders Mozi structure: 600px column, one-sentence paragraphs, numbered steps', () => {
  const html = renderHtml(draft);
  assert.match(html, /max-width:600px/);
  assert.match(html, /Last week one of our ads burned \$283 with zero sales\./);
  assert.match(html, /1\) Pulled every active ad and its spend/);
  assert.match(html, /3\) Auto-killed the losers, emailed the receipts/);
});

test('html has exactly one body CTA link, Cristiano sign-off, PS, and unsubscribe footer', () => {
  const html = renderHtml(draft);
  assert.match(html, /See how the AdWatch claw works/);
  assert.match(html, /- Cristiano/);
  assert.match(html, /PS -/);
  assert.match(html, /unsubscribe/i);
});

test('html uses the provided unsubscribe URL, never a raw placeholder', () => {
  const html = renderHtml(draft, { unsubscribeUrl: 'https://claw.example.com/unsubscribe?email=a%40b.com' });
  assert.match(html, /href="https:\/\/claw\.example\.com\/unsubscribe\?email=a%40b\.com"/);
  assert.doesNotMatch(html, /\{\{unsubscribe_url\}\}/);
});
