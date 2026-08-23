import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { getImageDataUri } from '../api/client';
import { radius, spacing, useStyles, useTheme, type Colors } from '../theme';
import { Text } from './Text';

/**
 * Pick a point on a map.
 *
 * Backed by a rendered map image from the API rather than a native map SDK.
 * A real SDK (@rnmapbox/maps, react-native-maps) is a native module, so adding
 * one forces every developer and every tester onto a fresh development build
 * just to open an address form. This gives the thing that actually matters —
 * seeing where the pin sits, and being able to move it — with no native code.
 *
 * The trade is honest: no smooth pan or pinch. Tapping recentres, and the zoom
 * controls step. For confirming "yes, that is my gate", that is enough.
 */

const TILE = 256;

/** Web Mercator, the projection Mapbox renders these images in. */
const project = (latitude: number, longitude: number, zoom: number) => {
  const scale = TILE * 2 ** zoom;
  const sinLat = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
};

const unproject = (x: number, y: number, zoom: number) => {
  const scale = TILE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return {
    longitude: (x / scale) * 360 - 180,
    latitude: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
  };
};

interface Props {
  latitude: number;
  longitude: number;
  onChange: (point: { latitude: number; longitude: number }) => void;
  height?: number;
}

/** Rendered maps are immutable for a given URL, so they are worth keeping. */
const CACHE = new Map<string, string>();

const MIN_ZOOM = 12;
const MAX_ZOOM = 18;

export const MapPicker: React.FC<Props> = ({ latitude, longitude, onChange, height = 220 }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [zoom, setZoom] = useState(16);
  const [size, setSize] = useState({ width: 0, height });
  const [image, setImage] = useState<string>();
  const [failed, setFailed] = useState(false);

  const path =
    size.width > 0
      ? `/geo/static-map?latitude=${latitude.toFixed(6)}&longitude=${longitude.toFixed(6)}` +
        `&zoom=${zoom}&width=${Math.round(size.width)}&height=${Math.round(size.height)}`
      : null;

  /**
   * Fetched through the API client rather than handed to `<Image>` as a URL, so
   * an expired access token is refreshed and retried instead of turning into a
   * blank map. Results are cached because panning re-requests the same tiles.
   */
  useEffect(() => {
    if (!path) return;
    let cancelled = false;

    const cached = CACHE.get(path);
    if (cached) {
      setImage(cached);
      setFailed(false);
      return;
    }

    void getImageDataUri(path)
      .then((uri) => {
        CACHE.set(path, uri);
        if (!cancelled) {
          setImage(uri);
          setFailed(false);
        }
      })
      .catch((err) => {
        if (__DEV__) console.warn('[MapPicker] map image failed:', (err as Error).message);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  const ready = Boolean(image);

  const handleTap = (x: number, y: number) => {
    const centre = project(latitude, longitude, zoom);
    const next = unproject(
      centre.x + (x - size.width / 2),
      centre.y + (y - size.height / 2),
      zoom,
    );
    onChange(next);
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={[styles.canvas, { height }]}
        onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height })}
        onPress={(e) => handleTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        accessibilityRole="adjustable"
        accessibilityLabel="Map. Tap to move the pin to your exact location."
      >
        {ready && !failed ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}

        {!ready && !failed ? <ActivityIndicator color={colors.brand} /> : null}

        {failed ? (
          <Text variant="caption" tone="muted" center style={styles.failed}>
            The map could not load. Your address will still save — the coordinates just
            help the driver find you.
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.zoomColumn}>
        <Pressable
          style={styles.zoomButton}
          onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
          disabled={zoom >= MAX_ZOOM}
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
        >
          <Text style={styles.zoomGlyph}>+</Text>
        </Pressable>
        <Pressable
          style={styles.zoomButton}
          onPress={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
          disabled={zoom <= MIN_ZOOM}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
        >
          <Text style={styles.zoomGlyph}>−</Text>
        </Pressable>
      </View>

      <Text variant="caption" tone="muted" style={styles.hint}>
        Tap the map to move the pin to your gate.
      </Text>
    </View>
  );
};

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrapper: { marginTop: spacing.base },
    canvas: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: c.surfaceSubtle,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    failed: { padding: spacing.lg },
    zoomColumn: {
      position: 'absolute',
      right: spacing.md,
      top: spacing.md,
      gap: spacing.xs,
    },
    zoomButton: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomGlyph: { fontSize: 18, fontWeight: '600', color: c.text, lineHeight: 22 },
    hint: { marginTop: spacing.sm },
  });
