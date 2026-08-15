import type {
  ExtractedProfileEntry,
  ProfileConflict,
  ResumeExtractionResult,
  SourceSpan,
} from "@/lib/ai/types";
import { detectSections } from "./sections";
import { matchSkillsInText } from "./skillsTaxonomy";
import { matchCertificationsInText } from "./certifications";
import { findExactSpan } from "@/lib/text/spanMatch";

const DATE_RANGE_RE =
  /((?:[A-Za-z]{3,9}\.?\s+)?\d{4}|\d{1,2}\/\d{4})\s*(?:-|–|—|to)\s*((?:[A-Za-z]{3,9}\.?\s+)?\d{4}|\d{1,2}\/\d{4}|present|current)/i;

const DEGREE_RE = /\b(Bachelor|Master|B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?B\.?A\.?|Ph\.?D\.?|Associate)\b/i;
const INSTITUTION_RE = /\b(University|College|Institute|Polytechnic)\b/i;
const ACHIEVEMENT_RE =
  /(\d+%|\$\d[\d,]*|\b\d+x\b|increased|reduced|grew|saved|generated|improved|launched|shipped)/i;
const LEADERSHIP_RE = /\b(managed|led)\b[^.]{0,60}\b(\d+)\b[^.]{0,30}(direct report|engineer|people|team member)/i;

/**
 * Finds `needle` verbatim (case/whitespace-insensitive) inside `rawText`. Same matcher the
 * Evidence Validator re-checks with downstream — using anything weaker here would mean a
 * legitimately-present value gets stuck at a lower confidence than it deserves, since the
 * validator is only ever allowed to downgrade, never upgrade, this first-pass guess.
 */
function spanOf(needle: string, rawText: string): SourceSpan | null {
  return findExactSpan(needle, rawText);
}

function parseDateBounds(startRaw: string, endRaw: string): { start: number; end: number } {
  const yearOf = (s: string) => {
    if (/present|current/i.test(s)) return 9999;
    const m = s.match(/\d{4}/);
    return m ? parseInt(m[0], 10) : 0;
  };
  return { start: yearOf(startRaw), end: yearOf(endRaw) };
}

interface ParsedExperience {
  title?: string;
  company?: string;
  startRaw: string;
  endRaw: string;
  bullets: string[];
  headerSpan: SourceSpan;
  bulletSpans: SourceSpan[];
}

function parseExperienceSection(content: string, rawText: string): ParsedExperience[] {
  const lines = content.split(/\r?\n/);
  const dateLineIdx: number[] = [];
  lines.forEach((line, i) => {
    if (DATE_RANGE_RE.test(line)) dateLineIdx.push(i);
  });

  const looksLikeBullet = (l: string) => /^\s*[-•*]/.test(l);

  // First pass: figure out, per date line, whether its title/company header consumes the
  // immediately preceding line — needed so the *previous* entry's bullet range knows to stop
  // before that line instead of swallowing the next entry's header as a trailing bullet
  // (happens whenever there's no blank line separating two roles, e.g. PDF-extracted text).
  const ownsPrevLine = dateLineIdx.map((dateIdx) => {
    if (dateIdx === 0) return false;
    const prevLine = lines[dateIdx - 1].trim();
    return !looksLikeBullet(prevLine) && prevLine.length > 0 && !DATE_RANGE_RE.test(prevLine);
  });

  const entries: ParsedExperience[] = [];

  for (let i = 0; i < dateLineIdx.length; i++) {
    const dateIdx = dateLineIdx[i];
    const nextDateIdx = dateLineIdx[i + 1] ?? lines.length;

    // The title/company usually sits on the date line itself, or the line right before it.
    const dateLine = lines[dateIdx];
    const prevLine = dateIdx > 0 ? lines[dateIdx - 1].trim() : "";

    const headerText = ownsPrevLine[i] ? `${prevLine} ${dateLine}` : dateLine;

    const dateMatch = dateLine.match(DATE_RANGE_RE);
    const startRaw = dateMatch?.[1] ?? "";
    const endRaw = dateMatch?.[2] ?? "";

    const withoutDates = headerText.replace(DATE_RANGE_RE, "").trim();
    const parts = withoutDates
      .split(/[,|·—]/)
      .map((p) => p.replace(/^[-•*\s]+/, "").trim())
      .filter(Boolean);

    const title = parts[0];
    const company = parts[1];

    const bulletStart = dateIdx + 1;
    // Stop one line early if the next entry's header will claim that line for itself.
    const bulletEnd = ownsPrevLine[i + 1] ? nextDateIdx - 1 : nextDateIdx;
    const bullets = lines
      .slice(bulletStart, bulletEnd)
      .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
      .filter((l) => l.length > 0);

    const headerSpan = spanOf(dateLine, rawText) ?? { start: 0, end: 0, text: dateLine };

    // Indexed 1:1 with `bullets` (callers rely on this) — falls back to a zero-width span in
    // the unlikely case a bullet text can't be re-found verbatim.
    const bulletSpans: SourceSpan[] = bullets.map(
      (b) => spanOf(b, rawText) ?? { start: 0, end: 0, text: b }
    );

    entries.push({ title, company, startRaw, endRaw, bullets, headerSpan, bulletSpans });
  }

  return entries;
}

function detectOverlaps(entries: ParsedExperience[]): ProfileConflict[] {
  const conflicts: ProfileConflict[] = [];
  const bounds = entries.map((e) => parseDateBounds(e.startRaw, e.endRaw));

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = bounds[i];
      const b = bounds[j];
      const overlaps = a.start < b.end && b.start < a.end;
      if (overlaps) {
        conflicts.push({
          description: `Overlapping employment dates: "${entries[i].title ?? "role"}" (${entries[i].startRaw}–${entries[i].endRaw}) overlaps "${entries[j].title ?? "role"}" (${entries[j].startRaw}–${entries[j].endRaw}). This wasn't resolved automatically — confirm which is correct.`,
          relatedLabels: [entries[i].title ?? "Experience entry", entries[j].title ?? "Experience entry"],
        });
      }
    }
  }

  return conflicts;
}

export function extractResumeEntitiesHeuristic(rawText: string): ResumeExtractionResult {
  const entries: ExtractedProfileEntry[] = [];
  const warnings: string[] = [];
  const sections = detectSections(rawText);

  if (sections.length === 1 && sections[0].kind === "OTHER") {
    warnings.push(
      "No recognizable section headers (Experience, Education, Skills…) were found. Extraction quality will be lower than usual — consider adding clear section headings."
    );
  }

  // --- SUMMARY ---
  const summarySection = sections.find((s) => s.kind === "SUMMARY");
  if (summarySection && summarySection.content.length > 0) {
    const value = summarySection.content.split(/\r?\n/).slice(0, 3).join(" ").trim();
    const span = spanOf(value.split(/\r?\n/)[0] || value, rawText);
    entries.push({
      section: "SUMMARY",
      label: "Summary",
      value,
      confidence: span ? "VERIFIED" : "NOT_VERIFIED",
      sourceSpan: span ?? undefined,
    });
  } else {
    entries.push({
      section: "SUMMARY",
      label: "Summary",
      value: "",
      confidence: "MISSING",
    });
    warnings.push("No summary/objective section was found.");
  }

  // --- SKILLS ---
  const skillsSection = sections.find((s) => s.kind === "SKILLS");
  const skillSearchText = skillsSection ? skillsSection.content : rawText;
  const skills = matchSkillsInText(skillSearchText);
  if (skills.length === 0) {
    warnings.push("No skills from the taxonomy were matched — this resume may use uncommon terminology.");
  }
  for (const skill of skills) {
    const span = spanOf(skill, rawText) ?? undefined;
    entries.push({
      section: "SKILL",
      label: skill,
      value: skill,
      confidence: span ? "VERIFIED" : "NOT_VERIFIED",
      sourceSpan: span,
    });
  }

  // --- EXPERIENCE ---
  const experienceSection = sections.find((s) => s.kind === "EXPERIENCE");
  let experienceEntries: ParsedExperience[] = [];
  if (experienceSection) {
    experienceEntries = parseExperienceSection(experienceSection.content, rawText);

    if (experienceEntries.length === 0) {
      warnings.push(
        "An Experience section was found but no date ranges could be parsed from it — add entries manually."
      );
    }

    for (const exp of experienceEntries) {
      const label = [exp.title, exp.company].filter(Boolean).join(" · ") || "Experience entry";
      entries.push({
        section: "EXPERIENCE",
        label,
        value: label,
        structuredData: {
          title: exp.title,
          company: exp.company,
          startDate: exp.startRaw,
          endDate: exp.endRaw,
          bullets: exp.bullets,
        },
        confidence: exp.title && exp.company ? "VERIFIED" : "NOT_VERIFIED",
        sourceSpan: exp.headerSpan,
      });

      // Leadership inference — combines a bullet's evidence into a derived SKILL claim,
      // always as SUPPORTED_INFERENCE, never presented as a direct quote.
      for (let i = 0; i < exp.bullets.length; i++) {
        const bullet = exp.bullets[i];
        const leadershipMatch = bullet.match(LEADERSHIP_RE);
        if (leadershipMatch) {
          entries.push({
            section: "SKILL",
            label: "Team leadership",
            value: "Team leadership",
            confidence: "SUPPORTED_INFERENCE",
            basisText: `Implied by: "${bullet}"${exp.company ? ` at ${exp.company}` : ""}.`,
            sourceSpan: exp.bulletSpans[i],
          });
        }

        if (ACHIEVEMENT_RE.test(bullet)) {
          entries.push({
            section: "ACHIEVEMENT",
            label: label,
            value: bullet,
            confidence: "VERIFIED",
            sourceSpan: exp.bulletSpans[i],
          });
        }
      }
    }
  } else {
    warnings.push("No Experience section was found.");
  }

  // --- EDUCATION ---
  const educationSection = sections.find((s) => s.kind === "EDUCATION");
  if (educationSection) {
    const lines = educationSection.content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (DEGREE_RE.test(line) || INSTITUTION_RE.test(line)) {
        const span = spanOf(line, rawText);
        entries.push({
          section: "EDUCATION",
          label: line,
          value: line,
          confidence: DEGREE_RE.test(line) && INSTITUTION_RE.test(line) ? "VERIFIED" : "NOT_VERIFIED",
          sourceSpan: span ?? undefined,
        });
      }
    }
    if (!lines.some((l) => DEGREE_RE.test(l) || INSTITUTION_RE.test(l))) {
      warnings.push("An Education section was found but no degree/institution could be parsed from it.");
    }
  } else {
    entries.push({ section: "EDUCATION", label: "Education", value: "", confidence: "MISSING" });
  }

  // --- CERTIFICATIONS ---
  const certSection = sections.find((s) => s.kind === "CERTIFICATIONS");
  const certSearchText = certSection ? certSection.content : rawText;
  const certs = matchCertificationsInText(certSearchText);
  for (const cert of certs) {
    const span = spanOf(cert, rawText);
    entries.push({
      section: "CERTIFICATION",
      label: cert,
      value: cert,
      confidence: span ? "VERIFIED" : "NOT_VERIFIED",
      sourceSpan: span ?? undefined,
    });
  }

  const conflicts = detectOverlaps(experienceEntries);

  return { entries, warnings, conflicts };
}
