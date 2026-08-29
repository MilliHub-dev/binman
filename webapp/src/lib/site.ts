/**
 * Facts about the business that search engines and social cards both need.
 *
 * Kept in one place because the same address, phone number and service areas
 * appear in the page copy, the structured data and the Open Graph tags — and a
 * business whose schema disagrees with its visible content is worse than one
 * with no schema at all.
 */
import { SUPPORT_EMAIL, SUPPORT_PHONE } from './contact';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.binman.site';

export const BUSINESS = {
  name: 'BinMan',
  legalName: 'BinMan',
  description:
    'On-demand waste collection and home cleaning in Uyo and Abuja. Book a pickup from your phone and a team collects it from your doorstep.',
  phone: SUPPORT_PHONE,
  email: SUPPORT_EMAIL,
  country: 'NG',
} as const;

/**
 * Where we operate.
 *
 * Cities carry their own coordinates because a single point cannot represent
 * two markets 700km apart, and a wrong one puts the business in the wrong
 * local results entirely.
 *
 * The named areas are the ones people actually type — "waste collection Wuse"
 * far outnumbers "waste collection Abuja" — so they are listed individually in
 * the structured data.
 */
export const CITIES = [
  {
    name: 'Uyo',
    region: 'Akwa Ibom',
    latitude: 5.0378,
    longitude: 7.9128,
    areas: [
      'Ewet Housing Estate',
      'Shelter Afrique',
      'Osongama Estate',
      'Aka Road',
      'Oron Road',
      'Nwaniba Road',
      'Ikot Ekpene Road',
      'Abak Road',
      'Itam',
    ],
  },
  {
    name: 'Abuja',
    region: 'Federal Capital Territory',
    latitude: 9.0765,
    longitude: 7.3986,
    /**
     * These are the areas the API actually holds, not a plausible list of
     * Abuja districts. Advertising a district the booking flow then refuses
     * turns a search result into a dead end.
     */
    areas: ['Wuse', 'Wuse 2', 'Garki', 'Maitama', 'Asokoro', 'Gwarinpa', 'Jabi'],
  },
] as const;

/** Every named area across both cities, flattened. */
export const SERVICE_AREAS = CITIES.flatMap((city) =>
  city.areas.map((area) => ({ area, city: city.name })),
);
