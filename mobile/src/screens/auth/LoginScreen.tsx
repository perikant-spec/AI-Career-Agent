import { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { useAuth } from "@/auth/AuthContext";
import { colors, fonts, radii } from "@/theme/tokens";
import type { AuthStackParamList } from "@/navigation/types";

export function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, "Login">) {
  const { login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    await login(email.trim(), password);
    setLoading(false);
  }

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Text style={styles.brand}>Career Agent</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to pick up your job search where you left off.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button variant="primary" label={loading ? "Signing in…" : "Sign in"} onPress={handleSubmit} loading={loading} style={{ marginTop: 8 }} />
        <Button variant="ghost" label="Don't have an account? Create one" onPress={() => navigation.navigate("Register")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 40, marginBottom: 32 },
  brand: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink.tertiary },
  title: { fontFamily: fonts.serif, fontSize: 32, color: colors.ink.primary, marginTop: 8 },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink.secondary, marginTop: 6 },
  form: { gap: 6 },
  label: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.secondary, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radii.btn,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fonts.sans,
    color: colors.ink.primary,
    marginTop: 4,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.accent.riskText,
    backgroundColor: colors.accent.riskBg,
    borderRadius: radii.btn,
    padding: 10,
    marginTop: 12,
  },
});
