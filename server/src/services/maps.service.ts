import axios from 'axios';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger('maps');

/**
 * Mapbox geocoding and distance (trsa.md §11).
 *
 * Every address should carry latitude/longitude so dispatch can plot it and a
 * driver can navigate to it. The mobile app supplies coordinates when the
 * customer picks a point on the map; when they type an address by hand, we
 * geocode it here rather than storing a location nobody can find.
 *
 * Geocoding is always best-effort: a failure must never block a customer from
 * saving an address, so every function returns null instead of throwing.
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  /** Mapbox confidence for the match, when supplied. */
  accuracy: string | null;
  /**
   * The address broken into the parts we actually use.
   *
   * Splitting `formattedAddress` on commas looked equivalent and was not:
   * Mapbox writes "Ikot Ekpene Road, Uyo 52, Akwa Ibom, Nigeria", so position 1
   * is the city fused with a postcode and position 2 is the state. Coverage was
   * being checked against "Uyo 52", matched nothing, and told every customer we
   * do not serve them.
   */
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
}

interface MapboxContext {
  street?: { name?: string };
  neighborhood?: { name?: string };
  locality?: { name?: string };
  place?: { name?: string };
  region?: { name?: string };
  postcode?: { name?: string };
}

/** Pulls the structured pieces out of a Mapbox feature. */
const partsOf = (properties: { context?: MapboxContext; name?: string } | undefined) => {
  const c = properties?.context ?? {};
  return {
    street: c.street?.name ?? properties?.name ?? null,
    // Mapbox only returns a neighbourhood in denser mapping; the street is the
    // best stand-in, and is what BinMan's service areas are actually named for.
    neighborhood: c.neighborhood?.name ?? c.locality?.name ?? c.street?.name ?? null,
    city: c.place?.name ?? null,
    state: c.region?.name ?? null,
    postcode: c.postcode?.name ?? null,
  };
};

const GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6';
const STATIC_URL = 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static';

const enabled = (): boolean => {
  if (!env.MAPBOX_ACCESS_TOKEN) {
    log.debug('MAPBOX_ACCESS_TOKEN not set — geocoding skipped');
    return false;
  }
  return true;
};

/**
 * A rendered map image centred on a point, with a pin on it.
 *
 * Fetched here rather than in the app so the Mapbox token keeps the same
 * server-side-only property the geocoding endpoints already rely on. The
 * alternative — a native map SDK — would also mean every developer rebuilding
 * their development client to see an address form.
 */
export const staticMap = async (options: {
  latitude: number;
  longitude: number;
  zoom: number;
  width: number;
  height: number;
  retina: boolean;
}): Promise<Buffer | null> => {
  if (!enabled()) return null;

  const { latitude, longitude, zoom, width, height, retina } = options;
  // Mapbox wants longitude first, and the pin colour without a leading hash.
  const marker = `pin-l+189CF0(${longitude},${latitude})`;
  const url =
    `${STATIC_URL}/${marker}/${longitude},${latitude},${zoom},0/` +
    `${width}x${height}${retina ? '@2x' : ''}`;

  try {
    const { data } = await axios.get<ArrayBuffer>(url, {
      params: { access_token: env.MAPBOX_ACCESS_TOKEN, attribution: 'false', logo: 'false' },
      responseType: 'arraybuffer',
      timeout: 10_000,
    });
    return Buffer.from(data);
  } catch (err) {
    log.warn({ err }, 'static map render failed');
    return null;
  }
};

/** Free-text address to coordinates. */
export const geocode = async (query: string): Promise<GeocodeResult | null> => {
  if (!enabled() || !query.trim()) return null;

  try {
    const { data } = await axios.get(`${GEOCODE_URL}/forward`, {
      params: {
        q: query.trim(),
        access_token: env.MAPBOX_ACCESS_TOKEN,
        country: env.MAPBOX_COUNTRY,
        limit: 1,
        types: 'address,street,place,locality,neighborhood',
      },
      timeout: 10_000,
    });

    const feature = data?.features?.[0];
    if (!feature) return null;

    // GeoJSON order is [longitude, latitude] — not the other way round.
    const [longitude, latitude] = feature.geometry?.coordinates ?? [];
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

    return {
      latitude,
      longitude,
      formattedAddress: feature.properties?.full_address ?? feature.properties?.name ?? query,
      accuracy: feature.properties?.match_code?.confidence ?? null,
      ...partsOf(feature.properties),
    };
  } catch (err) {
    log.error({ err: axios.isAxiosError(err) ? err.message : err, query }, 'geocode failed');
    return null;
  }
};

/** Coordinates to a human-readable address, for "use my location". */
export const reverseGeocode = async (
  latitude: number,
  longitude: number,
): Promise<GeocodeResult | null> => {
  if (!enabled()) return null;

  try {
    const { data } = await axios.get(`${GEOCODE_URL}/reverse`, {
      params: {
        latitude,
        longitude,
        access_token: env.MAPBOX_ACCESS_TOKEN,
        limit: 1,
      },
      timeout: 10_000,
    });

    const feature = data?.features?.[0];
    if (!feature) return null;

    return {
      latitude,
      longitude,
      formattedAddress: feature.properties?.full_address ?? feature.properties?.name ?? '',
      accuracy: feature.properties?.match_code?.confidence ?? null,
      ...partsOf(feature.properties),
    };
  } catch (err) {
    log.error({ err: axios.isAxiosError(err) ? err.message : err }, 'reverse geocode failed');
    return null;
  }
};

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Straight-line distance in kilometres. No API call, so it is free and instant —
 * good enough for sorting nearby drivers on the dispatch board. Use
 * `drivingRoute` when the actual road distance matters.
 */
export const haversineKm = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number => {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export interface RouteStep {
  /** "Turn left onto Aka Road" — Mapbox's own wording. */
  instruction: string;
  distanceMetres: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  /**
   * GeoJSON LineString coordinates, [longitude, latitude] — GeoJSON order, not
   * the lat/lng order the rest of this file uses. Present only when the caller
   * asks for geometry, since it is far larger than the summary.
   */
  geometry?: Array<[number, number]>;
  steps?: RouteStep[];
}

/**
 * Road distance and travel time via the Mapbox Directions API — the basis for
 * the customer-facing ETA on the tracking screen (ui.md §23).
 */
export const drivingRoute = async (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  options: { withGeometry?: boolean } = {},
): Promise<RouteResult | null> => {
  if (!enabled()) return null;

  try {
    const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
    const { data } = await axios.get(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`,
      {
        params: {
          access_token: env.MAPBOX_ACCESS_TOKEN,
          alternatives: false,
          // The ETA callers only need distance and duration; asking for the
          // line and the turn list as well would triple the payload for them.
          overview: options.withGeometry ? 'full' : 'false',
          geometries: 'geojson',
          steps: options.withGeometry ? true : false,
        },
        timeout: 10_000,
      },
    );

    const route = data?.routes?.[0];
    if (!route) return null;

    const summary: RouteResult = {
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMinutes: Math.round(route.duration / 60),
    };

    if (!options.withGeometry) return summary;

    return {
      ...summary,
      geometry: (route.geometry?.coordinates ?? []) as Array<[number, number]>,
      steps: (route.legs?.[0]?.steps ?? []).map(
        (step: { maneuver?: { instruction?: string }; distance?: number }) => ({
          instruction: step.maneuver?.instruction ?? '',
          distanceMetres: Math.round(step.distance ?? 0),
        }),
      ),
    };
  } catch (err) {
    log.error({ err: axios.isAxiosError(err) ? err.message : err }, 'directions lookup failed');
    return null;
  }
};

/** Builds the one-line query string we geocode an address record from. */
export const addressToQuery = (address: {
  addressLine: string;
  area: string;
  city: string;
  state: string;
}): string => [address.addressLine, address.area, address.city, address.state].filter(Boolean).join(', ');
