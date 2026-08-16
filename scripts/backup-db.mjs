// Produces a plain-SQL pg_dump backup of DATABASE_URL into ./backups/. Works identically against
// the local embedded-postgres instance or any real managed Postgres provider, since pg_dump
// speaks the standard Postgres wire protocol — this is the "backup compatibility" a file-based
// SQLite database structurally could not offer (no concurrent-safe hot backup, no standard dump
// format). This script is the literal mechanism; the *schedule* (e.g. a daily cron/CI job, or a
// managed provider's own automated snapshots) is a deployment-environment decision, not
// something this repo can enforce on its own.
import { spawnSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, "..", "backups");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);

// pg_dump ships alongside the embedded-postgres binaries this repo already depends on for local
// dev; a real deployment target should use its own pg_dump (same major version as the server,
// ideally) or the managed provider's native snapshot tooling instead of this exact binary path.
const pgDumpCandidates = [
  path.resolve(__dirname, "..", "node_modules", "@embedded-postgres", "windows-x64", "native", "bin", "pg_dump.exe"),
  "pg_dump",
];

let result = null;
for (const bin of pgDumpCandidates) {
  result = spawnSync(bin, ["--no-owner", "--no-acl", "-f", outFile, databaseUrl], { stdio: "inherit" });
  if (!result.error) break;
}

if (!result || result.error || result.status !== 0) {
  console.error("Backup failed. Ensure pg_dump is available (see pgDumpCandidates in this script).");
  process.exit(1);
}

console.log(`Backup written to ${outFile}`);
