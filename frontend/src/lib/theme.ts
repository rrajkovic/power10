import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { palettes, type Palette } from '@/constants/theme';

// The current color set: dark when the phone is in dark mode, light otherwise.
// (A Light / Dark / System override in settings comes later.)
export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palettes[scheme] } as const;
}

// Styles that depend on the theme. Pass a module-level function that returns
// StyleSheet.create({...}) from the colors; it's rebuilt only when the theme
// changes.
export function useThemedStyles<T>(makeStyles: (colors: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [makeStyles, colors]);
}
