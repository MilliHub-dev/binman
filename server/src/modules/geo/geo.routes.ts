import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { ok } from '../../lib/http';
import { ServiceUnavailableError } from '../../lib/errors';
import { geocode, reverseGeocode } from '../../services/maps.service';
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

  // Tell the app up front whether we cover this spot, so it can warn before
  // the customer fills in the rest of the form.
  const parts = result.formattedAddress.split(',').map((part) => part.trim());
  const area = parts[1] ?? '';
  const city = parts[2] ?? '';
  const coverage = area && city ? await resolveServiceArea(area, city) : null;

  return ok(res, {
    ...result,
    coverage: coverage
      ? { serviceable: coverage.covered, areaName: coverage.area?.name ?? null }
      : { serviceable: null, areaName: null },
  });
});
