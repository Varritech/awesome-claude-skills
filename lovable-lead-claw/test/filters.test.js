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
  for (const d of ['mail.ru', 'yandex.ru', 'outlook.fr', 'hotmail.co.uk', 'yahoo.co.in', 'web.de', 'rediffmail.com', 'naver.com']) assert.equal(isFreeDomain(d), true, d);
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

test('school detection catches real schools without eating real companies', () => {
  for (const e of ['a@ept.sn', 'a@uivo.net', 'a@utfpr.edu.br', 'a@univ-lyon1.fr', 'a@ecole-centrale.fr', 'a@polytech.fr', 'a@city-college.org']) assert.equal(isJunkEmail(e), true, e);
  for (const e of ['a@universalstudios.com', 'a@univerz.io', 'a@abbot.com']) assert.equal(isJunkEmail(e), false, e);
});

test('bot detection only matches bot accounts, not names ending in bot', () => {
  assert.equal(isJunkEmail('abbot@acme.com'), false);
  assert.equal(isJunkEmail('ci-bot@acme.com'), true);
  assert.equal(isJunkEmail('renovate[bot]@acme.com'), true);
});

test('junk repo catches portfolio typos and vendor/tool repos', () => {
  for (const name of ['portfomio-brainx', 'my-porfolio', 'portafolio']) assert.equal(isJunkRepo({ name, description: '' }), true, name);
  assert.equal(isJunkRepo({ name: 'component-lovable', description: 'Official Diploi component for Lovable apps' }), true);
  assert.equal(isJunkRepo({ name: 'offramp', description: 'audit for apps built with Lovable' }), true);
  assert.equal(isJunkRepo({ name: 'invoice-saas', description: 'Invoices for freelancers' }), false);
});

test('drops AI-agent commit addresses', () => {
  for (const e of ['openhands@all-hands.dev', 'agent@arena.ai', 'devin@cognition.ai', 'copilot@acme.com', 'claude@acme.io', 'codex-agent@acme.io', 'aider@acme.io', 'assinesaude@app.com']) assert.equal(isJunkEmail(e), true, e);
  for (const e of ['agentsmith@acme.io', 'claudia@acme.io', 'devine@acme.io']) assert.equal(isJunkEmail(e), false, e);
});

test('college is a school only as the exact domain label, not inside a company name', () => {
  for (const e of ['a@college-station.com', 'x@collegeboard.org', 'x@collegeapp.io']) assert.equal(isJunkEmail(e), false, e);
  for (const e of ['a@college.edu', 'a@mycollege.edu', 'a@college.ca', 'a@city-college.org']) assert.equal(isJunkEmail(e), true, e);
});

test('drops local-machine hostnames and coding-school addresses', () => {
  for (const e of ['a@mac.mynet', 'a@x.fritz.box', 'a@finns-macbook-pro.fritz.box', 'a@host.home', 'a@pc.corp', 'a@router.lan', 'a@student.42.fr', 'a@x.student.somewhere.com', 'a@42.fr']) assert.equal(isJunkEmail(e), true, e);
  for (const e of ['sam@boxhq.io', 'sam@homebase.com', 'sam@studentloans.io', 'sam@fortytwo.fr']) assert.equal(isJunkEmail(e), false, e);
});
