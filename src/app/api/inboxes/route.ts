import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  jsonError,
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { connectInboxSchema } from '@/lib/schemas';
import { encryptPassword, verifySmtp } from '@/lib/smtp/mailer';
import { planInboxConnect } from '@/lib/inboxes/plan-connect';

export const dynamic = 'force-dynamic';

interface InboxRecord {
  id: string;
  userId: string;
  provider: 'gmail' | 'yahoo' | 'smtp_imap';
  email: string;
  displayName?: string;
  status: 'connecting' | 'connected' | 'warming' | 'active' | 'disconnected' | 'error';
  warmupEnabled: boolean;
  dailySendLimit: number;
  warmupStartDate?: string | null;
  warmupSkipped?: boolean;
  domainId?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPasswordEncrypted?: string;
  createdAt: string;
  updatedAt: string;
}

function buildGmailAuthUrl(inboxId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://convergeflow-push.vercel.app';
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${appUrl}/api/inboxes/callback/google`,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: inboxId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('inboxes.GET', userId);

  try {
    const snap = await adminDb
      .collection('inboxes')
      .where('userId', '==', userId)
      .get();
    const inboxes = snap.docs.map((d) => d.data() as InboxRecord);
    return NextResponse.json({ data: inboxes });
  } catch (err) {
    console.error('[api:inboxes.GET] firestore error', err);
    return jsonError('Failed to load inboxes', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, connectInboxSchema);
  if (parsed.response) return parsed.response;
  const { provider, email, displayName, smtp } = parsed.data;

  logRequest('inboxes.POST', userId, { provider, email });

  const now = new Date().toISOString();
  const id = `ib_${Math.random().toString(36).slice(2, 12)}`;

  let resolvedSmtp: { host?: string; port?: number; user?: string; encryptedPassword?: string } = {};
  let resolvedEmail = email ?? '';
  let smtpVerified = false;

  // ── Path 1: user supplied their own SMTP credentials (provider=smtp_imap or BYO) ──
  // Encrypt + persist immediately so the sender has what it needs.
  if (smtp?.host && smtp?.port && smtp?.user && smtp?.password) {
    if (!process.env.SMTP_ENCRYPTION_KEY) {
      return jsonError('SMTP_ENCRYPTION_KEY not configured on server; cannot accept SMTP credentials', 500);
    }
    try {
      resolvedSmtp = {
        host: smtp.host,
        port: smtp.port,
        user: smtp.user,
        encryptedPassword: encryptPassword(smtp.password),
      };
      resolvedEmail = email ?? smtp.user;
      // Verify the SMTP credentials before we mark the inbox connected
      try {
        smtpVerified = await verifySmtp({
          host: smtp.host,
          port: smtp.port,
          user: smtp.user,
          encryptedPassword: resolvedSmtp.encryptedPassword!,
        });
      } catch (vErr) {
        console.warn('[api:inboxes.POST] smtp verify threw', vErr);
      }
      if (!smtpVerified) {
        return jsonError('SMTP credentials failed verification. Check host/port/user/password.', 400);
      }
    } catch (encErr) {
      console.error('[api:inboxes.POST] smtp password encryption failed', encErr);
      return jsonError('Failed to encrypt SMTP password', 500);
    }
  }

  // Mailbox-provisioning-on-a-purchased-domain (the Mailforge model) is no
  // longer supported. Resend doesn't sell mailboxes, only sends mail. Users
  // either connect an existing Gmail inbox (OAuth path above) or supply
  // their own SMTP credentials. The domainId field on the request is still
  // accepted so the connected inbox can be tied to a sending domain, but
  // we do not auto-provision a new mailbox from it.

  // SMTP creds present (Gmail OAuth or own SMTP) → kick off warmup immediately,
  // unless the user opted to skip warmup (inbox goes straight to `active`).
  const hasSmtp = Boolean(resolvedSmtp.encryptedPassword);
  const connectPlan = planInboxConnect(
    { skipWarmup: parsed.data.skipWarmup, hasSmtp },
    new Date(now),
  );
  const record: InboxRecord = {
    id,
    userId,
    provider,
    email: resolvedEmail,
    ...(displayName ? { displayName } : {}),
    status: connectPlan.status,
    warmupEnabled: connectPlan.warmupEnabled,
    dailySendLimit: 50,
    warmupStartDate: connectPlan.warmupStartDate,
    ...(parsed.data.skipWarmup ? { warmupSkipped: true } : {}),
    ...(parsed.data.domainId ? { domainId: parsed.data.domainId } : {}),
    ...(resolvedSmtp.host ? { smtpHost: resolvedSmtp.host } : {}),
    ...(resolvedSmtp.port ? { smtpPort: resolvedSmtp.port } : {}),
    ...(resolvedSmtp.user ? { smtpUser: resolvedSmtp.user } : {}),
    ...(resolvedSmtp.encryptedPassword ? { smtpPasswordEncrypted: resolvedSmtp.encryptedPassword } : {}),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await adminDb.collection('inboxes').doc(id).set(record);
  } catch (err) {
    console.error('[api:inboxes.POST] firestore write failed', err);
    return jsonError('Failed to save inbox', 500);
  }

  let authUrl: string | null = null;
  if (provider === 'gmail' && process.env.GOOGLE_CLIENT_ID) {
    authUrl = buildGmailAuthUrl(id);
  } else if (provider === 'yahoo') {
    authUrl = null;
  }

  return NextResponse.json(
    { data: { ...record, authUrl } },
    { status: 201 },
  );
}
