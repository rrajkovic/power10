import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from '@/components/TextField';
import { fontSize, fontWeight, spacing, type Palette } from '@/constants/theme';
import { withAlpha } from '@/lib/color';
import { groupReactions, useToggleReaction, type FeedSession } from '@/lib/feed';
import { useSession } from '@/lib/session';
import { useThemedStyles } from '@/lib/theme';

// One tap away. Any other emoji can be typed in.
const QUICK_EMOJI = ['👏', '🔥', '💪', '🙌', '😮', '❤️'];

// The reactions on a workout: tap one to add yours or take it back, and ＋
// to pick another.
export function ReactionBar({ session, accent }: { session: FeedSession; accent: string }) {
  const styles = useThemedStyles(makeStyles);
  const { session: auth } = useSession();
  const userId = auth?.user.id;
  const toggle = useToggleReaction();
  const [picking, setPicking] = useState(false);
  const [custom, setCustom] = useState('');

  const groups = groupReactions(session.reactions, userId);

  function react(emoji: string) {
    if (!userId || !emoji.trim()) return;
    toggle.mutate({ session, userId, emoji: emoji.trim() });
    setPicking(false);
    setCustom('');
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {groups.map((group) => (
          <Pressable
            key={group.emoji}
            accessibilityRole="button"
            accessibilityLabel={`${group.emoji} ${group.count}`}
            accessibilityState={{ selected: group.mine }}
            onPress={() => react(group.emoji)}
            style={({ pressed }) => [
              styles.chip,
              group.mine && { borderColor: accent, backgroundColor: withAlpha(accent, 0.18) },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.emoji}>{group.emoji}</Text>
            <Text style={styles.count}>{group.count}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a reaction"
          onPress={() => setPicking(!picking)}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Text style={styles.count}>{picking ? '✕' : '＋'}</Text>
        </Pressable>
      </View>

      {picking ? (
        <View style={styles.picker}>
          <View style={styles.row}>
            {QUICK_EMOJI.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`React with ${emoji}`}
                onPress={() => react(emoji)}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <TextField
            placeholder="Or type any emoji and press return"
            value={custom}
            onChangeText={setCustom}
            onSubmitEditing={() => react(custom)}
            maxLength={16}
            returnKeyType="done"
          />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minWidth: 40,
      justifyContent: 'center',
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pressed: {
      opacity: 0.6,
    },
    emoji: {
      fontSize: fontSize.md,
    },
    count: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    picker: {
      gap: spacing.sm,
    },
  });
