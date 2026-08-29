import type { Metadata, Viewport } from 'next';
import { Archivo, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { StructuredData } from '@/components/marketing/StructuredData';

/**
 * Two faces, two jobs.
 *
 * Archivo is a grotesque drawn for signage and high-impact headlines — it suits
 * a municipal-services brand that wants to look capable rather than cute, and
 * its heavy weights hold up at the display sizes this page uses.
 *
 * Plus Jakarta Sans handles running text, and is one of the faces named in
 * ui.md §2, so the web and the mobile app stay in the same typographic family.
 */
const display = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  weight: ['600', '700', '800', '900'],
  display: 'swap',
});

const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.binman.site'),
  title: {
    default: 'BinMan — Waste collection made simple in Uyo',
    template: '%s · BinMan',
  },
  description:
    'Book a waste pickup from your phone and our team collects it from your doorstep. Every collection photographed, timed and GPS-stamped. Serving Ewet Housing Estate, Shelter Afrique, Osongama, Aka Road, Oron Road and across Uyo.',
  keywords: [
    'waste collection Uyo',
    'refuse disposal Akwa Ibom',
    'waste management Uyo',
    'home cleaning Uyo',
    'waste pickup Uyo',
    'dustbin collection Uyo',
    'cleaning services Akwa Ibom',
  ],
  /**
   * Without a canonical, the same page reachable at www and apex, with and
   * without a trailing slash, competes with itself and splits its own ranking.
   */
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    siteName: 'BinMan',
    url: '/',
    title: 'BinMan — Waste collection made simple in Uyo',
    description:
      'Schedule a pickup and our team collects it from your doorstep. Uyo, Akwa Ibom.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BinMan — Waste collection made simple in Uyo',
    description: 'Book a pickup from your phone. Uyo, Akwa Ibom.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Let Google use a full-size preview image and an untruncated snippet.
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  category: 'Waste management',
};

export const viewport: Viewport = {
  themeColor: '#0B1A26',
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom is an accessibility requirement, not a nuisance.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh antialiased">
        <StructuredData />
        {children}
      </body>
    </html>
  );
}
