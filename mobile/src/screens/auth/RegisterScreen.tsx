import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Switch, Linking } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { useAuth } from "@/auth/AuthContext";
import { colors, fonts, radii } from "@/theme/tokens";
import type { AuthStackParamList } from "@/navigation/types";
import { API_URL } from "@/api/client";

export function RegisterScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, "Register">) {
  const { register, error } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    await register(email.trim(), password, acceptedLegal, name.trim() || undefined);
    setLoading(false);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>Career Agent</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Everything downstream traces back to the resume you upload next.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Name (optional)</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} autoComplete="name" />
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
          autoComplete="password-new"
        />
        <Text style={styles.hint}>At least 8 characters.</Text>

        <View style={styles.consentRow}>
          <Switch value={acceptedLegal} onValueChange={setAcceptedLegal} />
          <Text style={styles.consentText}>
            I agree to the{" "}
            <Text style={styles.link} onPress={() => Linking.openURL(`${API_URL}/terms`)}>
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text style={styles.link} onPress={() => Linking.openURL(`${API_URL}/privacy`)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          variant="primary"
          label={loading ? "Creating account…" : "Create account"}
          onPress={handleSubmit}
          loading={loading}
          disabled={!acceptedLegal}
          style={{ marginTop: 8 }}
        />
        <Button variant="ghost" label="Already have an account? Sign in" onPress={() => navigation.navigate("Login")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 24, marginBottom: 28 },
  brand: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink.tertiary },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.ink.primary, marginTop: 8 },
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
  hint: { fontFamily: fonts.sans, fontSize: 11, color: colors.ink.quaternary, marginTop: 4 },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14 },
  consentText: { flex: 1, fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink.secondary, lineHeight: 17 },
  link: { textDecorationLine: "underline" },
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
