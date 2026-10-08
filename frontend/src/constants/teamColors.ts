// Preset accent colors offered when a team picks its colors.
// Teams can also enter any hex code. Shades are taken from common school
// colors so most teams find theirs, but the names stay generic.

export const presetTeamColors = [
  { name: 'Red', hex: '#C8102E' },
  { name: 'Crimson', hex: '#990000' },
  { name: 'Maroon', hex: '#7A0019' },
  { name: 'Orange', hex: '#E87722' },
  { name: 'Gold', hex: '#FFB81C' },
  { name: 'Yellow', hex: '#FFD100' },
  { name: 'Green', hex: '#00843D' },
  { name: 'Forest green', hex: '#154734' },
  { name: 'Teal', hex: '#008C95' },
  { name: 'Light blue', hex: '#4B9CD3' },
  { name: 'Blue', hex: '#0033A0' },
  { name: 'Navy', hex: '#011F5B' },
  { name: 'Purple', hex: '#4E2A84' },
  { name: 'Pink', hex: '#E31C79' },
  { name: 'Brown', hex: '#4E3629' },
  { name: 'Gray', hex: '#75787B' },
  { name: 'Black', hex: '#000000' },
] as const;

// Used until a team picks its own colors (matches the database default).
export const defaultTeamColors = {
  primary: '#0033A0',
  secondary: null,
} as const;
