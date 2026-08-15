import { useState } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatTile } from "@/components/StatTile";
import { colors, fonts, radii } from "@/theme/tokens";
import { useApiQuery } from "@/api/useApiQuery";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";

interface AnalyticsSummary {
  totalApplications: number;
  avgMatchScore: number | null;
  closedOut: number;
}

interface JobSummary {
  id: string;
  score: { overallScore: number } | null;
}

export function HomeScreen() {
  const { user, token } = useAuth();
  const { data: analytics } = useApiQuery<{ summary: AnalyticsSummary }>("/api/analytics");
  const { data: jobsData } = useApiQuery<{ jobs: JobSummary[] }>("/api/jobs");

  const [message, setMessage] = useState("");
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  async function handleAsk() {
    if (!message.trim()) return;
    setAsking(true);
    setReply(null);
    try {
      const body = await apiFetch<{ reply: string }>("/api/assistant/chat", {
        method: "POST",
        body: { message: message.trim() },
        token,
      });
      setReply(body.reply);
    } catch (err) {
      setReply(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAsking(false);
    }
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const strongMatches = (jobsData?.jobs ?? []).filter((j) => (j.score?.overallScore ?? 0) >= 70).length;

  return (
    <Screen>
      <Text style={styles.greeting}>Hi {firstName}</Text>
      <Text style={styles.subtitle}>Here&apos;s where your job search stands today.</Text>

      <View style={styles.tileRow}>
        <StatTile value={jobsData?.jobs.length ?? "—"} label="Jobs tracked" />
        <StatTile value={strongMatches} label="Strong matches" />
      </View>
      <View style={styles.tileRow}>
        <StatTile value={analytics?.summary.totalApplications ?? "—"} label="Applications" />
        <StatTile value={analytics?.summary.avgMatchScore ?? "—"} label="Avg match score" />
      </View>

      <Card style={{ marginTop: 16 }}>
        <Text style={styles.sectionTitle}>Ask your assistant</Text>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="What should I apply to today?"
          placeholderTextColor={colors.ink.quaternary}
        />
        <Button
          variant="accent"
          label={asking ? "Asking…" : "Ask"}
          onPress={handleAsk}
          loading={asking}
          disabled={!message.trim()}
          style={{ marginTop: 10 }}
        />
        {asking ? <ActivityIndicator color={colors.accent.teal} style={{ marginTop: 12 }} /> : null}
        {reply ? <Text style={styles.reply}>{reply}</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { fontFamily: fonts.serif, fontSize: 30, color: colors.ink.primary },
  subtitle: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink.secondary, marginTop: 4, marginBottom: 16 },
  tileRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  sectionTitle: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink.primary, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
    borderRadius: radii.btn,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink.primary,
  },
  reply: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink.secondary,
    lineHeight: 19,
    marginTop: 12,
    padding: 10,
    borderRadius: radii.btn,
    backgroundColor: colors.bg,
  },
});
