'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getRoute, type DrivingRoute } from '@/lib/driver';

/**
 * The stop, and the way there, in the page.
 *
 * The driver used to get a button that threw them out to Google Maps in a new
 * tab — which loses the job screen and, on a phone, means leaving the app
 * entirely. Directions are now drawn on this map from our own Mapbox route, so
 * the whole job stays on one screen.
 *
 * The turn list is text rather than spoken navigation. A browser tab cannot
 * hold a driving session — it stops when the screen locks — so this is for
 * orienting before setting off and for the last hundred metres, which is the
 * part a map app is worst at anyway.
 */

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const ROUTE_SOURCE = 'job-route';

interface Props {
  latitude: number | null;
  longitude: number | null;
  /** Shown as the marker's label, so the driver can confirm the right stop. */
  label: string;
}

export function JobMap({ latitude, longitude, label }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState<DrivingRoute | null>(null);
  const [error, setError] = useState<string>();

  const hasPoint = latitude !== null && longitude !== null;

  useEffect(() => {
    if (!container.current || !hasPoint || map.current) return;
    if (!TOKEN) {
      setFailed(true);
      return;
    }

    mapboxgl.accessToken = TOKEN;

    try {
      const instance = new mapboxgl.Map({
        container: container.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [longitude, latitude],
        zoom: 15,
        attributionControl: false,
      });

      instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      instance.addControl(new mapboxgl.AttributionControl({ compact: true }));

      new mapboxgl.Marker({ color: '#189CF0' })
        .setLngLat([longitude, latitude])
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setText(label))
        .addTo(instance);

      instance.on('load', () => setReady(true));
      instance.on('error', () => setFailed(true));
      map.current = instance;
    } catch {
      setFailed(true);
    }

    return () => {
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
  }, [hasPoint, latitude, longitude, label]);

  /** Draws the returned line, replacing any previous one. */
  const drawRoute = (coordinates: Array<[number, number]>) => {
    const instance = map.current;
    if (!instance || !ready) return;

    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates },
    };

    const existing = instance.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }

    instance.addSource(ROUTE_SOURCE, { type: 'geojson', data });
    // Casing underneath so the line stays legible over dark roads and parks.
    instance.addLayer({
      id: `${ROUTE_SOURCE}-casing`,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#FFFFFF', 'line-width': 9, 'line-opacity': 0.9 },
    });
    instance.addLayer({
      id: `${ROUTE_SOURCE}-line`,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#189CF0', 'line-width': 5 },
    });
  };

  const showDirections = () => {
    if (!map.current || !hasPoint) return;
    setBusy(true);
    setError(undefined);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const me = { latitude: position.coords.latitude, longitude: position.coords.longitude };

        if (driverMarker.current) driverMarker.current.setLngLat([me.longitude, me.latitude]);
        else
          driverMarker.current = new mapboxgl.Marker({ color: '#74AC26' })
            .setLngLat([me.longitude, me.latitude])
            .addTo(map.current!);

        try {
          const result = await getRoute(me, { latitude: latitude!, longitude: longitude! });
          setRoute(result);
          drawRoute(result.geometry);

          const bounds = result.geometry.reduce(
            (box, point) => box.extend(point),
            new mapboxgl.LngLatBounds(result.geometry[0], result.geometry[0]),
          );
          map.current!.fitBounds(bounds, { padding: 48, maxZoom: 16 });
        } catch {
          setError('Could not work out a route. The map still shows the stop.');
          map.current!.fitBounds(
            [
              [me.longitude, me.latitude],
              [longitude!, latitude!],
            ],
            { padding: 64, maxZoom: 16 },
          );
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        setError('Location is off. Turn it on to get directions from where you are.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  if (!hasPoint) {
    return (
      <p className="mt-4 rounded-lg bg-ink-100 px-3 py-3 text-sm text-ink-600">
        This address has no map location saved. Use the address above, or call the customer.
      </p>
    );
  }

  if (failed) {
    return (
      <p className="mt-4 rounded-lg bg-ink-100 px-3 py-3 text-sm text-ink-600">
        The map could not load. The address above is still correct — call the customer if you need
        landmarks.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div
        ref={container}
        className="h-64 w-full overflow-hidden rounded-card border-2 border-ink-200"
        aria-label={`Map showing ${label}`}
      />

      <button
        type="button"
        onClick={showDirections}
        disabled={busy}
        className="tap-target mt-2 flex w-full items-center justify-center rounded-xl bg-ink-900 font-semibold text-white disabled:opacity-60"
      >
        {busy ? 'Working out the route…' : route ? 'Update route' : 'Directions from where I am'}
      </button>

      {error ? <p className="mt-2 text-sm text-ink-600">{error}</p> : null}

      {route ? (
        <div className="mt-3 rounded-card border-2 border-ink-200 bg-white p-4">
          <p className="text-lg font-extrabold tracking-tight">
            {route.distanceKm} km · about {route.durationMinutes} min
          </p>

          <ol className="mt-3 space-y-2">
            {route.steps.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm">
                <span className="mt-0.5 min-w-14 font-semibold tabular-nums text-ink-500">
                  {step.distanceMetres >= 1000
                    ? `${(step.distanceMetres / 1000).toFixed(1)} km`
                    : `${step.distanceMetres} m`}
                </span>
                <span className="text-ink-700">{step.instruction}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
