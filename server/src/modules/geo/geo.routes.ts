import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { ok } from '../../lib/http';
import { ServiceUnavailableError } from '../../lib/errors';
import { drivingRoute, geocode, reverseGeocode, staticMap } from '../../services/maps.service';
import { resolveServiceArea } from '../service-areas/service-areas.service';

/**
 * Geocoding proxied through the API (trsa.md §11).
 *
 * The Mapbox token stays server-side rather than shipping in the mobile bundle,
 * and every lookup comes back annotated with whether we actually serve that
 * location — so "Use My Location" (ui.md §11) can tell the customer straight
 * away instead of failing at checkout.
 */

const forwardQuery = z.object({
  q: z.string().trim().min(3, 'Enter at least 3 characters').max(200),
});

const reverseQuery = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

/**
 * Bounded deliberately. This endpoint spends money at Mapbox on every call, so
 * the size and zoom a client can ask for are capped rather than taken on trust.
 */
const staticMapQuery = reverseQuery.extend({
  zoom: z.coerce.number().min(1).max(18).default(15),
  width: z.coerce.number().int().min(64).max(800).default(600),
  height: z.coerce.number().int().min(64).max(600).default(300),
  retina: z.coerce.boolean().default(true),
});

export const geoRouter: Router = Router();

geoRouter.use(authenticate);

/** GET /api/v1/geo/search?q= — address autocomplete/lookup. */
geoRouter.get('/search', validate({ query: forwardQuery }), async (req: Request, res: Response) => {
  const { q } = req.query as unknown as z.infer<typeof forwardQuery>;
  const result = await geocode(q);

  if (!result) {
    throw new ServiceUnavailableError(
      'We could not look up that address right now. Please enter it manually.',
      'GEOCODING_UNAVAILABLE',
    );
  }

  return ok(res, result);
});

/** GET /api/v1/geo/reverse?latitude=&longitude= — "Use my location". */
geoRouter.get('/reverse', validate({ query: reverseQuery }), async (req: Request, res: Response) => {
  const { latitude, longitude } = req.query as unknown as z.infer<typeof reverseQuery>;
  const result = await reverseGeocode(latitude, longitude);

  if (!result) {
    throw new ServiceUnavailableError(
      'We could not identify that location. Please enter your address manually.',
      'GEOCODING_UNAVAILABLE',
    );
  }

  /**
   * Coverage is checked against the structured fields, not against slices of
   * the formatted string. Mapbox writes "Ikot Ekpene Road, Uyo 52, Akwa Ibom",
   * so the old positional read took "Uyo 52" as the area and the state as the
   * city — matched nothing, and told everyone we do not serve them.
   */
  const area = result.neighborhood ?? result.street ?? '';
  const city = result.city ?? '';
  const coverage = area && city ? await resolveServiceArea(area, city) : null;

  return ok(res, {
    ...result,
    coverage: coverage
      ? { serviceable: coverage.covered, areaName: coverage.area?.name ?? null }
      : { serviceable: null, areaName: null },
  });
});

/**
 * GET /api/v1/geo/static-map — a map image centred on a point.
 *
 * Streamed through the API so the app can show the customer where their pin
 * actually sits without the Mapbox token ever leaving the server.
 */
geoRouter.get(
  '/static-map',
  validate({ query: staticMapQuery }),
  async (req: Request, res: Response) => {
    const options = req.query as unknown as z.infer<typeof staticMapQuery>;
    const image = await staticMap(options);

    if (!image) {
      throw new ServiceUnavailableError(
        'The map is unavailable right now.',
        'STATIC_MAP_UNAVAILABLE',
      );
    }

    // Coordinates round to a small set in practice, so caching cuts the bill.
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(image);
  },
);

const routeQuery = z.object({
  fromLatitude: z.coerce.number().min(-90).max(90),
  fromLongitude: z.coerce.number().min(-180).max(180),
  toLatitude: z.coerce.number().min(-90).max(90),
  toLongitude: z.coerce.number().min(-180).max(180),
});

/**
 * GET /api/v1/geo/route — driving directions between two points.
 *
 * Returns the line to draw and the turn list, so a driver gets directions on
 * our own map instead of being handed off to someone else's app. Proxied for
 * the same reason as everything else here: the Mapbox token stays server-side,
 * and the request is authenticated so it cannot be used as a free directions
 * API by anyone who finds the URL.
 */
geoRouter.get('/route', validate({ query: routeQuery }), async (req: Request, res: Response) => {
  const q = req.query as unknown as z.infer<typeof routeQuery>;

  const route = await drivingRoute(
    { latitude: q.fromLatitude, longitude: q.fromLongitude },
    { latitude: q.toLatitude, longitude: q.toLongitude },
    { withGeometry: true },
  );

  if (!route) {
    throw new ServiceUnavailableError(
      'We could not work out a route right now.',
      'DIRECTIONS_UNAVAILABLE',
    );
  }

  return ok(res, route);
});
