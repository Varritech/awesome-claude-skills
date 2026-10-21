import test from 'node:test';
import assert from 'node:assert/strict';
import { liveCheck, isPrivateHost } from '../src/web.js';

test('isPrivateHost flags loopback, RFC1918, link-local, CGNAT, IPv6 local and local-only names, not public hosts', () => {
  for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.1', '192.168.0.9', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '[fd00::1]', 'nas.local', 'db.internal']) assert.equal(isPrivateHost(h), true, h);
  for (const h of ['acme.io', '8.8.8.8', '172.32.0.1', '100.63.0.1', 'localhost.example.com']) assert.equal(isPrivateHost(h), false, h);
});

test('liveCheck never sends a request to a private host', async () => {
  let calls = 0;
  const f = async () => { calls++; return new Response(null, { status: 200 }); };
  assert.equal(await liveCheck(f, 'http://169.254.169.254/latest'), false);
  assert.equal(await liveCheck(f, 'https://acme.io'), true);
  assert.equal(calls, 1);
});
