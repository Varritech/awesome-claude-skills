#!/usr/bin/env node
/**
 * Real end-to-end send test against deployed Convergeflow.
 *
 * What this does:
 *   1. Creates a throwaway Ethereal Email SMTP account (free, no signup).
 *   2. POSTs /api/inboxes with those SMTP creds → asserts:
 *      - response 201
 *      - Firestore inboxes/{id} has smtpHost/smtpPort/smtpUser/smtpPasswordEncrypted
 *      - status=warming, warmupStartDate set
 *   3. Writes a fake queued email targeting INTEGRATION_TO_EMAIL with scheduledFor 1 min ago.
 *   4. Hits /api/cron/send-scheduled-emails.
 *   5. Polls Firestore for emails/{id}.status==='sent' (or 'bounced').
 *   6. If Ethereal: prints the preview URL for the sent message so you can visually verify.
 *
 * Required env:
 *   INTEGRATION_BASE_URL          e.g. https://convergeflow-push.vercel.app
 *   INTEGRATION_CLERK_TOKEN       Clerk session JWT for an authed user
 *   INTEGRATION_USER_ID           Clerk userId matching the token
 *   INTEGRATION_TO_EMAIL          Where the test email is sent (your inbox to check)
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 *
 * Optional env (skip Ethereal, use your own SMTP):
 *   INTEGRATION_SMTP_HOST INTEGRATION_SMTP_PORT INTEGRATION_SMTP_USER INTEGRATION_SMTP_PASSWORD
 *
 * Run:
 *   node scripts/integration/send-real-email.mjs
 */

import { setTimeout as sleep } from 'node:timers/promises';
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

const required = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing required env: ${k}`);
    process.exit(1);
  }
  return v;
};

const BASE = required('INTEGRATION_BASE_URL').replace(/\/$/, '');
const TOKEN = required('INTEGRATION_CLERK_TOKEN');
const USER_ID = required('INTEGRATION_USER_ID');
const TO_EMAIL = required('INTEGRATION_TO_EMAIL');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: required('FIREBASE_ADMIN_PROJECT_ID'),
    clientEmail: required('FIREBASE_ADMIN_CLIENT_EMAIL'),
    privateKey: required('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

function logStep(n, msg) {
  console.log(`\n=== Step ${n}: ${msg} ===`);
}

async function getSmtpCreds() {
  if (process.env.INTEGRATION_SMTP_HOST) {
    return {
      host: process.env.INTEGRATION_SMTP_HOST,
      port: Number(process.env.INTEGRATION_SMTP_PORT ?? 587),
      user: required('INTEGRATION_SMTP_USER'),
      password: required('INTEGRATION_SMTP_PASSWORD'),
      isEthereal: false,
    };
  }
  console.log('Creating Ethereal Email test account...');
  const acct = await nodemailer.createTestAccount();
  console.log(`Ethereal user: ${acct.user}`);
  return {
    host: acct.smtp.host,
    port: acct.smtp.port,
    user: acct.user,
    password: acct.pass,
    isEthereal: true,
  };
}

async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  return { status: res.status, body: await res.text() };
}

async function main() {
  let inboxId;
  let emailId;
  try {
    // ── Step 1: get SMTP creds (Ethereal or env-provided) ────────────────────
    logStep(1, 'Acquire SMTP credentials');
    const smtp = await getSmtpCreds();
    console.log(`SMTP host=${smtp.host} port=${smtp.port} user=${smtp.user}`);

    // ── Step 2: POST /api/inboxes with those creds ──────────────────────────
    logStep(2, 'POST /api/inboxes — connect own SMTP');
    const connectRes = await postJson('/api/inboxes', {
      provider: 'smtp_imap',
      email: smtp.user,
      smtp: {
        host: smtp.host,
        port: smtp.port,
        user: smtp.user,
        password: smtp.password,
      },
    });
    console.log(`Response: ${connectRes.status} ${connectRes.body.slice(0, 300)}`);
    if (connectRes.status !== 201 && connectRes.status !== 200) {
      throw new Error(`Inbox connect failed: ${connectRes.status} ${connectRes.body}`);
    }
    const parsed = JSON.parse(connectRes.body);
    inboxId = parsed.data?.id ?? parsed.id;
    if (!inboxId) throw new Error('No inbox id returned');
    console.log(`Inbox id: ${inboxId}`);

    // ── Step 3: assert Firestore doc has SMTP creds ────────────────────────
    logStep(3, 'Verify Firestore inboxes/{id} has encrypted SMTP creds');
    const inboxDoc = await db.collection('inboxes').doc(inboxId).get();
    if (!inboxDoc.exists) throw new Error(`Firestore inbox ${inboxId} does not exist`);
    const inbox = inboxDoc.data();
    const required = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPasswordEncrypted'];
    const missing = required.filter((k) => !inbox[k]);
    if (missing.length > 0) {
      throw new Error(`Firestore inbox missing fields: ${missing.join(', ')}`);
    }
    if (inbox.status !== 'warming' && inbox.status !== 'active') {
      throw new Error(`Inbox status is "${inbox.status}", expected warming/active`);
    }
    if (!inbox.warmupStartDate) {
      throw new Error('warmupStartDate not set');
    }
    console.log(`PASS: status=${inbox.status}, warmupStartDate=${inbox.warmupStartDate}`);

    // ── Step 4: insert a queued email targeting TO_EMAIL ──────────────────
    logStep(4, 'Insert queued email scheduled for the past');
    emailId = `em_int_${Date.now()}`;
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    await db.collection('emails').doc(emailId).set({
      id: emailId,
      userId: USER_ID,
      leadId: null,
      campaignId: null,
      inboxId,
      toEmail: TO_EMAIL,
      subject: `Convergeflow integration test ${Date.now()}`,
      body: `Hi there,\n\nThis is an automated end-to-end integration test send.\n\nInbox: ${inboxId}\nEmail: ${emailId}\nTime: ${new Date().toISOString()}`,
      persona: 'neighbor',
      status: 'queued',
      scheduledFor: pastIso,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sentAt: null,
      deletedAt: null,
    });
    console.log(`Queued email ${emailId} scheduledFor=${pastIso}`);

    // ── Step 5: trigger cron route ────────────────────────────────────────
    logStep(5, 'GET /api/cron/send-scheduled-emails');
    const cronRes = await getJson('/api/cron/send-scheduled-emails');
    console.log(`Cron response: ${cronRes.status} ${cronRes.body.slice(0, 400)}`);

    // ── Step 6: poll email status ─────────────────────────────────────────
    logStep(6, 'Poll Firestore for status=sent');
    const deadline = Date.now() + 90_000;
    let finalStatus = null;
    while (Date.now() < deadline) {
      const snap = await db.collection('emails').doc(emailId).get();
      const data = snap.data();
      finalStatus = data?.status;
      console.log(`  ${new Date().toISOString()} status=${finalStatus}`);
      if (finalStatus && finalStatus !== 'queued') break;
      await sleep(5000);
    }
    if (finalStatus !== 'sent') {
      throw new Error(`Email never reached sent status, final=${finalStatus}`);
    }
    console.log('\nPASS: integration test green');

    if (smtp.isEthereal) {
      const finalDoc = (await db.collection('emails').doc(emailId).get()).data();
      console.log(`\nEthereal preview URL (paste in browser to view delivered message):`);
      console.log(`  https://ethereal.email/messages`);
      console.log(`Or use messageId: ${finalDoc?.messageId ?? '<none>'}`);
    } else {
      console.log(`\nCheck the inbox at ${TO_EMAIL} — message should have arrived.`);
    }
  } catch (err) {
    console.error('\nFAIL:', err.message);
    process.exitCode = 1;
  } finally {
    if (emailId) {
      try { await db.collection('emails').doc(emailId).delete(); } catch {}
    }
    if (inboxId && process.env.INTEGRATION_CLEANUP === '1') {
      try { await db.collection('inboxes').doc(inboxId).delete(); } catch {}
    } else if (inboxId) {
      console.log(`\nLeft inbox ${inboxId} in place. Delete manually or rerun with INTEGRATION_CLEANUP=1.`);
    }
    process.exit(process.exitCode ?? 0);
  }
}

main();
