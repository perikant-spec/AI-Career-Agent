import { View, Text, StyleSheet } from "react-native";
import { colors, radii, fonts } from "@/theme/tokens";

type Tone = "default" | "success" | "warning" | "risk";

const TONE_STYLES: Record<Tone, { bg: string; text: string }> = {
  default: { bg: "rgba(0,0,0,0.05)", text: colors.ink.tertiary },
  success: { bg: colors.accent.successBg, text: colors.accent.successText },
  warning: { bg: colors.accent.warningBg, text: colors.ink.primary },
  risk: { bg: colors.accent.riskBg, text: colors.accent.riskText },
};

export function Pill({ children, tone = "default" }: { children: string; tone?: Tone }) {
  const t = TONE_STYLES[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  text: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
