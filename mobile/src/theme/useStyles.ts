import { useMemo } from 'react';
import type { Colors } from './colors';
import { useTheme } from './ThemeProvider';

/**
 * Builds a component's stylesheet from the active palette.
 *
 * `StyleSheet.create` at module scope captures colours at import time, which is
 * why a theme switch could never reach them — the object is built once, before
 * anyone has chosen anything. Passing a factory instead defers the build to
 * render, so the sheet is rebuilt when (and only when) the palette changes.
 *
 *   const styles = useStyles(makeStyles);
 *
 *   const makeStyles = (c: Colors) =>
 *     StyleSheet.create({ card: { backgroundColor: c.surface } });
 *
 * The factory must live at module scope, not inside the component: it is the
 * memo key, so a new function identity each render would rebuild every frame.
 */
export const useStyles = <T>(factory: (colors: Colors) => T): T => {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
};
