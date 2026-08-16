/** Drives Auth.js v5's real credentials sign-in flow (CSRF token dance + cookie capture) exactly
 *  as a browser would, for integration tests against routes that only accept the web cookie
 *  session (see the audit note in fullWorkflow.e2e.test.ts — several routes, e.g. resume
 *  upload/profile editing, are deliberately web-only today, not reachable via mobile Bearer
 *  token). Returns a `Cookie` header value usable on subsequent authenticated fetches. */
export async function createWebSession(baseUrl: string, email: string, password: string): Promise<string> {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const csrfBody = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookies = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]);

  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookies.join("; "),
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken: csrfBody.csrfToken,
      callbackUrl: baseUrl,
      json: "true",
    }),
    redirect: "manual",
  });

  const sessionCookies = loginRes.headers.getSetCookie().map((c) => c.split(";")[0]);
  if (sessionCookies.length === 0) {
    throw new Error(`Web sign-in failed for ${email} (status ${loginRes.status}) — no session cookie set.`);
  }

  return [...csrfCookies, ...sessionCookies].join("; ");
}
