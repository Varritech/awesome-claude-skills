import { describe, it, expect } from 'vitest';
import { wrapLinks, addTrackingPixel, hashUrl } from './tracking';

describe('hashUrl', () => {
  it('returns 8-char hex string', () => {
    const h = hashUrl('https://example.com');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic for the same URL', () => {
    expect(hashUrl('https://example.com')).toBe(hashUrl('https://example.com'));
  });

  it('produces different hashes for different URLs', () => {
    expect(hashUrl('https://example.com')).not.toBe(hashUrl('https://other.com'));
  });
});

describe('wrapLinks', () => {
  it('wraps a single http link', () => {
    const html = '<a href="https://example.com">Click</a>';
    const result = wrapLinks(html, 'em_abc', 'track.test.com');
    expect(result).toContain('https://track.test.com/t/em_abc/');
    expect(result).toContain('url=https%3A%2F%2Fexample.com');
    expect(result).not.toContain('href="https://example.com"');
  });

  it('preserves text and other HTML attributes', () => {
    const html = '<a href="https://example.com" class="btn">Click here</a>';
    const result = wrapLinks(html, 'em_abc', 'track.test.com');
    expect(result).toContain('class="btn"');
    expect(result).toContain('Click here');
  });

  it('wraps multiple links', () => {
    const html = '<a href="https://a.com">A</a> <a href="https://b.com">B</a>';
    const result = wrapLinks(html, 'em_abc', 'track.test.com');
    const matches = result.match(/https:\/\/track\.test\.com\/t\/em_abc\//g);
    expect(matches).toHaveLength(2);
  });

  it('does not wrap non-http links (mailto, tel)', () => {
    const html = '<a href="mailto:test@example.com">Email</a>';
    const result = wrapLinks(html, 'em_abc', 'track.test.com');
    expect(result).toContain('mailto:test@example.com');
    expect(result).not.toContain('/t/em_abc/');
  });

  it('uses the emailId in the tracking URL path', () => {
    const result = wrapLinks('<a href="https://x.com">X</a>', 'em_xyz123', 'track.test.com');
    expect(result).toContain('/t/em_xyz123/');
  });

  it('handles single-quoted hrefs', () => {
    const html = "<a href='https://example.com'>Click</a>";
    const result = wrapLinks(html, 'em_abc', 'track.test.com');
    expect(result).toContain("href='https://track.test.com/t/em_abc/");
  });

  it('returns unchanged HTML when no links present', () => {
    const html = '<p>No links here.</p>';
    expect(wrapLinks(html, 'em_abc', 'track.test.com')).toBe(html);
  });
});

describe('addTrackingPixel', () => {
  it('appends pixel before </body>', () => {
    const html = '<html><body><p>Hello</p></body></html>';
    const result = addTrackingPixel(html, 'em_abc', 'track.test.com');
    expect(result).toContain('https://track.test.com/px/em_abc.gif');
    expect(result.indexOf('em_abc.gif')).toBeLessThan(result.indexOf('</body>'));
  });

  it('appends pixel at end when no </body> tag', () => {
    const html = '<p>Hello</p>';
    const result = addTrackingPixel(html, 'em_abc', 'track.test.com');
    expect(result.endsWith('https://track.test.com/px/em_abc.gif" width="1" height="1" style="display:none;border:0" alt="" />')).toBe(true);
  });

  it('pixel has display:none style', () => {
    const result = addTrackingPixel('<p>Hi</p>', 'em_abc', 'track.test.com');
    expect(result).toContain('display:none');
  });

  it('pixel uses correct emailId', () => {
    const result = addTrackingPixel('<p>Hi</p>', 'em_unique_42', 'track.test.com');
    expect(result).toContain('/px/em_unique_42.gif');
  });
});
