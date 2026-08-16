import { View, Text, StyleSheet } from "react-native";
import { Card } from "./Card";
import { ScoreRing, tierColor } from "./ScoreRing";
import { colors, fonts, radii } from "@/theme/tokens";
import { useApiQuery } from "@/api/useApiQuery";

// Same duplicated-type convention the web client uses (components/health/CareerHealthSection.tsx)
// — kept separate from the server module (lib/health/computeCareerHealth.ts) rather than shared.
interface CareerHealthCategorySummary {
  key: string;
  label: string;
  score: number;
  sampleSize: number;
}

interface OpportunityInsight {
  kind: "opportunity" | "positive" | "onboarding";
  headline: string;
  detail: string;
}

interface CareerHealthSummary {
  overallScore: number | null;
  categoriesUsed: number;
  categories: CareerHealthCategorySummary[];
  opportunity: OpportunityInsight;
}

function SubScoreRow({ label, score, sampleSize }: { label: string; score: number; sampleSize: number }) {
  const hasData = sampleSize > 0;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.track}>
        {hasData ? (
          <View style={[styles.fill, { width: `${Math.max(4, score)}%`, backgroundColor: tierColor(score) }]} />
        ) : null}
      </View>
      <Text style={styles.rowValue}>{hasData ? score : "—"}</Text>
    </View>
  );
}

/** Renders inline on HomeScreen — mobile's Home has no stack navigator to push a separate detail
 *  screen from (unlike Jobs/Applications/Networking/Interviews), so the full breakdown lives here
 *  rather than behind new navigation. */
export function CareerHealthCard() {
  const { data } = useApiQuery<{ summary: CareerHealthSummary }>("/api/career-health");
  const summary = data?.summary;

  if (!summary || summary.categoriesUsed === 0) return null;

  return (
    <Card style={{ marginTop: 16 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Job Search Health</Text>
        {summary.categoriesUsed < summary.categories.length ? (
          <Text style={styles.headerNote}>
            {summary.categoriesUsed} OF {summary.categories.length} AREAS
          </Text>
        ) : null}
      </View>

      <View style={styles.body}>
        <ScoreRing score={summary.overallScore ?? 0} size={72} />
        <View style={styles.rows}>
          {summary.categories.map((c) => (
            <SubScoreRow key={c.key} label={c.label} score={c.score} sampleSize={c.sampleSize} />
          ))}
        </View>
      </View>

      <View
        style={[
          styles.opportunity,
          summary.opportunity.kind === "positive"
            ? { backgroundColor: colors.accent.successBg, borderColor: colors.accent.successBorder }
            : summary.opportunity.kind === "opportunity"
              ? { backgroundColor: colors.accent.warningBg, borderColor: colors.borderStrong }
              : { backgroundColor: colors.bg, borderColor: colors.border },
        ]}
      >
        <Text style={styles.opportunityHeadline}>{summary.opportunity.headline}</Text>
        <Text style={styles.opportunityDetail}>{summary.opportunity.detail}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink.primary },
  headerNote: { fontFamily: fonts.mono, fontSize: 10, color: colors.ink.quaternary },
  body: { flexDirection: "row", gap: 16, alignItems: "flex-start", marginTop: 14 },
  rows: { flex: 1, gap: 9 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink.primary, width: 96 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  rowValue: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.ink.primary, width: 24, textAlign: "right" },
  opportunity: { marginTop: 16, borderRadius: radii.btn, borderWidth: 1, padding: 12 },
  opportunityHeadline: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink.primary },
  opportunityDetail: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink.secondary, marginTop: 4, lineHeight: 17 },
});
