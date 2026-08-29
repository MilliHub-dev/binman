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
    'On-demand waste collection and home cleaning in Uyo, Akwa Ibom State. Book a pickup from your phone and a team collects it from your doorstep.',
  phone: SUPPORT_PHONE,
  email: SUPPORT_EMAIL,
  city: 'Uyo',
  region: 'Akwa Ibom',
  country: 'NG',
  /** Uyo city centre — the service area, not a shopfront. */
  latitude: 5.0378,
  longitude: 7.9128,
} as const;

/** The nine areas served, which is what people actually search for. */
export const SERVICE_AREAS = [
  'Ewet Housing Estate',
  'Shelter Afrique',
  'Osongama Estate',
  'Aka Road',
  'Oron Road',
  'Nwaniba Road',
  'Ikot Ekpene Road',
  'Abak Road',
  'Itam',
] as const;
