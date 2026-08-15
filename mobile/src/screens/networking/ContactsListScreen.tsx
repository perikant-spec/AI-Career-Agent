import { FlatList, Pressable, Text, View, StyleSheet, RefreshControl } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { colors, fonts } from "@/theme/tokens";
import { useApiQuery } from "@/api/useApiQuery";
import type { NetworkingStackParamList } from "@/navigation/types";

interface ContactSummary {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  contactType: string;
  warmth: number | null;
  messagesDrafted: number;
  messagesSent: number;
}

const CONTACT_TYPE_LABELS: Record<string, string> = {
  HIRING_MANAGER: "Hiring Manager",
  RECRUITER: "Recruiter",
  TEAM_LEAD: "Team Lead",
  EXISTING_CONNECTION: "Existing Connection",
  REFERRAL: "Referral",
  OTHER: "Other",
};

export function ContactsListScreen({
  navigation,
}: NativeStackScreenProps<NetworkingStackParamList, "ContactsList">) {
  const { data, loading, error, refetch } = useApiQuery<{ contacts: ContactSummary[] }>("/api/contacts");
  const contacts = data?.contacts ?? [];

  return (
    <Screen scroll={false}>
      <Text style={styles.title}>Networking</Text>
      <Text style={styles.subtitle}>Contacts surfaced for the roles you&apos;re pursuing.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        style={{ marginTop: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No contacts yet.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("ContactDetail", { contactId: item.id })}>
            <Card style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.roleLine}>
                  {[item.role, item.company].filter(Boolean).join(" · ")}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                  <Pill>{CONTACT_TYPE_LABELS[item.contactType] ?? item.contactType}</Pill>
                  {item.messagesDrafted > 0 ? (
                    <Pill tone={item.messagesSent > 0 ? "success" : "warning"}>
                      {item.messagesSent > 0 ? "Message sent" : "Draft ready"}
                    </Pill>
                  ) : null}
                </View>
              </View>
              {item.warmth !== null ? <Text style={styles.warmth}>{item.warmth}</Text> : null}
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
  name: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink.primary },
  roleLine: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.secondary, marginTop: 2 },
  warmth: { fontFamily: fonts.mono, fontSize: 14, color: colors.ink.tertiary },
  empty: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink.tertiary, marginTop: 20 },
  error: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.accent.riskText, marginTop: 8 },
});
