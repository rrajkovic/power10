import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { TextField } from '@/components/TextField';
import { Muted } from '@/components/Typography';
import { fontSize, spacing, type Palette } from '@/constants/theme';
import { activityWrites, intensityWrites } from '@/lib/settings';
import type { MyTeam } from '@/lib/teams';
import { useThemedStyles } from '@/lib/theme';
import { Card, SavedField, SmallButton } from './parts';
import type { Save, Setup } from './types';

const checkName = (text: string) =>
  text.trim().length < 1 || text.trim().length > 40 ? 'Between 1 and 40 letters' : null;

// What athletes can pick in the logging form: activities and intensities.
export function ActivitiesSection({ team, setup, save }: { team: MyTeam; setup: Setup; save: Save }) {
  const styles = useThemedStyles(makeStyles);
  const nextOrder = (rows: { sort_order: number }[]) =>
    rows.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1;

  return (
    <>
      <Card
        title="Activities"
        hint="Archiving an activity takes it out of the logging form. Workouts already logged keep it."
      >
        {setup.types.map((type) => (
          <View key={type.id} style={styles.item}>
            <SavedField
              saved={type.name}
              onSave={(name) => save(activityWrites.rename(type.id, name))}
              check={checkName}
            />
            <View style={styles.options}>
              <Switch
                accessibilityLabel={`${type.name} needs a photo`}
                value={type.requires_photo}
                onValueChange={(value) => save(activityWrites.setRequiresPhoto(type.id, value))}
              />
              <Muted style={styles.grow}>Needs a photo</Muted>
              {type.is_custom ? (
                <Muted style={styles.small}>athletes describe it</Muted>
              ) : (
                <SmallButton title="Archive" quiet onPress={() => save(activityWrites.archive(type.id))} />
              )}
            </View>
          </View>
        ))}
        <AddRow
          placeholder="New activity (e.g. Swim)"
          onAdd={(name) => save(activityWrites.add(team.id, name, nextOrder(setup.types)))}
        />
      </Card>

      <Card
        title="Intensities"
        hint="Optional when logging. Credit rules can differ by intensity, for example hard work worth more."
      >
        {setup.intensities.map((intensity) => (
          <View key={intensity.id} style={styles.item}>
            <SavedField
              saved={intensity.name}
              onSave={(name) => save(intensityWrites.rename(intensity.id, name))}
              check={checkName}
            />
            <View style={styles.options}>
              <View style={styles.grow} />
              <SmallButton title="Archive" quiet onPress={() => save(intensityWrites.archive(intensity.id))} />
            </View>
          </View>
        ))}
        <AddRow
          placeholder="New intensity (e.g. Race pace)"
          onAdd={(name) => save(intensityWrites.add(team.id, name, nextOrder(setup.intensities)))}
        />
      </Card>
    </>
  );
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState('');
  const add = () => {
    if (checkName(name)) return;
    onAdd(name);
    setName('');
  };
  return (
    <View style={styles.addRow}>
      <View style={styles.grow}>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder={placeholder}
          maxLength={40}
          onSubmitEditing={add}
          returnKeyType="done"
        />
      </View>
      <SmallButton title="Add" disabled={!!checkName(name)} onPress={add} />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    item: {
      gap: spacing.xs,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    options: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 40,
    },
    grow: {
      flex: 1,
    },
    small: {
      fontSize: fontSize.sm,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
  });
