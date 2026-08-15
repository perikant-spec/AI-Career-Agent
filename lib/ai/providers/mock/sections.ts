export interface DetectedSection {
  kind: "SUMMARY" | "EXPERIENCE" | "EDUCATION" | "SKILLS" | "CERTIFICATIONS" | "OTHER";
  headerLine: string;
  start: number; // char offset in rawText where the section content starts (after header)
  end: number; // char offset where the section ends
  content: string;
}

const HEADER_PATTERNS: Array<{ kind: DetectedSection["kind"]; regex: RegExp }> = [
  { kind: "SUMMARY", regex: /^(summary|professional summary|objective|profile)\s*:?\s*$/i },
  {
    kind: "EXPERIENCE",
    regex: /^(experience|work experience|employment|employment history|professional experience)\s*:?\s*$/i,
  },
  { kind: "EDUCATION", regex: /^(education|academic background)\s*:?\s*$/i },
  { kind: "SKILLS", regex: /^(skills|technical skills|core competencies)\s*:?\s*$/i },
  {
    kind: "CERTIFICATIONS",
    regex: /^(certifications?|licenses?( and | & )certifications?)\s*:?\s*$/i,
  },
];

/**
 * Splits resume text into sections by scanning for short standalone header-like lines
 * (e.g. "EXPERIENCE", "Skills:"). Everything between two headers belongs to the first.
 * Content before the first recognized header is treated as an implicit leading SUMMARY
 * candidate (many resumes open with an unlabeled summary paragraph).
 */
export function detectSections(rawText: string): DetectedSection[] {
  const lines = rawText.split(/\r?\n/);
  const sections: DetectedSection[] = [];

  let offset = 0;
  const lineOffsets: number[] = [];
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1; // +1 for the newline we split on
  }

  const headerLineIndexes: Array<{ index: number; kind: DetectedSection["kind"] }> = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length > 40) return;
    for (const { kind, regex } of HEADER_PATTERNS) {
      if (regex.test(trimmed)) {
        headerLineIndexes.push({ index: i, kind });
        break;
      }
    }
  });

  if (headerLineIndexes.length === 0) {
    // No recognizable headers at all — treat the whole document as SUMMARY-ish content so
    // downstream extraction still has something to work with, flagged low-confidence by callers.
    return [{ kind: "OTHER", headerLine: "", start: 0, end: rawText.length, content: rawText }];
  }

  // Leading content before the first header, if any, is an implicit summary block — but
  // only when there's no *explicit* Summary/Objective header elsewhere, otherwise this would
  // misfile the name/contact-info block above it as the summary and shadow the real one.
  const hasExplicitSummaryHeader = headerLineIndexes.some((h) => h.kind === "SUMMARY");
  if (!hasExplicitSummaryHeader && headerLineIndexes[0].index > 0) {
    const end = lineOffsets[headerLineIndexes[0].index];
    const content = rawText.slice(0, end).trim();
    if (content.length > 0) {
      sections.push({ kind: "SUMMARY", headerLine: "", start: 0, end, content });
    }
  }

  for (let i = 0; i < headerLineIndexes.length; i++) {
    const { index, kind } = headerLineIndexes[i];
    const contentStartLine = index + 1;
    const nextHeaderLine = headerLineIndexes[i + 1]?.index ?? lines.length;
    const start = lineOffsets[contentStartLine] ?? rawText.length;
    const end = lineOffsets[nextHeaderLine] ?? rawText.length;
    const content = rawText.slice(start, end).trim();

    sections.push({ kind, headerLine: lines[index], start, end, content });
  }

  return sections;
}
