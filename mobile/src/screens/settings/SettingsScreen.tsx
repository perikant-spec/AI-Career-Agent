import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Switch, Platform } from "react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { colors, fonts, radii } from "@/theme/tokens";
import { useAuth } from "@/auth/AuthContext";
import { apiFetch } from "@/api/client";
import { registerForDailyBriefing, unregisterFromDailyBriefing } from "@/push/pushRegistration";
import { getStoredPushToken, setStoredPushToken, clearStoredPushToken } from "@/push/pushTokenStorage";

export function SettingsScreen() {
  const { user, token, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefingEnabled, setBriefingEnabled] = useState(false);
  const [briefingBusy, setBriefingBusy] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  useEffect(() => {
    getStoredPushToken().then((stored) => setBriefingEnabled(stored !== null));
  }, []);

  async function toggleBriefing(next: boolean) {
    if (!token) return;
    setBriefingBusy(true);
    setBriefingError(null);

    if (next) {
      const result = await registerForDailyBriefing(token);
      if (result.registered && result.pushToken) {
        await setStoredPushToken(result.pushToken);
        setBriefingEnabled(true);
      } else {
        setBriefingError(
          result.reason === "permission_denied"
            ? "Notification permission was denied — enable it in your device Settings to turn this on."
            : "Couldn't turn this on right now."
        );
      }
    } else {
      const stored = await getStoredPushToken();
      if (stored) await unregisterFromDailyBriefing(token, stored);
      await clearStoredPushToken();
      setBriefingEnabled(false);
    }

    setBriefingBusy(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await apiFetch("/api/account", { method: "DELETE", body: { password }, token });
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setDeleting(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>

      <Card style={{ marginTop: 16 }}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.name ?? "—"}</Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.sectionTitle}>About this app</Text>
        <Text style={styles.body}>
          This mobile app shares the same account and data as the web app — sign in with the same
          email and password. Resume uploads, profile edits, and full application-package review
          are best done on the web for now; this app is built for staying on top of your search on
          the go. To export your data, use Settings on the web app.
        </Text>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.sectionTitle}>Daily briefing notifications</Text>
          <Switch
            value={briefingEnabled}
            onValueChange={toggleBriefing}
            disabled={briefingBusy || Platform.OS === "web"}
          />
        </View>
        <Text style={styles.body}>
          A morning push notification summarizing new matches, follow-ups due, and your next
          interview — never sent more than once a day, and never with a fabricated interview time.
          {Platform.OS === "web" ? " Not available on the web preview — enable on a phone." : ""}
        </Text>
        {briefingError ? <Text style={styles.errorText}>{briefingError}</Text> : null}
      </Card>

      <Button variant="destructive" label="Sign out" onPress={signOut} style={{ marginTop: 16 }} />

      <Card style={{ marginTop: 12 }}>
        {!confirming ? (
          <>
            <Text style={styles.sectionTitle}>Delete account</Text>
            <Text style={styles.body}>
              Permanently deletes everything — resumes, jobs, applications, messages. Cannot be undone.
            </Text>
            <Button
              variant="destructive"
              label="Delete account"
              onPress={() => setConfirming(true)}
              style={{ marginTop: 10 }}
            />
          </>
        ) : (
          <>
            <Text style={styles.warningText}>
              This permanently deletes your account and everything in it. Enter your password to confirm.
            </Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor={colors.ink.quaternary}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Button
                variant="destructive"
                label={deleting ? "Deleting…" : "Permanently delete"}
                onPress={handleDelete}
                loading={deleting}
                disabled={!password}
              />
              <Button
                variant="ghost"
                label="Cancel"
                disabled={deleting}
                onPress={() => {
                  setConfirming(false);
                  setPassword("");
                  setError(null);
                }}
              />
            </View>
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.serif, fontSize: 28, color: colors.ink.primary },
  sectionTitle: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink.primary, marginBottom: 8 },
  label: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.ink.tertiary, marginTop: 8, textTransform: "uppercase" },
  value: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink.primary, marginTop: 2 },
  body: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink.secondary, lineHeight: 19 },
  warningText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.accent.riskText, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
    borderRadius: radii.btn,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink.primary,
  },
  errorText: { fontFamily: fonts.sans, fontSize: 12, color: colors.accent.riskText, marginTop: 6 },
});
