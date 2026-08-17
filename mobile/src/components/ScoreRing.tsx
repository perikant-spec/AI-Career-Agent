import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "@/theme/tokens";

// React Native has no conic-gradient primitive (unlike the web ScoreRing), so this renders as a
// flat tone-coded badge circle instead of a progress ring — same information, a native-idiomatic
// shape rather than porting a web-only CSS trick.
export function tierColor(score: number): string {
  if (score >= 85) return colors.accent.success;
  if (score >= 70) return colors.accent.teal;
  if (score >= 55) return colors.accent.warning;
  if (score >= 40) return "#D98A4A";
  return colors.accent.risk;
}

export function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, borderColor: tierColor(score) },
      ]}
    >
      <Text style={[styles.text, { fontSize: Math.max(11, size * 0.3) }]}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  text: {
    fontFamily: fonts.mono,
    color: colors.ink.primary,
  },
});
