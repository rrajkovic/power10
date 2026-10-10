import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { teamAccents } from '@/lib/color';
import { useTheme } from '@/lib/theme';

const HEIGHT = 460;

// Two soft blobs of the team's colors behind the top of the screen, fading
// into the background. Stronger in dark mode, pastel in light mode.
export function TeamGlow({ primary, secondary }: { primary: string; secondary: string | null }) {
  const { colors, scheme } = useTheme();
  const accents = teamAccents(primary, secondary);
  const strength = scheme === 'dark' ? 0.55 : 0.28;
  // Gradient ids must be unique on the page: Home and the Team tab can both
  // be mounted, and on the web a duplicate id points at the hidden tab's
  // gradient and draws nothing.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  return (
    <View pointerEvents="none" style={styles.container}>
      <Svg width="100%" height={HEIGHT}>
        <Defs>
          <RadialGradient id={`primaryGlow${id}`} cx="15%" cy="0%" rx="75%" ry="65%">
            <Stop offset="0" stopColor={accents.primary} stopOpacity={strength} />
            <Stop offset="1" stopColor={accents.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`secondaryGlow${id}`} cx="95%" cy="15%" rx="65%" ry="55%">
            <Stop offset="0" stopColor={accents.secondary} stopOpacity={strength * 0.8} />
            <Stop offset="1" stopColor={accents.secondary} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`fade${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.55" stopColor={colors.background} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={HEIGHT} fill={`url(#primaryGlow${id})`} />
        <Rect x="0" y="0" width="100%" height={HEIGHT} fill={`url(#secondaryGlow${id})`} />
        <Rect x="0" y="0" width="100%" height={HEIGHT} fill={`url(#fade${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEIGHT,
  },
});
