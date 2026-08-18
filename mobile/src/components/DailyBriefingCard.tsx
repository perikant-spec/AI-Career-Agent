import { View, Text, StyleSheet } from "react-native";
import { Card } from "./Card";
import { colors, fonts } from "@/theme/tokens";
import { useApiQuery } from "@/api/useApiQuery";

interface DailyBriefingResponse {
  headline: string;
  lines: string[];
}

/** Same self-fetching card convention as the web DailyBriefingCard: renders nothing while
 *  loading/empty rather than a placeholder skeleton. */
export function DailyBriefingCard() {
  const { data } = useApiQuery<DailyBriefingResponse>("/api/daily-briefing");

  if (!data || data.lines.length === 0) return null;

  return (
    <Card style={{ marginTop: 16 }}>
      <Text style={styles.title}>{data.headline}</Text>
      <View style={styles.lines}>
        {data.lines.map((line, i) => (
          <Text key={i} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink.primary },
  lines: { marginTop: 6, gap: 4 },
  line: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink.secondary, lineHeight: 18 },
});
