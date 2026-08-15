import { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { colors, fonts } from "@/theme/tokens";
import { useApiQuery } from "@/api/useApiQuery";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import type { ApplicationsStackParamList } from "@/navigation/types";

const STATUS_FLOW = [
  "DISCOVERED",
  "SHORTLISTED",
  "PREPARING",
  "READY_TO_APPLY",
  "APPLIED",
  "RECRUITER_CONTACT",
  "SCREENING",
  "INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "ACCEPTED",
] as const;

const STATUS_LABELS: Record<string, string> = {
  DISCOVERED: "Discovered",
  SHORTLISTED: "Shortlisted",
  PREPARING: "Preparing",
  READY_TO_APPLY: "Ready to apply",
  APPLIED: "Applied",
  RECRUITER_CONTACT: "Recruiter contact",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  FINAL_INTERVIEW: "Final interview",
  OFFER: "Offer",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

interface ApplicationDetail {
  application: {
    id: string;
    status: string;
    job: { title: string | null; company: string | null };
    score: number | null;
    coverLetter: { content: string; citedEntityIds: string[] } | null;
    qaAnswers: { question: string; answer: string; citedEntityIds: string[] }[] | null;
    resumeApproved: boolean;
    coverLetterApproved: boolean;
    qaApproved: boolean;
    notes: string | null;
  };
  resumeVersion: { atsScoreBefore: number | null; atsScoreAfter: number | null; changeLog: string[] } | null;
}

export function ApplicationDetailScreen({
  route,
}: NativeStackScreenProps<ApplicationsStackParamList, "ApplicationDetail">) {
  const { applicationId } = route.params;
  const { token } = useAuth();
  const { data, loading, error, refetch } = useApiQuery<ApplicationDetail>(`/api/applications/${applicationId}`);
  const [busy, setBusy] = useState<string | null>(null);

  async function updateStatus(status: string) {
    setBusy("status");
    try {
      await apiFetch(`/api/applications/${applicationId}/status`, { method: "POST", body: { status }, token });
      await refetch();
    } finally {
      setBusy(null);
    }
  }

  async function toggleApproval(field: "resumeApproved" | "coverLetterApproved" | "qaApproved", value: boolean) {
    setBusy(field);
    try {
      await apiFetch(`/api/applications/${applicationId}`, { method: "PATCH", body: { [field]: value }, token });
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
        <Text style={styles.error}>{error ?? "Couldn't load this application."}</Text>
      </Screen>
    );
  }

  const { application, resumeVersion } = data;
  const currentIndex = STATUS_FLOW.indexOf(application.status as (typeof STATUS_FLOW)[number]);
  const nextStatus = currentIndex >= 0 && currentIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIndex + 1] : null;

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>{application.job.title ?? "Untitled role"}</Text>
        <Text style={styles.company}>{application.job.company ?? "Unknown company"}</Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8, alignItems: "center" }}>
          <Pill>{STATUS_LABELS[application.status] ?? application.status}</Pill>
          {application.score !== null ? <Text style={styles.score}>Match {application.score}</Text> : null}
        </View>
        {nextStatus ? (
          <Button
            variant="primary"
            label={busy === "status" ? "Updating…" : `Mark as ${STATUS_LABELS[nextStatus]}`}
            onPress={() => updateStatus(nextStatus)}
            loading={busy === "status"}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </Card>

      {resumeVersion ? (
        <Card style={{ marginTop: 12 }}>
          <View style={styles.approveRow}>
            <Text style={styles.sectionTitle}>Tailored resume</Text>
            <Button
              variant={application.resumeApproved ? "secondary" : "accent"}
              label={application.resumeApproved ? "Approved" : "Approve"}
              onPress={() => toggleApproval("resumeApproved", !application.resumeApproved)}
              loading={busy === "resumeApproved"}
            />
          </View>
          <Text style={styles.atsNote}>
            ATS score {resumeVersion.atsScoreBefore ?? "—"} → {resumeVersion.atsScoreAfter ?? "—"}
          </Text>
          {resumeVersion.changeLog.map((line, i) => (
            <Text key={i} style={styles.changeLogLine}>
              • {line}
            </Text>
          ))}
        </Card>
      ) : null}

      {application.coverLetter ? (
        <Card style={{ marginTop: 12 }}>
          <View style={styles.approveRow}>
            <Text style={styles.sectionTitle}>Cover letter</Text>
            <Button
              variant={application.coverLetterApproved ? "secondary" : "accent"}
              label={application.coverLetterApproved ? "Approved" : "Approve"}
              onPress={() => toggleApproval("coverLetterApproved", !application.coverLetterApproved)}
              loading={busy === "coverLetterApproved"}
            />
          </View>
          <ScrollView style={{ maxHeight: 220, marginTop: 8 }}>
            <Text style={styles.bodyText}>{application.coverLetter.content}</Text>
          </ScrollView>
        </Card>
      ) : null}

      {application.qaAnswers && application.qaAnswers.length > 0 ? (
        <Card style={{ marginTop: 12 }}>
          <View style={styles.approveRow}>
            <Text style={styles.sectionTitle}>Screening Q&A</Text>
            <Button
              variant={application.qaApproved ? "secondary" : "accent"}
              label={application.qaApproved ? "Approved" : "Approve"}
              onPress={() => toggleApproval("qaApproved", !application.qaApproved)}
              loading={busy === "qaApproved"}
            />
          </View>
          {application.qaAnswers.map((qa, i) => (
            <View key={i} style={{ marginTop: 10 }}>
              <Text style={styles.qaQuestion}>{qa.question}</Text>
              <Text style={styles.bodyText}>{qa.answer}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.sansSemibold, fontSize: 19, color: colors.ink.primary },
  company: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink.secondary, marginTop: 2 },
  score: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.ink.tertiary },
  sectionTitle: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink.primary },
  approveRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  atsNote: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink.tertiary, marginTop: 8 },
  changeLogLine: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink.secondary, marginTop: 4 },
  bodyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.secondary, lineHeight: 19 },
  qaQuestion: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink.primary, marginBottom: 4 },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.accent.riskText, marginTop: 40, textAlign: "center" },
});
