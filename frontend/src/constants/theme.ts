// Design tokens: every color, size and spacing in the app comes from here.
// Change a value once and every screen follows.

export const colors = {
  background: '#f4f5f7',
  surface: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#d1d5db',
  primary: '#111827',
  onPrimary: '#ffffff',
  danger: '#dc2626',
} as const;

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
  sm: 13,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;
