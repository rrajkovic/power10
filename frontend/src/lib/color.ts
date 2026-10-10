// Small helpers for team colors ('#RRGGBB').

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

// Blend two colors: amount 0 = a, 1 = b.
export function mix(a: string, b: string, amount: number): string {
  const ca = parse(a);
  const cb = parse(b);
  return toHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * amount) as [number, number, number]);
}

// The same color with transparency, e.g. withAlpha('#0033A0', 0.2).
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Black or white, whichever is easier to read on top of this color.
export function readableOn(hex: string): '#000000' | '#ffffff' {
  const [r, g, b] = parse(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? '#000000' : '#ffffff';
}

// The team's two accent colors. Without a secondary, use a lighter shade of
// the primary.
export function teamAccents(primary: string, secondary: string | null) {
  return { primary, secondary: secondary ?? mix(primary, '#ffffff', 0.45) };
}

// Team colors can be anything, including colors that disappear against the
// background (navy in dark mode, yellow in light mode). Nudge the color
// toward readable when used for bars and highlights.
export function visibleAccent(hex: string, scheme: 'light' | 'dark'): string {
  const isLight = readableOn(hex) === '#000000';
  if (scheme === 'dark' && !isLight) return mix(hex, '#ffffff', 0.35);
  if (scheme === 'light' && isLight) return mix(hex, '#000000', 0.25);
  return hex;
}
