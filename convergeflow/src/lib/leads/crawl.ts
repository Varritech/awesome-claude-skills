/**
 * Best-effort website crawl for lead categorization.
 *
 * Used by the categorize-lead Inngest job to feed the LLM a short text
 * excerpt of what a company actually does, so it can tell roofing from
 * gutters from solar. LinkedIn is auth-walled and is NOT crawled here.
 */

/** Strip HTML tags, scripts/styles, and collapse whitespace. Pure + testable. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch a URL and return its visible text, truncated to `maxChars`.
 * Returns null on any failure (timeout, non-2xx, bad URL) so the caller can
 * fall back to categorizing from title/company/industry alone.
 */
export async function fetchWebsiteText(url: string, maxChars = 2000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ConvergeFlowLeadCategorizer/1.0' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtml(html);
    return text.slice(0, maxChars) || null;
  } catch {
    return null;
  }
}