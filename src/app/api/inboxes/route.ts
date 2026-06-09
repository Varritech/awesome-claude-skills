import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  jsonError,
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { connectInboxSchema } from '@/lib/schemas';
import * as mailforge from '@/lib/mailforge/client';
import { encryptPassword, verifySmtp } from '@/lib/smtp/mailer';

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
  domainId?: string;
  mailforgeMailboxId?: string;
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

  let mailforgeMailboxId: string | undefined;
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

  // ── Path 2: Mailforge-provisioned mailbox (domainId provided + Mailforge configured) ──
  const { domainId } = parsed.data;
  if (!resolvedSmtp.encryptedPassword && domainId && mailforge.isConfigured()) {
    try {
      const domainSnap = await adminDb.collection('domains').doc(domainId).get();
      const domainDoc = domainSnap.exists
        ? (domainSnap.data() as {
            mailforgeDomainId?: string;
            domain?: string;
            overallStatus?: string;
            userId?: string;
          })
        : null;
      const mfDomainId = domainDoc?.mailforgeDomainId;

      // Ownership + verification gates before Mailforge spends a mailbox slot.
      if (domainDoc?.userId && domainDoc.userId !== userId) {
        return NextResponse.json(
          { error: 'Domain does not belong to this user' },
          { status: 403 },
        );
      }
      if (mfDomainId && domainDoc?.overallStatus !== 'green') {
        return NextResponse.json(
          {
            error:
              'Domain DNS is not verified yet. Add the SPF/DKIM/DMARC/MX records and wait for the verification to turn green before connecting an inbox.',
            overallStatus: domainDoc?.overallStatus ?? 'pending',
          },
          { status: 409 },
        );
      }

      if (mfDomainId) {
        const [mailbox] = await mailforge.purchaseMailboxes([mfDomainId], 1);
        if (mailbox) {
          mailforgeMailboxId = mailbox.id;
          resolvedEmail = mailbox.email || resolvedEmail;
          resolvedSmtp = {
            host: mailbox.smtpHost,
            port: mailbox.smtpPort,
            user: mailbox.smtpUser,
          };
          if (mailbox.smtpPassword && process.env.SMTP_ENCRYPTION_KEY) {
            try {
              resolvedSmtp.encryptedPassword = encryptPassword(mailbox.smtpPassword);
            } catch (encErr) {
              console.warn('[api:inboxes.POST] password encryption failed', encErr);
            }
          }
          console.info('[api:inboxes.POST] mailforge mailbox provisioned', mailbox.id);
        }
      }
    } catch (err) {
      console.warn('[api:inboxes.POST] mailforge.purchaseMailboxes failed', err);
    }
  }

  // SMTP creds present (own or Mailforge-provisioned) → kick off warmup immediately.
  const hasSmtp = Boolean(resolvedSmtp.encryptedPassword);
  const record: InboxRecord = {
    id,
    userId,
    provider,
    email: resolvedEmail,
    ...(displayName ? { displayName } : {}),
    status: hasSmtp ? 'warming' : 'connecting',
    warmupEnabled: true,
    dailySendLimit: 50,
    warmupStartDate: hasSmtp ? now : null,
    ...(domainId ? { domainId } : {}),
    ...(mailforgeMailboxId ? { mailforgeMailboxId } : {}),
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
