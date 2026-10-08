import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextInput } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';

const CODE_LENGTH = 6;

type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  // Called once all 6 digits are in.
  onComplete: (code: string) => void;
  error?: boolean;
  // Increase this number to play the shake animation (e.g. after a wrong code).
  shakeKey?: number;
  disabled?: boolean;
};

// Six boxes on top of one invisible text input. The input does the real work
// (typing, deleting, pasting, iOS/Android code autofill); the boxes only show it.
export function CodeInput({
  value,
  onChange,
  onComplete,
  error = false,
  shakeKey = 0,
  disabled = false,
}: CodeInputProps) {
  // Animated values are created once and kept for the component's lifetime.
  const [shake] = useState(() => new Animated.Value(0));
  const [scales] = useState(() =>
    Array.from({ length: CODE_LENGTH }, () => new Animated.Value(1)),
  );
  const previousLength = useRef(value.length);

  // Pop the box that just received a digit.
  useEffect(() => {
    if (value.length > previousLength.current) {
      const box = scales[value.length - 1];
      box.setValue(0.8);
      Animated.spring(box, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }).start();
    }
    previousLength.current = value.length;
  }, [value, scales]);

  // Shake the whole row.
  useEffect(() => {
    if (shakeKey === 0) return;
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((toValue) =>
        Animated.timing(shake, { toValue, duration: 50, useNativeDriver: true }),
      ),
    ).start();
  }, [shakeKey, shake]);

  function handleChange(text: string) {
    // Keep digits only, so pasting "322 122" or "Code: 322122" still works.
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    onChange(digits);
    if (digits.length === CODE_LENGTH) onComplete(digits);
  }

  return (
    <Animated.View style={[styles.row, { transform: [{ translateX: shake }] }]}>
      {scales.map((scale, index) => {
        const isActive = !disabled && index === Math.min(value.length, CODE_LENGTH - 1);
        return (
          <Animated.View
            key={index}
            style={[
              styles.box,
              isActive ? styles.boxActive : null,
              error ? styles.boxError : null,
              { transform: [{ scale }] },
            ]}
          >
            <Text style={styles.digit}>{value[index] ?? ''}</Text>
          </Animated.View>
        );
      })}

      <TextInput
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        editable={!disabled}
        caretHidden
        accessibilityLabel="Confirmation code"
        style={styles.hiddenInput}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  boxError: {
    borderColor: colors.danger,
  },
  digit: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  // Covers the boxes so a tap anywhere focuses it, but is invisible.
  hiddenInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0,
    fontSize: fontSize.md,
  },
});
