// Sync newsletter click events (ladk email_clicks) into HubSpot contact
// timelines as Note engagements. Portal 242245411, via Composio (entity
// COMPOSIO_USER_ID). Runs on its own schedule because clicks trickle in over
// days after a send. Matches a contact by email; unmatched clicks are marked
// synced too (so we don't retry forever) but flagged in the return.
const COMPOSIO = 'https://backend.composio.dev/api/v3/tools/execute';

function sbHeaders() {
  const key = process.env.LEADS_SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
function composioHeaders() {
  return { 'x-api-key': process.env.COMPOSIO_API_KEY, 'Content-Type': 'application/json' };
}
const USER = () => process.env.COMPOSIO_USER_ID || 'default';

async function execTool(slug, args) {
  const res = await fetch(`${COMPOSIO}/${slug}`, {
    method: 'POST',
    headers: composioHeaders(),
    body: JSON.stringify({ user_id: USER(), arguments: args }),
  });
  const data = await res.json();
  if (!res.ok || data?.successful === false) {
    throw new Error(`${slug} -> ${JSON.stringify(data).slice(0, 250)}`);
  }
  // Composio wraps the HubSpot payload as { data: { data: <hubspot-response> } }.
  return data?.data?.data ?? data?.data ?? data;
}

async function findContactId(email) {
  const d = await execTool('HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA', {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
    properties: ['email'],
    limit: 1,
  });
  const results = d?.results || [];
  return results[0]?.id || null;
}

// Log the click as a Note engagement associated to the contact.
async function logClickNote(contactId, click) {
  const when = new Date(click.clicked_at).getTime();
  // HubSpot Notes: HUBSPOT_CREATE_EMAIL logs an email engagement; for a plain
  // note we use the engagements Notes tool via the generic create-note slug if
  // present, else fall back to an email-direction engagement. We use the email
  // engagement (widely available) tagged as the click record.
  await execTool('HUBSPOT_CREATE_EMAIL', {
    properties: {
      hs_timestamp: String(when),
      hs_email_direction: 'EMAIL',
      hs_email_subject: `Clicked: Varritech Minute (${click.newsletter || 'newsletter'})`,
      hs_email_html: `<p>Contact clicked <a href="${click.dest_url}">${click.dest_url}</a> in the Varritech Minute newsletter.</p>`,
    },
    associations: [
      { to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }] },
    ],
  });
}

async function fetchUnsynced(limit = 200) {
  const url = process.env.LEADS_SUPABASE_URL;
  const res = await fetch(
    `${url}/rest/v1/email_clicks?select=*&synced_to_hubspot=eq.false&order=clicked_at.asc&limit=${limit}`,
    { headers: sbHeaders() }
  );
  if (!res.ok) throw new Error(`fetch clicks -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function markSynced(id) {
  const url = process.env.LEADS_SUPABASE_URL;
  await fetch(`${url}/rest/v1/email_clicks?id=eq.${id}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify({ synced_to_hubspot: true }),
  });
}

export async function syncClicksToHubspot() {
  const clicks = await fetchUnsynced();
  let matched = 0, unmatched = 0, errors = 0;
  for (const click of clicks) {
    try {
      const id = await findContactId(click.email);
      if (id) {
        await logClickNote(id, click);
        matched++;
      } else {
        unmatched++;
      }
      await markSynced(click.id); // mark either way so we don't reprocess
    } catch (e) {
      console.error('hubspot sync failed for', click.email, e.message);
      errors++;
      // leave synced_to_hubspot=false so it retries next run
    }
  }
  return { total: clicks.length, matched, unmatched, errors };
}
