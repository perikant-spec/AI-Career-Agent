import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { colors, radii, fonts } from "@/theme/tokens";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "destructive";

interface ButtonProps extends PressableProps {
  variant?: Variant;
  label: string;
  loading?: boolean;
}

export function Button({ variant = "secondary", label, loading, disabled, style, ...rest }: ButtonProps) {
  const variantStyle = VARIANT_STYLES[variant];
  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variantStyle.container,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading ? styles.pressed : null,
        typeof style === "function" ? undefined : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text.color as string} size="small" />
      ) : (
        <Text style={[styles.text, variantStyle.text]}>{label}</Text>
      )}
    </Pressable>
  );
}

const VARIANT_STYLES: Record<Variant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: colors.sidebar.default },
    text: { color: colors.sidebar.text },
  },
  accent: {
    container: { backgroundColor: colors.accent.teal },
    text: { color: colors.accent.tealInk, fontFamily: fonts.sansSemibold },
  },
  secondary: {
    container: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong },
    text: { color: colors.ink.secondary },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    text: { color: colors.ink.tertiary },
  },
  destructive: {
    container: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.accent.riskBorder },
    text: { color: colors.accent.riskText },
  },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.btn,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  text: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
  },
});
