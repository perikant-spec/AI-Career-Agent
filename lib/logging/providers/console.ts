import type { Logger, LogLevel } from "../types";

// Structured (JSON-line) console output — even without a real log-drain provider, this is
// immediately greppable/parseable by any platform that captures stdout (Vercel, Docker, systemd
// journal), which plain `console.log("some string")` calls elsewhere in the codebase are not.
function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry = { level, message, timestamp: new Date().toISOString(), ...context };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const consoleLogger: Logger = {
  debug: (message, context) => emit("debug", message, context),
  info: (message, context) => emit("info", message, context),
  warn: (message, context) => emit("warn", message, context),
  error: (message, context) => emit("error", message, context),
};
