// Varritech Minute email renderer — replicates the Mozi Minute format:
// plain white single-column 600px email, Arial 16px black text, one-sentence
// paragraphs, numbered steps, one soft CTA, catchphrase sign-off, PS, footer.

export function renderSubject(hook) {
  return `Varritech Minute: ${hook}`;
}

const SIGN_OFF = 'Keep building things that work while you sleep.';
const FROM_NAME = 'Cristiano';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Wrap a CTA url through the click-tracking redirect so clicks attribute to the
// lead in our own CRM (ladk email_clicks). Falls back to the raw url when no
// TRACK_BASE or no recipient (e.g. the preview render).
function wrapLink(url, email, newsletter) {
  const base = process.env.TRACK_BASE;
  if (!base || !email) return url;
  const q = new URLSearchParams({ e: email, u: url, n: newsletter || '' });
  return `${base}/c?${q.toString()}`;
}

function p(text) {
  return `<p style="font-size:16px; color:#000000; line-height:150%; margin:0 0 16px 0;">${text}</p>`;
}

export function renderHtml(draft, { unsubscribeUrl = 'mailto:christian@varritech.com?subject=unsubscribe', email = '', newsletter = '' } = {}) {
  const { paragraphs = [], steps = [], cta, ps } = draft;
  const parts = [];

  for (const para of paragraphs) parts.push(p(esc(para)));

  if (steps.length) {
    parts.push(p("Here’s what we did:"));
    steps.forEach((s, i) => parts.push(p(`${i + 1}) ${esc(s)}`)));
  }

  if (cta) {
    parts.push(p(`<a href="${wrapLink(cta.url, email, newsletter)}" target="_blank" style="color:#00a4bd;">${esc(cta.text)}</a>`));
  }

  parts.push(p(esc(SIGN_OFF)));
  parts.push(p(`- ${FROM_NAME}`));

  if (ps) {
    parts.push(p(`PS - <a href="${wrapLink(ps.url, email, newsletter)}" target="_blank" style="color:#00a4bd;">${esc(ps.text)}</a>`));
  }

  const footer = `
    <p style="font-size:12px; color:#23496d; line-height:135%; text-align:center; margin:24px 0 0 0;">
      Varritech, LLC &middot; You are receiving this because you connected with Varritech.<br>
      <a href="${unsubscribeUrl}" style="color:#00a4bd;">Unsubscribe</a><br><br>
      This message is provided for informational purposes only and does not constitute professional advice.
      Results described reflect specific client work and will vary. Nothing here is a promise or guarantee of outcomes.
    </p>`;

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0; padding:0; background-color:#ffffff; font-family:Arial, Helvetica, sans-serif;">
  <div style="min-width:280px; max-width:600px; margin:0 auto; padding:20px;">
    ${parts.join('\n    ')}
    ${footer}
  </div>
</body>
</html>`;
}
