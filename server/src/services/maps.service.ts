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
}

const GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6';

const enabled = (): boolean => {
  if (!env.MAPBOX_ACCESS_TOKEN) {
    log.debug('MAPBOX_ACCESS_TOKEN not set — geocoding skipped');
    return false;
  }
  return true;
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

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
}

/**
 * Road distance and travel time via the Mapbox Directions API — the basis for
 * the customer-facing ETA on the tracking screen (ui.md §23).
 */
export const drivingRoute = async (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): Promise<RouteResult | null> => {
  if (!enabled()) return null;

  try {
    const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
    const { data } = await axios.get(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`,
      {
        params: { access_token: env.MAPBOX_ACCESS_TOKEN, overview: 'false', alternatives: false },
        timeout: 10_000,
      },
    );

    const route = data?.routes?.[0];
    if (!route) return null;

    return {
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMinutes: Math.round(route.duration / 60),
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
