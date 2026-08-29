import { BUSINESS, SERVICE_AREAS, SITE_URL } from '@/lib/site';

/**
 * JSON-LD describing the business, for Google's local results.
 *
 * A waste-collection company is found through searches like "waste collection
 * Uyo" and "refuse disposal near me", which are answered by the local pack
 * rather than ten blue links. Getting into that pack needs machine-readable
 * facts: what the business does, where it serves, how to reach it, and when.
 *
 * Everything below also appears in the visible page. Schema that claims more
 * than the page shows is a manual-action risk, not a shortcut.
 */
export function StructuredData() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        '@id': `${SITE_URL}/#business`,
        name: BUSINESS.name,
        description: BUSINESS.description,
        url: SITE_URL,
        telephone: BUSINESS.phone,
        email: BUSINESS.email,
        priceRange: '₦₦',
        currenciesAccepted: 'NGN',
        paymentAccepted: 'Credit Card, Debit Card, Bank Transfer',
        address: {
          '@type': 'PostalAddress',
          addressLocality: BUSINESS.city,
          addressRegion: BUSINESS.region,
          addressCountry: BUSINESS.country,
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: BUSINESS.latitude,
          longitude: BUSINESS.longitude,
        },
        // Named neighbourhoods, because that is how people search locally.
        areaServed: SERVICE_AREAS.map((area) => ({
          '@type': 'Place',
          name: `${area}, ${BUSINESS.city}`,
        })),
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: [
              'Monday',
              'Tuesday',
              'Wednesday',
              'Thursday',
              'Friday',
              'Saturday',
            ],
            opens: '07:00',
            closes: '17:00',
          },
        ],
      },
      {
        '@type': 'Service',
        '@id': `${SITE_URL}/#waste-collection`,
        serviceType: 'Waste collection',
        provider: { '@id': `${SITE_URL}/#business` },
        areaServed: { '@type': 'City', name: `${BUSINESS.city}, ${BUSINESS.region}` },
        description:
          'Household, commercial and garden waste collected from your door on a day you choose, with photographic proof of every collection.',
      },
      {
        '@type': 'Service',
        '@id': `${SITE_URL}/#home-cleaning`,
        serviceType: 'Home cleaning',
        provider: { '@id': `${SITE_URL}/#business` },
        areaServed: { '@type': 'City', name: `${BUSINESS.city}, ${BUSINESS.region}` },
        description:
          'Vetted cleaners for regular upkeep, a deep clean, or a move-out handover.',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: BUSINESS.name,
        publisher: { '@id': `${SITE_URL}/#business` },
        inLanguage: 'en-NG',
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // The content is built from constants in this repository, never from user
      // input, so there is nothing here for a script tag to smuggle.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
