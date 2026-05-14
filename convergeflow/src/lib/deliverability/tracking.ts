/**
 * Email tracking utilities.
 *
 * - wrapLinks: replace all hrefs in an HTML email body with tracking URLs
 * - addTrackingPixel: append a 1px transparent GIF tracking pixel
 * - hashUrl: deterministic short hash for a URL (used as linkHash)
 */

/** Simple FNV-1a 32-bit hash, returns a 8-char hex string. */
export function hashUrl(url: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Wrap all http/https links in an HTML email body with tracking redirect URLs.
 *
 * @param html - The HTML email body
 * @param emailId - The email document ID
 * @param trackingDomain - The tracking domain (e.g. "track.example.com")
 * @returns Modified HTML with links replaced by tracking URLs
 */
export function wrapLinks(html: string, emailId: string, trackingDomain: string): string {
  // Match href="http..." or href='http...' in anchor tags
  return html.replace(/href=["'](https?:\/\/[^"']+)["']/gi, (match, url) => {
    const hash = hashUrl(url);
    const quote = match[5]; // preserves original quote style
    return `href=${quote}https://${trackingDomain}/t/${emailId}/${hash}?url=${encodeURIComponent(url)}${quote}`;
  });
}

/**
 * Append a 1px transparent tracking pixel to the HTML body.
 *
 * @param html - The HTML email body
 * @param emailId - The email document ID
 * @param trackingDomain - The tracking domain
 * @returns Modified HTML with tracking pixel appended before </body> or at end
 */
export function addTrackingPixel(html: string, emailId: string, trackingDomain: string): string {
  const pixel = `<img src="https://${trackingDomain}/px/${emailId}.gif" width="1" height="1" style="display:none;border:0" alt="" />`;
  // Insert before </body> if present, otherwise append
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }
  return `${html}${pixel}`;
}
