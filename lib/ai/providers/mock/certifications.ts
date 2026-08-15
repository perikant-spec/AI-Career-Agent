export const CERTIFICATION_KEYWORDS: string[] = [
  "PMP", "Project Management Professional", "PMI-ACP", "CAPM", "AWS Certified Solutions Architect",
  "AWS Certified Developer", "AWS Certified SysOps Administrator", "Azure Administrator",
  "Azure Solutions Architect", "Google Cloud Professional", "CPA", "CFA", "Six Sigma",
  "Lean Six Sigma", "Scrum Master", "Certified Scrum Master", "CSM", "SAFe", "ITIL",
  "CISSP", "CISM", "CompTIA Security+", "CompTIA Network+", "CCNA", "CCNP",
  "Certified Kubernetes Administrator", "CKA", "Salesforce Certified Administrator",
  "HubSpot Certified", "Google Analytics Certified", "Professional Engineer", "PE License",
  "Series 7", "Series 63", "SHRM-CP", "PHR", "SPHR",
];

export function matchCertificationsInText(text: string): string[] {
  const found = new Set<string>();
  const sorted = [...CERTIFICATION_KEYWORDS].sort((a, b) => b.length - a.length);
  let masked = text;

  for (const cert of sorted) {
    const pattern = new RegExp(`(?<![a-zA-Z0-9])${escapeRegExp(cert)}(?![a-zA-Z0-9])`, "i");
    if (pattern.test(masked)) {
      found.add(cert);
      // Mask so a shorter overlapping phrase ("Scrum Master") can't also match inside an
      // already-matched longer one ("Certified Scrum Master").
      masked = masked.replace(new RegExp(escapeRegExp(cert), "gi"), (m) => " ".repeat(m.length));
    }
  }

  return CERTIFICATION_KEYWORDS.filter((c) => found.has(c));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
