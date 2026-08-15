import { FlatList, Pressable, Text, View, StyleSheet, RefreshControl } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { colors, fonts } from "@/theme/tokens";
import { useApiQuery } from "@/api/useApiQuery";
import type { ApplicationsStackParamList } from "@/navigation/types";

interface ApplicationSummary {
  id: string;
  status: string;
  title: string | null;
  company: string | null;
  score: number | null;
  packageReady: boolean;
}

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

export function ApplicationsListScreen({
  navigation,
}: NativeStackScreenProps<ApplicationsStackParamList, "ApplicationsList">) {
  const { data, loading, error, refetch } = useApiQuery<{ applications: ApplicationSummary[] }>("/api/applications");
  const applications = data?.applications ?? [];

  return (
    <Screen scroll={false}>
      <Text style={styles.title}>Applications</Text>
      <Text style={styles.subtitle}>Every job you've moved into the pipeline.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        style={{ marginTop: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No applications yet — prepare one from a job's detail page.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("ApplicationDetail", { applicationId: item.id })}>
            <Card style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.jobTitle}>{item.title ?? "Untitled role"}</Text>
                <Text style={styles.company}>{item.company ?? "Unknown company"}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6, alignItems: "center" }}>
                  <Pill>{STATUS_LABELS[item.status] ?? item.status}</Pill>
                  {item.packageReady ? <Pill tone="warning">Needs review</Pill> : null}
                </View>
              </View>
              {item.score !== null ? <Text style={styles.score}>{item.score}</Text> : null}
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
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  jobTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink.primary },
  company: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.secondary, marginTop: 2 },
  score: { fontFamily: fonts.mono, fontSize: 16, color: colors.ink.primary },
  empty: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.tertiary, marginTop: 20 },
  error: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.accent.riskText, marginTop: 8 },
});
