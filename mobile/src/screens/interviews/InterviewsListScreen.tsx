import { FlatList, Pressable, Text, View, StyleSheet, RefreshControl } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { colors, fonts } from "@/theme/tokens";
import { useApiQuery } from "@/api/useApiQuery";
import type { InterviewsStackParamList } from "@/navigation/types";

interface ApplicationSummary {
  id: string;
  status: string;
  title: string | null;
  company: string | null;
}

const INTERVIEW_STATUSES = new Set(["INTERVIEW", "FINAL_INTERVIEW"]);

export function InterviewsListScreen({
  navigation,
}: NativeStackScreenProps<InterviewsStackParamList, "InterviewsList">) {
  const { data, loading, error, refetch } = useApiQuery<{ applications: ApplicationSummary[] }>("/api/applications");
  const interviews = (data?.applications ?? []).filter((a) => INTERVIEW_STATUSES.has(a.status));

  return (
    <Screen scroll={false}>
      <Text style={styles.title}>Interview prep</Text>
      <Text style={styles.subtitle}>Applications currently in an interview stage.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={interviews}
        keyExtractor={(item) => item.id}
        style={{ marginTop: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              No applications in an interview stage yet — prep appears here once one moves to Interview.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("InterviewDetail", { applicationId: item.id })}>
            <Card style={{ marginBottom: 10 }}>
              <View>
                <Text style={styles.jobTitle}>{item.title ?? "Untitled role"}</Text>
                <Text style={styles.company}>{item.company ?? "Unknown company"}</Text>
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
  jobTitle: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink.primary },
  company: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.secondary, marginTop: 2 },
  empty: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.tertiary, marginTop: 20 },
  error: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.accent.riskText, marginTop: 8 },
});
