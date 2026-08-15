import { FlatList, Pressable, Text, View, StyleSheet, RefreshControl } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { ScoreRing } from "@/components/ScoreRing";
import { Pill } from "@/components/Pill";
import { colors, fonts } from "@/theme/tokens";
import { useApiQuery } from "@/api/useApiQuery";
import type { JobsStackParamList } from "@/navigation/types";

interface JobSummary {
  id: string;
  title: string | null;
  company: string | null;
  score: { overallScore: number; recommendationTier: string } | null;
}

const TIER_TONE: Record<string, "success" | "warning" | "risk"> = {
  APPLY_STRONG: "success",
  APPLY: "success",
  APPLY_IF_INTERESTED: "warning",
  LOW_PRIORITY: "warning",
  DONT_APPLY: "risk",
};

const TIER_SHORT: Record<string, string> = {
  APPLY_STRONG: "Strong match",
  APPLY: "Apply",
  APPLY_IF_INTERESTED: "If interested",
  LOW_PRIORITY: "Low priority",
  DONT_APPLY: "Don't apply",
};

export function JobsListScreen({ navigation }: NativeStackScreenProps<JobsStackParamList, "JobsList">) {
  const { data, loading, error, refetch } = useApiQuery<{ jobs: JobSummary[] }>("/api/jobs");
  const jobs = [...(data?.jobs ?? [])].sort((a, b) => (b.score?.overallScore ?? -1) - (a.score?.overallScore ?? -1));

  return (
    <Screen scroll={false}>
      <Text style={styles.title}>Recommended jobs</Text>
      <Text style={styles.subtitle}>Scored against your profile, sorted by fit.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        style={{ marginTop: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No jobs yet — import one from the web app.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("JobDetail", { jobId: item.id })}>
            <Card style={styles.row}>
              {item.score ? <ScoreRing score={item.score.overallScore} /> : <View style={styles.ringPlaceholder} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.jobTitle}>{item.title ?? "Untitled role"}</Text>
                <Text style={styles.company}>{item.company ?? "Unknown company"}</Text>
                {item.score ? (
                  <View style={{ marginTop: 6 }}>
                    <Pill tone={TIER_TONE[item.score.recommendationTier] ?? "default"}>
                      {TIER_SHORT[item.score.recommendationTier] ?? item.score.recommendationTier}
                    </Pill>
                  </View>
                ) : null}
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.serif, fontSize: 28, color: colors.ink.primary },
  subtitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.secondary, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10 },
  ringPlaceholder: { width: 48, height: 48 },
  jobTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink.primary },
  company: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.secondary, marginTop: 2 },
  empty: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.tertiary, marginTop: 20 },
  error: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.accent.riskText, marginTop: 8 },
});
