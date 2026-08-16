// Manages a real, local, persistent PostgreSQL instance for development — no Docker and no
// system-level install/admin rights required. Uses `embedded-postgres`, which downloads a real
// Postgres binary distribution once and runs it as a plain child process under the current user.
//
// This is a development convenience only. Staging/production point DATABASE_URL at a managed
// Postgres provider (RDS, Cloud SQL, Neon, Supabase, etc.) instead — nothing about the
// application code cares which one it's talking to, since both speak the same wire protocol.
//
// Usage: node scripts/postgres-local.mjs start|stop|status
import EmbeddedPostgres from "embedded-postgres";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", ".postgres-data");
const PORT = 5432;
const USER = "postgres";
const PASSWORD = "postgres";
const DB_NAME = "ai_career_agent";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
});

async function start() {
  const { existsSync } = await import("fs");
  const alreadyInitialised = existsSync(path.join(DATA_DIR, "PG_VERSION"));

  if (!alreadyInitialised) {
    console.log(`Initializing a new local Postgres cluster at ${DATA_DIR} ...`);
    await pg.initialise();
  }

  console.log(`Starting local Postgres on port ${PORT} ...`);
  await pg.start();

  try {
    await pg.createDatabase(DB_NAME);
    console.log(`Created database "${DB_NAME}".`);
  } catch {
    // Already exists — fine.
  }

  console.log(
    `Ready. DATABASE_URL="postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB_NAME}?schema=public"`
  );
}

async function stop() {
  console.log("Stopping local Postgres ...");
  await pg.stop();
  console.log("Stopped.");
}

const command = process.argv[2];
if (command === "start") {
  await start();
} else if (command === "stop") {
  await stop();
} else {
  console.error("Usage: node scripts/postgres-local.mjs start|stop");
  process.exit(1);
}
