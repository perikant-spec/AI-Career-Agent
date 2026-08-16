// Post-deploy black-box check — everything here goes through the same public HTTP surface a
// real user would hit, including cleanup via the app's own self-service account deletion
// (DELETE /api/account), not direct database access. That's deliberate: this script is meant to
// run against a real staging/production URL where this machine has no DB credentials at all, only
// the deployed app's own API. It is not a substitute for the full test suite (that's CI's
// integration-tests job, against a real Postgres it does have credentials for) — this only proves
// the deployed build actually boots, serves, and completes one real write end-to-end.
//
// Usage: BASE_URL=https://staging.example.com node scripts/smoke-test.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

function fail(step, detail) {
  console.error(`FAIL [${step}]: ${detail}`);
  process.exitCode = 1;
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`expected JSON, got: ${text.slice(0, 300)}`);
  }
}

async function main() {
  console.log(`Smoke testing ${BASE_URL} ...`);

  // 1. Health check
  const health = await fetch(`${BASE_URL}/api/health`).catch((e) => {
    throw new Error(`could not reach ${BASE_URL}/api/health: ${e.message}`);
  });
  const healthBody = await json(health);
  if (health.status !== 200 || healthBody.status !== "ok" || healthBody.database !== "ok") {
    fail("health", `expected 200 {status:"ok",database:"ok"}, got ${health.status} ${JSON.stringify(healthBody)}`);
  } else {
    console.log("PASS [health]", healthBody);
  }

  // 2. Legal placeholder pages actually render (not a 404/500)
  for (const path of ["/terms", "/privacy"]) {
    const res = await fetch(`${BASE_URL}${path}`);
    if (res.status !== 200) {
      fail(`page ${path}`, `expected 200, got ${res.status}`);
    } else {
      console.log(`PASS [page ${path}]`, res.status);
    }
  }

  // 3. A real signup, through the real route, persisting to the real database.
  const email = `smoke-test-${Date.now()}@example.com`;
  const password = "smokeTestPass123";
  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, acceptedLegal: true }),
  });
  if (registerRes.status !== 201) {
    fail("register", `expected 201, got ${registerRes.status}: ${JSON.stringify(await json(registerRes).catch(() => null))}`);
    printSummary();
    return;
  }
  console.log("PASS [register]", registerRes.status);

  // 4. Sign in for real (Auth.js v5 CSRF + credentials-callback dance, same as a browser).
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await json(csrfRes);
  const csrfCookies = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]);

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookies.join("; ") },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: BASE_URL, json: "true" }),
    redirect: "manual",
  });
  const sessionCookies = loginRes.headers.getSetCookie().map((c) => c.split(";")[0]);
  if (sessionCookies.length === 0) {
    fail("login", `no session cookie set (status ${loginRes.status})`);
    printSummary();
    return;
  }
  console.log("PASS [login]");
  const cookie = [...csrfCookies, ...sessionCookies].join("; ");

  // 5. Clean up — self-service delete, the same mechanism a real user has, proving that path
  // works too rather than leaving smoke-test accounts to accumulate in the real database.
  const deleteRes = await fetch(`${BASE_URL}/api/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ password }),
  });
  if (deleteRes.status !== 200) {
    fail("cleanup", `expected 200, got ${deleteRes.status} — smoke-test account ${email} was NOT cleaned up, remove it manually`);
  } else {
    console.log("PASS [cleanup]");
  }

  printSummary();
}

function printSummary() {
  if (process.exitCode) {
    console.log("\nSMOKE TEST: FAILED");
  } else {
    console.log("\nSMOKE TEST: ALL PASSED");
  }
}

main().catch((err) => {
  console.error("Smoke test crashed:", err.message);
  process.exitCode = 1;
});
