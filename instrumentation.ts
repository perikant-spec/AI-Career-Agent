// Runs once when the server process starts (both `next dev` and a production server), before
// any request is handled — the right place for fail-fast startup checks. Only registered for
// the Node runtime; Edge (middleware) never needs this since env validation already happened in
// the Node process that's about to boot it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");
    validateEnv();
  }
}

// Next's single hook for every otherwise-uncaught error in a Server Component, Route Handler,
// Server Action, or Middleware — the centralized point every such error passes through, instead
// of relying on each of ~40 route handlers to remember to log its own catch block.
export async function onRequestError(
  error: unknown,
  request: Readonly<{ path: string; method: string }>,
  context: Readonly<{ routerKind: string; routePath: string; routeType: string }>
) {
  const { getLogger } = await import("./lib/logging");
  getLogger().error("Unhandled request error", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  });
}
