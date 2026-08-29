import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Only pages worth ranking.
 *
 * The driver app is behind a login and has nothing for a search engine to index
 * — listing it would spend crawl budget on pages that answer no query and
 * cannot be reached without credentials.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
