/**
 * The one place the canonical origin is written down.
 *
 * Metadata, robots.txt and the sitemap all have to agree on it: a fetcher that
 * is handed a relative Open Graph URL, or a sitemap pointing at a different
 * host than the page it was linked from, treats the mismatch as a reason to
 * distrust the response.
 */
export const SITE_URL = 'https://crisescinema.storytimemaps.com';

/** Absolute URL for a site-root-relative path, e.g. abs('/reel'). */
export const abs = (path: string) => new URL(path, SITE_URL).toString();
