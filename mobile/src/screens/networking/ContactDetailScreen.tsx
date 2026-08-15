import { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { colors, fonts } from "@/theme/tokens";
import { useApiQuery } from "@/api/useApiQuery";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import type { NetworkingStackParamList } from "@/navigation/types";

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  CONNECTION_REQUEST: "Connection Request",
  AFTER_CONNECT: "After Connect",
  RECRUITER_MESSAGE: "Recruiter",
  HIRING_MANAGER_MESSAGE: "Hiring Manager",
  REFERRAL_ASK: "Referral Ask",
  FOLLOW_UP: "Follow-Up",
};

const MESSAGE_TYPES = Object.keys(MESSAGE_TYPE_LABELS);

interface ContactDetail {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  contactType: string;
  relationshipNote: string | null;
  warmth: number | null;
  messages: Record<string, { id: string; content: string; status: string } | null>;
}

export function ContactDetailScreen({ route }: NativeStackScreenProps<NetworkingStackParamList, "ContactDetail">) {
  const { contactId } = route.params;
  const { token } = useAuth();
  const { data, loading, error, refetch } = useApiQuery<{ contact: ContactDetail }>(`/api/contacts/${contactId}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function generate(messageType: string) {
    setBusy(messageType);
    setGenerateError(null);
    try {
      await apiFetch(`/api/contacts/${contactId}/messages`, { method: "POST", body: { messageType }, token });
      await refetch();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Couldn't generate a draft.");
    } finally {
      setBusy(null);
    }
  }

  async function markSent(messageType: string) {
    setBusy(messageType);
    try {
      await apiFetch(`/api/contacts/${contactId}/messages`, {
        method: "PATCH",
        body: { messageType, status: "SENT" },
        token,
      });
      await refetch();
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent.teal} style={{ marginTop: 40 }} />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <Text style={styles.error}>{error ?? "Couldn't load this contact."}</Text>
      </Screen>
    );
  }

  const { contact } = data;

  return (
    <Screen>
      <Card>
        <Text style={styles.name}>{contact.name}</Text>
        <Text style={styles.roleLine}>{[contact.role, contact.company].filter(Boolean).join(" · ")}</Text>
        {contact.relationshipNote ? <Text style={styles.note}>{contact.relationshipNote}</Text> : null}
      </Card>

      {MESSAGE_TYPES.map((type) => {
        const message = contact.messages[type];
        return (
          <Card key={type} style={{ marginTop: 12 }}>
            <View style={styles.msgHeader}>
              <Text style={styles.sectionTitle}>{MESSAGE_TYPE_LABELS[type]}</Text>
              {message ? <Pill tone={message.status === "SENT" ? "success" : "warning"}>{message.status === "SENT" ? "Sent" : "Draft"}</Pill> : null}
            </View>
            {message ? (
              <>
                <Text style={styles.bodyText}>{message.content}</Text>
                {message.status !== "SENT" ? (
                  <Button
                    variant="secondary"
                    label={busy === type ? "Marking…" : "Mark as sent"}
                    onPress={() => markSent(type)}
                    loading={busy === type}
                    style={{ marginTop: 10 }}
                  />
                ) : null}
              </>
            ) : (
              <>
                <Button
                  variant="accent"
                  label={busy === type ? "Drafting…" : "Draft message"}
                  onPress={() => generate(type)}
                  loading={busy === type}
                  style={{ marginTop: 4 }}
                />
                {generateError ? <Text style={styles.errorText}>{generateError}</Text> : null}
              </>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.sansSemibold, fontSize: 19, color: colors.ink.primary },
  roleLine: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink.secondary, marginTop: 2 },
  note: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink.tertiary, marginTop: 6 },
  sectionTitle: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink.primary },
  msgHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bodyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.secondary, lineHeight: 19, marginTop: 8 },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.accent.riskText, marginTop: 40, textAlign: "center" },
  errorText: { fontFamily: fonts.sans, fontSize: 12, color: colors.accent.riskText, marginTop: 8 },
});
