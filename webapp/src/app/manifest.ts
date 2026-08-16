import type { MetadataRoute } from 'next';

/**
 * PWA manifest (Next 16 file convention: app/manifest.ts).
 *
 * `start_url` points at the driver app rather than the marketing site: the only
 * people who install this to a home screen are drivers, and landing them on the
 * marketing hero every shift would be friction they'd feel daily.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BinMan Driver',
    short_name: 'BinMan',
    description: 'Collection jobs, routes and proof of collection for BinMan drivers.',
    start_url: '/driver',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#189cf0',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/img/spashicon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/img/spashicon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
