import test from 'node:test';
import assert from 'node:assert/strict';
import { isJunkEmail, isJunkRepo, isFreeDomain, dropRepeatEmails, emailDomain } from '../src/filters.js';

test('drops noreply, bots, lovable and placeholder addresses', () => {
  for (const e of ['1234+bob@users.noreply.github.com', 'noreply@acme.com', 'no-reply@acme.com',
    'dependabot[bot]@users.noreply.github.com', 'bot@lovable.dev', 'x@gpt-engineer.com', 'gpt-engineer-app[bot]@users.noreply.github.com',
    'jane@example.com', 'test@acme.io', 'your@email.com', 'jan@voorbeeld.nl', 'eleve@exemple.fr', 'max@beispiel.de',
    'onboarding@resend.dev', 'me@host.localdomain', 'me@box.local', 'me@nodot', 'cursoragent@cursor.com', 'noreply@anthropic.com', 'noreply@github.com', 'bot@vercel.com', 'v0[bot]@users.noreply.github.com', 'a@mailgun.org', 'not-an-email', '']) {
    assert.equal(isJunkEmail(e), true, e);
  }
});

test('drops school domains but keeps real founders', () => {
  for (const e of ['a@mit.edu', 'a@ox.ac.uk', 'a@lycee.sch.uk', 'a@univ.edu.au', 'a@school.k12.ca.us', 'a@univ-constantine2.dz', 'a@city-college.org', 'a@polytech.fr']) assert.equal(isJunkEmail(e), true, e);
  for (const e of ['sam@buildfast.io', 'sam@gmail.com']) assert.equal(isJunkEmail(e), false, e);
});

test('free vs company domain', () => {
  assert.equal(isFreeDomain('gmail.com'), true);
  assert.equal(isFreeDomain('buildfast.io'), false);
  assert.equal(emailDomain('Sam@BuildFast.io'), 'buildfast.io');
});

test('junk repo by name or description', () => {
  assert.equal(isJunkRepo({ name: 'my-portfolio', description: '' }), true);
  assert.equal(isJunkRepo({ name: 'app', description: 'Homework assignment for CS101' }), true);
  assert.equal(isJunkRepo({ name: 'netflix-clone', description: '' }), true);
  assert.equal(isJunkRepo({ name: 'biovatech-hackathon', description: '' }), true);
  assert.equal(isJunkRepo({ name: 'x', description: 'Starter template for Lovable' }), true);
  assert.equal(isJunkRepo({ name: 'invoice-saas', description: 'Invoices for freelancers' }), false);
  assert.equal(isJunkRepo({ name: 'x', description: null }), false);
});

test('email on 3+ unrelated repos is dropped, 2 is kept', () => {
  const seen = [
    { email: 'a@x.com', repo: 'o1/r1' }, { email: 'a@x.com', repo: 'o2/r2' }, { email: 'a@x.com', repo: 'o3/r3' },
    { email: 'b@y.com', repo: 'o1/r1' }, { email: 'b@y.com', repo: 'o2/r2' },
    { email: 'c@z.com', repo: 'o1/r1' }, { email: 'c@z.com', repo: 'o1/r1' }, { email: 'c@z.com', repo: 'o1/r1' },
  ];
  const keep = dropRepeatEmails(seen);
  assert.deepEqual(keep.map((s) => s.email).sort(), ['b@y.com', 'b@y.com', 'c@z.com', 'c@z.com', 'c@z.com']);
});
