import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { connectInboxSchema } from '@/lib/schemas';

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
  createdAt: string;
  updatedAt: string;
}

function mockSeed(userId: string): InboxRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'ib_demo_1',
      userId,
      provider: 'gmail',
      email: 'chris@reach.convergeflow.io',
      displayName: 'Chris @ ConvergeFlow',
      status: 'active',
      warmupEnabled: true,
      dailySendLimit: 50,
      warmupStartDate: now,
      createdAt: now,
      updatedAt: now,
    },
  ];
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
    if (inboxes.length === 0) {
      return NextResponse.json({ data: mockSeed(userId) });
    }
    return NextResponse.json({ data: inboxes });
  } catch (err) {
    console.warn('[api:inboxes.GET] falling back to mock seed', err);
    return NextResponse.json({ data: mockSeed(userId) });
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

  if (smtp?.password) {
    console.info('[api:inboxes.POST] smtp password received (placeholder, not persisted plaintext)');
  }

  const now = new Date().toISOString();
  const id = `ib_${Math.random().toString(36).slice(2, 12)}`;
  const record: InboxRecord = {
    id,
    userId,
    provider,
    email: email ?? '',
    displayName,
    status: 'connecting',
    warmupEnabled: true,
    dailySendLimit: 50,
    warmupStartDate: null,
    createdAt: now,
    updatedAt: now,
  };

  // authUrl is the OAuth redirect URL for gmail/yahoo.
  // The frontend checks for data.authUrl and redirects if present.
  const authUrl =
    provider === 'gmail'
      ? `https://accounts.google.com/o/oauth2/v2/auth?placeholder=true&state=${id}`
      : provider === 'yahoo'
        ? `https://api.login.yahoo.com/oauth2/request_auth?placeholder=true&state=${id}`
        : null;

  try {
    await adminDb.collection('inboxes').doc(id).set(record);
  } catch (err) {
    console.warn('[api:inboxes.POST] placeholder mode', err);
  }

  return NextResponse.json(
    { data: { ...record, authUrl } },
    { status: 201 },
  );
}
