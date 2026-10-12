import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Muted } from '@/components/Typography';
import { presetTeamColors } from '@/constants/teamColors';
import { fontSize, spacing, type Palette } from '@/constants/theme';
import { isTimeZone, parseHexColor, teamWrites } from '@/lib/settings';
import type { MyTeam } from '@/lib/teams';
import { useThemedStyles } from '@/lib/theme';
import { DeleteTeam } from './DeleteTeam';
import { Card, SavedField } from './parts';
import type { Save } from './types';

// The team's name, colors and time zone.
export function TeamSection({ team, save }: { team: MyTeam; save: Save }) {
  const styles = useThemedStyles(makeStyles);
  const update = (changes: Parameters<typeof teamWrites.update>[1]) =>
    save(teamWrites.update(team.id, changes));

  return (
    <>
      <Card title="Name">
        <SavedField
          saved={team.name}
          onSave={(name) => update({ name })}
          check={(text) => (text.trim().length < 1 || text.trim().length > 80 ? 'Between 1 and 80 letters' : null)}
        />
      </Card>

      <Card
        title="Colors"
        hint="Used for the glow behind the screen, progress bars and highlights. Text stays readable on any color."
      >
        <Muted style={styles.label}>Main color</Muted>
        <Swatches
          selected={team.accentPrimary}
          onPick={(hex) => hex && update({ accent_primary: hex })}
        />
        <SavedField
          label="Or any color, as a hex code"
          saved={team.accentPrimary.toUpperCase()}
          placeholder="#0033A0"
          check={(text) => (parseHexColor(text) ? null : 'Six letters or digits, like #0033A0')}
          onSave={(text) => update({ accent_primary: parseHexColor(text)! })}
        />
        <Muted style={styles.label}>Second color (optional)</Muted>
        <Swatches
          selected={team.accentSecondary}
          onPick={(hex) => update({ accent_secondary: hex })}
          allowNone
        />
        <SavedField
          label="Or any color, as a hex code"
          saved={team.accentSecondary?.toUpperCase() ?? ''}
          placeholder="None"
          check={(text) =>
            !text.trim() || parseHexColor(text) ? null : 'Six letters or digits, or leave it empty'
          }
          onSave={(text) => update({ accent_secondary: text.trim() ? parseHexColor(text) : null })}
        />
      </Card>

      <Card
        title="Time zone"
        hint="Decides which day a workout belongs to, and when a week starts and ends. Use a name like America/New_York or Europe/Belgrade."
      >
        <SavedField
          saved={team.timeZone}
          onSave={(time_zone) => update({ time_zone })}
          check={(text) => (isTimeZone(text) ? null : 'That isn’t a time zone name')}
        />
      </Card>

      <DeleteTeam team={team} />
    </>
  );
}

function Swatches({
  selected,
  onPick,
  allowNone = false,
}: {
  selected: string | null;
  onPick: (hex: string | null) => void;
  allowNone?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const current = selected?.toUpperCase() ?? null;
  return (
    <View style={styles.swatches}>
      {allowNone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="No second color"
          accessibilityState={{ selected: current === null }}
          onPress={() => onPick(null)}
          style={[styles.swatch, styles.noneSwatch, current === null && styles.swatchSelected]}
        >
          <Text style={styles.noneText}>–</Text>
        </Pressable>
      ) : null}
      {presetTeamColors.map((color) => (
        <Pressable
          key={color.hex}
          accessibilityRole="button"
          accessibilityLabel={color.name}
          accessibilityState={{ selected: current === color.hex.toUpperCase() }}
          onPress={() => onPick(color.hex)}
          style={[
            styles.swatch,
            { backgroundColor: color.hex },
            current === color.hex.toUpperCase() && styles.swatchSelected,
          ]}
        />
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    label: {
      fontSize: fontSize.sm,
      color: colors.text,
    },
    swatches: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    swatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: colors.border,
    },
    swatchSelected: {
      borderWidth: 3,
      borderColor: colors.text,
    },
    noneSwatch: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    noneText: {
      fontSize: fontSize.md,
      color: colors.textMuted,
    },
  });
