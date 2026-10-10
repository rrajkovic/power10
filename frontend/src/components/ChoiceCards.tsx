import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { useThemedStyles } from '@/lib/theme';

export type Choice<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type ChoiceCardsProps<T extends string> = {
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
};

// Pick exactly one option, shown as cards stacked on top of each other.
export function ChoiceCards<T extends string>({ choices, value, onChange }: ChoiceCardsProps<T>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <Pressable
            key={choice.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(choice.value)}
            style={[styles.card, selected && styles.cardSelected]}
          >
            <View style={[styles.dot, selected && styles.dotSelected]} />
            <View style={styles.text}>
              <Text style={styles.label}>{choice.label}</Text>
              {choice.description ? (
                <Text style={styles.description}>{choice.description}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    list: {
      gap: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cardSelected: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    dot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.border,
    },
    dotSelected: {
      borderColor: colors.primary,
      borderWidth: 6,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    label: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    description: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
    },
  });
