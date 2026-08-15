import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..", "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".postgres-data", "backups", "data", "coverage"]);

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

// A real-looking secret has enough entropy/length that these patterns won't false-positive on
// placeholder strings like "sk_test_..." or "sk-ant-xxxxx" used in comments/docs.
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Anthropic API key", pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/ },
  { name: "Stripe live secret key", pattern: /sk_live_[a-zA-Z0-9]{20,}/ },
  { name: "Stripe live webhook secret", pattern: /whsec_[a-zA-Z0-9]{20,}/ },
  { name: "AWS access key ID", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "Generic 'password = literal' assignment", pattern: /password\s*[:=]\s*["'][^"'$]{8,}["']/i },
];

describe("secrets hygiene", () => {
  it("no source file contains a real-looking hardcoded secret", () => {
    const files = [
      ...walk(path.join(ROOT, "app"), [".ts", ".tsx"]),
      ...walk(path.join(ROOT, "lib"), [".ts", ".tsx"]),
      ...walk(path.join(ROOT, "components"), [".ts", ".tsx"]),
      ...walk(path.join(ROOT, "mobile", "src"), [".ts", ".tsx"]),
    ];

    const findings: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      for (const { name, pattern } of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          findings.push(`${name} pattern matched in ${path.relative(ROOT, file)}`);
        }
      }
    }
    expect(findings).toEqual([]);
  });

  it("no \"use client\" web component reads a non-public env var (which would be a code smell even though Next strips it from the bundle)", () => {
    const files = [...walk(path.join(ROOT, "app"), [".tsx"]), ...walk(path.join(ROOT, "components"), [".tsx"])];
    const findings: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (!content.trimStart().startsWith('"use client"')) continue;

      const matches = content.matchAll(/process\.env\.([A-Z0-9_]+)/g);
      for (const match of matches) {
        const varName = match[1];
        if (varName === "NODE_ENV" || varName.startsWith("NEXT_PUBLIC_")) continue;
        findings.push(`${path.relative(ROOT, file)} reads process.env.${varName} in a client component`);
      }
    }
    expect(findings).toEqual([]);
  });

  it("the mobile app only ever reads EXPO_PUBLIC_-prefixed env vars (everything in mobile/src ships to the client)", () => {
    const files = walk(path.join(ROOT, "mobile", "src"), [".ts", ".tsx"]);
    const findings: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const matches = content.matchAll(/process\.env\.([A-Z0-9_]+)/g);
      for (const match of matches) {
        const varName = match[1];
        if (varName.startsWith("EXPO_PUBLIC_") || varName === "NODE_ENV") continue;
        findings.push(`${path.relative(ROOT, file)} reads process.env.${varName}`);
      }
    }
    expect(findings).toEqual([]);
  });

  it("register/me routes select only safe User fields, never passwordHash or reset-token hash", () => {
    const routeFiles = [
      "app/api/auth/register/route.ts",
      "app/api/mobile/auth/register/route.ts",
      "app/api/mobile/auth/me/route.ts",
    ];
    for (const rel of routeFiles) {
      const content = readFileSync(path.join(ROOT, rel), "utf-8");
      const selectMatch = content.match(/select:\s*\{([^}]+)\}/);
      expect(selectMatch, `${rel} should use an explicit Prisma select`).toBeTruthy();
      expect(selectMatch![1]).not.toMatch(/passwordHash|passwordResetTokenHash/);
    }
  });
});
