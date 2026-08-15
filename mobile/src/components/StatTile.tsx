import { Text, StyleSheet } from "react-native";
import { Card } from "./Card";
import { colors, fonts } from "@/theme/tokens";

export function StatTile({
  value,
  label,
  note,
  noteTone = "default",
}: {
  value: string | number;
  label: string;
  note?: string;
  noteTone?: "default" | "risk" | "warning";
}) {
  return (
    <Card style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {note ? (
        <Text
          style={[
            styles.note,
            noteTone === "risk" && { color: colors.accent.riskText },
            noteTone === "warning" && { color: colors.ink.secondary },
          ]}
        >
          {note}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: "45%", paddingVertical: 12 },
  value: { fontFamily: fonts.mono, fontSize: 22, color: colors.ink.primary },
  label: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink.secondary, marginTop: 4 },
  note: { fontFamily: fonts.sans, fontSize: 11, color: colors.ink.quaternary, marginTop: 4 },
});
