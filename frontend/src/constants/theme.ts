import { Platform } from 'react-native';

// Design tokens: every color, size and spacing in the app comes from here.
// Change a value once and every screen follows.
//
// Colors come in a light and a dark set with the same names. Components get
// the right set from useTheme() (src/lib/theme.ts); never import a palette
// directly in a component.

export type Palette = {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  danger: string;
  // Muted orange: gentle caution, e.g. over the team's max.
  caution: string;
  // Bars and tracks that haven't reached a goal yet.
  track: string;
};

export const palettes: { light: Palette; dark: Palette } = {
  light: {
    background: '#f4f5f7',
    surface: '#ffffff',
    surfaceRaised: '#ffffff',
    text: '#111827',
    textMuted: '#6b7280',
    border: '#d1d5db',
    primary: '#111827',
    onPrimary: '#ffffff',
    danger: '#dc2626',
    caution: '#d9822b',
    track: '#e5e7eb',
  },
  dark: {
    background: '#0a0a0b',
    surface: '#1a1a1d',
    surfaceRaised: '#232327',
    text: '#f5f5f5',
    textMuted: '#9a9aa2',
    border: '#2e2e33',
    primary: '#f5f5f5',
    onPrimary: '#0a0a0b',
    danger: '#f87171',
    caution: '#e0a15a',
    track: '#2e2e33',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

// Monospace, for the small uppercase labels ("YOUR WEEK", "LEADERBOARD").
export const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, monospace',
});
