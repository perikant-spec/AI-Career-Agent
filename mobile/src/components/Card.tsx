import { View, type ViewProps, StyleSheet } from "react-native";
import { colors, radii } from "@/theme/tokens";

export function Card({ style, tone = "default", ...rest }: ViewProps & { tone?: "default" | "dark" }) {
  return <View style={[styles.base, tone === "dark" ? styles.dark : styles.light, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 16,
  },
  light: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  dark: {
    backgroundColor: colors.sidebar.default,
    borderColor: colors.sidebar.border,
  },
});
