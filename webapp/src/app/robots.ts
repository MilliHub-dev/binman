import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * The driver app is disallowed rather than merely unlisted.
 *
 * Its pages need a session, so a crawler reaching them gets a redirect or an
 * empty shell — content that would be indexed as a thin page under our domain.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/driver', '/driver/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
