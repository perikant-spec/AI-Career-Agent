import { useState } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { colors, fonts, radii } from "@/theme/tokens";
import { useApiQuery } from "@/api/useApiQuery";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import type { InterviewsStackParamList } from "@/navigation/types";

// Hermes (Expo SDK 57+) ships full ICU, so Intl.DateTimeFormat with a timeZone option works here
// the same as it does server-side -- this is a small local helper rather than importing the
// Next.js project's lib/time/, which is a separate app this mobile project has no dependency on
// or module-resolution path to.
function formatInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso)
  );
}

// The picker returns a Date whose local getters reflect whatever wall-clock the device's native
// UI displayed -- read those digits directly rather than converting through any timezone. This
// matches the web datetime-local input's semantics exactly: both send raw wall-clock digits, and
// the PATCH /interview-prep route is the one place that authoritatively interprets them, using
// the user's UserPreferences.timezone -- never the device's own zone, which could differ (e.g.
// scheduling while traveling).
function toScheduledAtLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface InterviewQuestion {
  id: string;
  category: string;
  question: string;
  star: { situation: string | null; task: string | null; action: string | null; result: string | null };
  rehearsed: boolean;
  mockAttempts: { id: string; feedback: string; scoreRelevance: number; scoreClarity: number; scoreStructure: number; scoreCompleteness: number }[];
}

interface InterviewPrepResponse {
  interviewPrep: {
    readiness: number;
    rehearsedCount: number;
    totalCount: number;
    scheduledAt: string | null;
    companyResearch: { summary: string; talkingPoints: string[] } | Record<string, unknown>;
    questions: InterviewQuestion[];
  } | null;
  eligible: boolean;
  upgradeRequired?: boolean;
}

function QuestionCard({
  question,
  token,
  onChanged,
}: {
  question: InterviewQuestion;
  token: string | null;
  onChanged: () => void;
}) {
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const latestAttempt = question.mockAttempts[0] ?? null;

  async function toggleRehearsed() {
    setToggling(true);
    try {
      await apiFetch(`/api/interview-questions/${question.id}`, {
        method: "PATCH",
        body: { rehearsed: !question.rehearsed },
        token,
      });
      onChanged();
    } finally {
      setToggling(false);
    }
  }

  async function submitAttempt() {
    if (!response.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/interview-questions/${question.id}/mock-attempt`, {
        method: "POST",
        body: { responseText: response },
        token,
      });
      setResponse("");
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card style={{ marginTop: 12 }}>
      <View style={styles.qHeader}>
        <Pill>{question.category}</Pill>
        <Pill tone={question.rehearsed ? "success" : "default"}>{question.rehearsed ? "Rehearsed" : "Not rehearsed"}</Pill>
      </View>
      <Text style={styles.question}>{question.question}</Text>

      {question.star.situation ? (
        <View style={styles.starBlock}>
          <Text style={styles.starLabel}>Situation</Text>
          <Text style={styles.starText}>{question.star.situation}</Text>
          <Text style={styles.starLabel}>Task</Text>
          <Text style={styles.starText}>{question.star.task}</Text>
          <Text style={styles.starLabel}>Action</Text>
          <Text style={styles.starText}>{question.star.action}</Text>
          <Text style={styles.starLabel}>Result</Text>
          <Text style={styles.starText}>{question.star.result}</Text>
        </View>
      ) : null}

      <Button
        variant="secondary"
        label={toggling ? "Updating…" : question.rehearsed ? "Mark not rehearsed" : "Mark rehearsed"}
        onPress={toggleRehearsed}
        loading={toggling}
        style={{ marginTop: 10 }}
      />

      {latestAttempt ? (
        <View style={styles.attemptBlock}>
          <Text style={styles.attemptScores}>
            Relevance {latestAttempt.scoreRelevance} · Clarity {latestAttempt.scoreClarity} · Structure{" "}
            {latestAttempt.scoreStructure} · Completeness {latestAttempt.scoreCompleteness}
          </Text>
          <Text style={styles.attemptFeedback}>{latestAttempt.feedback}</Text>
        </View>
      ) : null}

      <Text style={styles.practiceLabel}>Practice your answer</Text>
      <TextInput
        style={styles.textArea}
        value={response}
        onChangeText={setResponse}
        multiline
        numberOfLines={4}
        placeholder="Type a mock answer…"
        placeholderTextColor={colors.ink.quaternary}
      />
      <Button
        variant="accent"
        label={submitting ? "Scoring…" : "Get feedback"}
        onPress={submitAttempt}
        loading={submitting}
        disabled={!response.trim()}
        style={{ marginTop: 8 }}
      />
    </Card>
  );
}

export function InterviewDetailScreen({
  route,
}: NativeStackScreenProps<InterviewsStackParamList, "InterviewDetail">) {
  const { applicationId } = route.params;
  const { token } = useAuth();
  const { data, loading, error, refetch } = useApiQuery<InterviewPrepResponse>(
    `/api/applications/${applicationId}/interview-prep`
  );
  const { data: prefsData } = useApiQuery<{ preferences: { timezone: string } }>("/api/preferences");
  const [showPicker, setShowPicker] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const timezone = prefsData?.preferences.timezone ?? "UTC";

  async function saveSchedule(date: Date) {
    setSavingSchedule(true);
    try {
      await apiFetch(`/api/applications/${applicationId}/interview-prep`, {
        method: "PATCH",
        body: { scheduledAtLocal: toScheduledAtLocal(date) },
        token,
      });
      await refetch();
    } finally {
      setSavingSchedule(false);
    }
  }

  if (loading && !data) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent.teal} style={{ marginTop: 40 }} />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen>
        <Text style={styles.error}>{error}</Text>
      </Screen>
    );
  }
  if (data?.upgradeRequired) {
    return (
      <Screen>
        <Text style={styles.empty}>
          This application is at Interview stage, but interview prep is a Pro feature. Upgrade
          to Pro from Settings to generate company research, STAR answers, and mock scoring.
        </Text>
      </Screen>
    );
  }
  if (!data?.eligible || !data.interviewPrep) {
    return (
      <Screen>
        <Text style={styles.empty}>
          This application isn&apos;t at an interview stage yet, so there&apos;s no prep to show.
        </Text>
      </Screen>
    );
  }

  const { interviewPrep } = data;
  const research = interviewPrep.companyResearch as { summary?: string; talkingPoints?: string[] };

  return (
    <Screen>
      <Card>
        <Text style={styles.readiness}>{interviewPrep.readiness}% ready</Text>
        <Text style={styles.readinessNote}>
          {interviewPrep.rehearsedCount} of {interviewPrep.totalCount} questions rehearsed
        </Text>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.sectionTitle}>Interview time</Text>
        {interviewPrep.scheduledAt ? (
          <Text style={styles.bodyText}>
            {formatInZone(interviewPrep.scheduledAt, timezone)} ({timezone})
          </Text>
        ) : (
          <Text style={styles.readinessNote}>
            No time set yet — the daily briefing will say &quot;you have an upcoming interview&quot;
            without a time until you add one.
          </Text>
        )}
        {Platform.OS === "web" ? (
          <Text style={styles.readinessNote}>Set this from the web app for now.</Text>
        ) : (
          <>
            <Button
              variant="secondary"
              label={savingSchedule ? "Saving…" : interviewPrep.scheduledAt ? "Change time" : "Set time"}
              onPress={() => setShowPicker(true)}
              loading={savingSchedule}
              style={{ marginTop: 10 }}
            />
            {showPicker ? (
              <DateTimePicker
                value={interviewPrep.scheduledAt ? new Date(interviewPrep.scheduledAt) : new Date()}
                mode="datetime"
                display="default"
                onChange={(_event, selectedDate) => {
                  setShowPicker(Platform.OS === "ios");
                  if (selectedDate) saveSchedule(selectedDate);
                }}
              />
            ) : null}
          </>
        )}
      </Card>

      {research?.summary ? (
        <Card style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>Company research</Text>
          <Text style={styles.bodyText}>{research.summary}</Text>
          {(research.talkingPoints ?? []).map((point, i) => (
            <Text key={i} style={styles.talkingPoint}>
              • {point}
            </Text>
          ))}
        </Card>
      ) : null}

      {interviewPrep.questions.map((q) => (
        <QuestionCard key={q.id} question={q} token={token} onChanged={refetch} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  readiness: { fontFamily: fonts.mono, fontSize: 24, color: colors.ink.primary },
  readinessNote: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink.secondary, marginTop: 4 },
  sectionTitle: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink.primary, marginBottom: 6 },
  bodyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.secondary, lineHeight: 19 },
  talkingPoint: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink.secondary, marginTop: 4 },
  qHeader: { flexDirection: "row", gap: 6 },
  question: { fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink.primary, marginTop: 8 },
  starBlock: { marginTop: 10 },
  starLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.ink.tertiary, marginTop: 6, textTransform: "uppercase" },
  starText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink.secondary, marginTop: 2 },
  attemptBlock: { marginTop: 10, padding: 10, borderRadius: radii.btn, backgroundColor: colors.bg },
  attemptScores: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.ink.tertiary },
  attemptFeedback: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink.secondary, marginTop: 4 },
  practiceLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink.secondary, marginTop: 12 },
  textArea: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radii.btn,
    padding: 10,
    marginTop: 6,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink.primary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  empty: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.tertiary, marginTop: 20, textAlign: "center" },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.accent.riskText, marginTop: 40, textAlign: "center" },
});
