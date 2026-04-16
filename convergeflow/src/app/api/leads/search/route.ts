/**
 * /api/leads/search - search external lead sources (Apollo / A-Leads).
 *
 * TODO: Wire to real providers:
 *   - Apollo:   https://apolloapi.com/docs
 *   - A-Leads:  https://aleads.com (partner API)
 *
 * Until then this route returns a realistic batch of mock leads shaped like
 * the real provider responses so the UI can build the "import preview"
 * experience against a stable contract.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { leadSearchSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

const FIRST_NAMES = [
  'Alex',
  'Jordan',
  'Sam',
  'Taylor',
  'Riley',
  'Morgan',
  'Casey',
  'Drew',
  'Jamie',
  'Avery',
];
const LAST_NAMES = [
  'Chen',
  'Patel',
  'Rivera',
  'Nguyen',
  'Kim',
  'Walker',
  'Brooks',
  'Ortiz',
  'Kumar',
  'Foster',
];
const COMPANIES = [
  'Acme',
  'Northside',
  'Hawk',
  'Quill',
  'Vanta',
  'Riverside',
  'Halo',
  'Beacon',
  'Lumen',
  'Forge',
];
const TITLES = [
  'Head of Growth',
  'VP Marketing',
  'Founder',
  'Chief of Staff',
  'Director of Sales',
  'Practice Owner',
  'Managing Partner',
  'Operations Lead',
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, leadSearchSchema);
  if (parsed.response) return parsed.response;
  const { industry, location, count, titles } = parsed.data;

  logRequest('leads.search.POST', userId, { industry, location, count });

  const total = Math.min(count, 50); // cap placeholder response size
  const results = Array.from({ length: total }, (_, i) => {
    const firstName = pick(FIRST_NAMES, i);
    const lastName = pick(LAST_NAMES, i + 3);
    const company = `${pick(COMPANIES, i + 1)} ${
      ['Labs', 'Group', 'Partners', 'Health', 'Capital'][i % 5]
    }`;
    const title = titles && titles.length > 0 ? pick(titles, i) : pick(TITLES, i);
    return {
      externalId: `apollo_${Date.now()}_${i}`,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: `${firstName}.${lastName}@${company
        .toLowerCase()
        .replace(/\s+/g, '')}.com`,
      company,
      title,
      industry,
      location,
      linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${i}`,
      confidence: 0.78 + ((i * 13) % 20) / 100,
    };
  });

  return NextResponse.json({
    data: {
      provider: 'apollo', // TODO: switch based on connected account
      query: { industry, location, count, titles },
      total,
      results,
    },
  });
}
