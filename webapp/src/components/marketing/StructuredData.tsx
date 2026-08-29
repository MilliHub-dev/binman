import { BUSINESS, CITIES, SITE_URL } from '@/lib/site';

/**
 * JSON-LD describing the business, for Google's local results.
 *
 * A waste-collection company is found through searches like "waste collection
 * Uyo" and "refuse disposal near me", which are answered by the local pack
 * rather than ten blue links. Getting into that pack needs machine-readable
 * facts: what the business does, where it serves, how to reach it, and when.
 *
 * Two cities means two LocalBusiness nodes under one Organization, not one node
 * with an averaged address. A single business entity claiming both Uyo and
 * Abuja would be placed at whichever coordinates it carried, so half the
 * service area would rank for the wrong city — or neither.
 *
 * Everything here also appears in the visible page. Schema that claims more
 * than the page shows is a manual-action risk, not a shortcut.
 */
export function StructuredData() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: BUSINESS.name,
        legalName: BUSINESS.legalName,
        description: BUSINESS.description,
        url: SITE_URL,
        logo: `${SITE_URL}/og-image.png`,
        image: `${SITE_URL}/og-image.png`,
        email: BUSINESS.email,
        telephone: BUSINESS.phone,
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: BUSINESS.phone,
          email: BUSINESS.email,
          contactType: 'customer service',
          areaServed: 'NG',
          availableLanguage: ['en'],
        },
      },

      ...CITIES.map((city) => ({
        '@type': 'LocalBusiness',
        '@id': `${SITE_URL}/#business-${city.name.toLowerCase()}`,
        name: `${BUSINESS.name} ${city.name}`,
        description: `Waste collection and home cleaning in ${city.name}, ${city.region}.`,
        url: SITE_URL,
        image: `${SITE_URL}/og-image.png`,
        telephone: BUSINESS.phone,
        email: BUSINESS.email,
        parentOrganization: { '@id': `${SITE_URL}/#organization` },
        priceRange: '₦₦',
        currenciesAccepted: 'NGN',
        paymentAccepted: 'Credit Card, Debit Card, Bank Transfer',
        address: {
          '@type': 'PostalAddress',
          addressLocality: city.name,
          addressRegion: city.region,
          addressCountry: BUSINESS.country,
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: city.latitude,
          longitude: city.longitude,
        },
        // Named neighbourhoods, because that is how people search locally.
        areaServed: city.areas.map((area) => ({
          '@type': 'Place',
          name: `${area}, ${city.name}`,
        })),
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            opens: '07:00',
            closes: '17:00',
          },
        ],
      })),

      {
        '@type': 'Service',
        '@id': `${SITE_URL}/#waste-collection`,
        serviceType: 'Waste collection',
        provider: { '@id': `${SITE_URL}/#organization` },
        areaServed: CITIES.map((city) => ({
          '@type': 'City',
          name: `${city.name}, ${city.region}`,
        })),
        description:
          'Household, commercial and garden waste collected from your door on a day you choose, with photographic proof of every collection.',
      },
      {
        '@type': 'Service',
        '@id': `${SITE_URL}/#home-cleaning`,
        serviceType: 'Home cleaning',
        provider: { '@id': `${SITE_URL}/#organization` },
        areaServed: CITIES.map((city) => ({
          '@type': 'City',
          name: `${city.name}, ${city.region}`,
        })),
        description:
          'Vetted cleaners for regular upkeep, a deep clean, or a move-out handover.',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: BUSINESS.name,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en-NG',
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Built from constants in this repository, never from user input, so
      // there is nothing here for a script tag to smuggle.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
