import { useMemo, useSyncExternalStore } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { palettes, type Palette } from '@/constants/theme';
import {
  rememberThemePreference,
  savedThemePreference,
  type ThemePreference,
} from './deviceMemory';

// Light or dark. By default the app follows the phone; Profile lets you pick
// one, and this device remembers the choice.

let preference: ThemePreference = savedThemePreference();
const listeners = new Set<() => void>();

// On phones, also tell the system, so things it draws itself (the tab bar,
// menus, the keyboard) match. Browsers don't have that, so there the choice
// only changes what the app draws.
function applyToSystem(choice: ThemePreference) {
  if (Platform.OS === 'web') return;
  // 'unspecified' means "follow the phone" again.
  Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
}

applyToSystem(preference);

export function setThemePreference(choice: ThemePreference) {
  preference = choice;
  rememberThemePreference(choice);
  applyToSystem(choice);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// What's chosen in Profile: 'system', 'light' or 'dark'.
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribe,
    () => preference,
    () => preference,
  );
}

// The current color set.
export function useTheme() {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const chosen = useThemePreference();
  const scheme = chosen === 'system' ? system : chosen;
  return { scheme, colors: palettes[scheme] } as const;
}

// Styles that depend on the theme. Pass a module-level function that returns
// StyleSheet.create({...}) from the colors; it's rebuilt only when the theme
// changes.
export function useThemedStyles<T>(makeStyles: (colors: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [makeStyles, colors]);
}
