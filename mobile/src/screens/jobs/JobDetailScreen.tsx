import { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { ScoreRing } from "@/components/ScoreRing";
import { colors, fonts } from "@/theme/tokens";
import { useApiQuery } from "@/api/useApiQuery";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import type { JobsStackParamList, MainTabParamList } from "@/navigation/types";

const CATEGORY_LABELS: Record<string, string> = {
  skills: "Skills",
  experience: "Experience",
  seniority: "Seniority",
  industry: "Industry",
  location: "Location",
  compensation: "Compensation",
  educationCertification: "Education / Certification",
  careerTrajectory: "Career Trajectory",
};

const TIER_LABELS: Record<string, string> = {
  APPLY_STRONG: "Apply — Strong Match",
  APPLY: "Apply",
  APPLY_IF_INTERESTED: "Apply if Interested",
  LOW_PRIORITY: "Low Priority",
  DONT_APPLY: "Don't Apply",
};

const TIER_TONE: Record<string, "success" | "warning" | "risk"> = {
  APPLY_STRONG: "success",
  APPLY: "success",
  APPLY_IF_INTERESTED: "warning",
  LOW_PRIORITY: "warning",
  DONT_APPLY: "risk",
};

interface JobDetailResponse {
  job: { id: string; title: string | null; company: string | null; locationText: string | null; rawText: string };
  matchScore: {
    overallScore: number;
    categoryScores: Record<string, number>;
    strengths: string[];
    gaps: string[];
    disqualifiers: { code: string; reason: string }[];
    recommendationTier: string;
    confidenceNote: string | null;
  } | null;
}

export function JobDetailScreen({ route }: NativeStackScreenProps<JobsStackParamList, "JobDetail">) {
  const { jobId } = route.params;
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();
  const { token } = useAuth();
  const { data, loading, error } = useApiQuery<JobDetailResponse>(`/api/jobs/${jobId}`);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  async function handlePrepare() {
    setPreparing(true);
    setPrepareError(null);
    try {
      const body = await apiFetch<{ applicationId: string }>(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        token,
      });
      navigation.navigate("ApplicationsTab", {
        screen: "ApplicationDetail",
        params: { applicationId: body.applicationId },
      });
    } catch (err) {
      setPrepareError(err instanceof Error ? err.message : "Couldn't prepare the application.");
    } finally {
      setPreparing(false);
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
        <Text style={styles.error}>{error ?? "Couldn't load this job."}</Text>
      </Screen>
    );
  }

  const { job, matchScore } = data;

  return (
    <Screen>
      <Card style={styles.header}>
        {matchScore ? <ScoreRing score={matchScore.overallScore} size={64} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{job.title ?? "Untitled role"}</Text>
          <Text style={styles.company}>{[job.company, job.locationText].filter(Boolean).join(" · ")}</Text>
          {matchScore ? (
            <Pill tone={TIER_TONE[matchScore.recommendationTier] ?? "default"}>
              {TIER_LABELS[matchScore.recommendationTier] ?? matchScore.recommendationTier}
            </Pill>
          ) : null}
        </View>
      </Card>

      {matchScore ? (
        <>
          {matchScore.confidenceNote ? <Text style={styles.confidenceNote}>{matchScore.confidenceNote}</Text> : null}

          <Card style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Category breakdown</Text>
            {Object.entries(matchScore.categoryScores).map(([key, value]) => (
              <View key={key} style={styles.categoryRow}>
                <Text style={styles.categoryLabel}>{CATEGORY_LABELS[key] ?? key}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
                </View>
                <Text style={styles.categoryValue}>{value}</Text>
              </View>
            ))}
          </Card>

          {matchScore.strengths.length > 0 ? (
            <Card style={{ marginTop: 12 }}>
              <Text style={styles.sectionTitle}>Strengths</Text>
              {matchScore.strengths.map((s, i) => (
                <Text key={i} style={styles.listItemPositive}>
                  + {s}
                </Text>
              ))}
            </Card>
          ) : null}

          {matchScore.gaps.length > 0 ? (
            <Card style={{ marginTop: 12 }}>
              <Text style={styles.sectionTitle}>Gaps</Text>
              {matchScore.gaps.map((g, i) => (
                <Text key={i} style={styles.listItemNegative}>
                  − {g}
                </Text>
              ))}
            </Card>
          ) : null}

          {matchScore.disqualifiers.length > 0 ? (
            <Card style={{ marginTop: 12 }}>
              <Text style={styles.sectionTitle}>Disqualifiers</Text>
              {matchScore.disqualifiers.map((d, i) => (
                <Text key={i} style={styles.listItemNegative}>
                  {d.reason}
                </Text>
              ))}
            </Card>
          ) : null}
        </>
      ) : (
        <Text style={styles.scoring}>Scoring…</Text>
      )}

      <Card tone="dark" style={{ marginTop: 12 }}>
        <Text style={styles.nextStepTitle}>Next step</Text>
        <Text style={styles.nextStepBody}>
          Build the full application package from your verified career profile: tailored resume,
          cover letter, and drafted screening answers.
        </Text>
        {prepareError ? <Text style={styles.prepareError}>{prepareError}</Text> : null}
        <Button
          variant="accent"
          label={preparing ? "Preparing…" : "Prepare application"}
          onPress={handlePrepare}
          loading={preparing}
          style={{ marginTop: 12 }}
        />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.sectionTitle}>Original posting text</Text>
        <Text style={styles.rawText}>{job.rawText}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  title: { fontFamily: fonts.sansSemibold, fontSize: 19, color: colors.ink.primary },
  company: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink.secondary, marginTop: 2, marginBottom: 8 },
  confidenceNote: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink.tertiary, marginTop: 8 },
  sectionTitle: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink.primary, marginBottom: 10 },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  categoryLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink.secondary, width: 110 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent.teal },
  categoryValue: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink.primary, width: 28, textAlign: "right" },
  listItemPositive: { fontFamily: fonts.sans, fontSize: 13, color: colors.accent.successText, marginBottom: 6 },
  listItemNegative: { fontFamily: fonts.sans, fontSize: 13, color: colors.accent.riskText, marginBottom: 6 },
  scoring: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.tertiary, marginTop: 12 },
  nextStepTitle: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.sidebar.text, marginBottom: 4 },
  nextStepBody: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.sidebar.textDim, lineHeight: 18 },
  prepareError: { fontFamily: fonts.sans, fontSize: 12, color: colors.accent.risk, marginTop: 8 },
  rawText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink.secondary, lineHeight: 19 },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.accent.riskText, marginTop: 40, textAlign: "center" },
});
