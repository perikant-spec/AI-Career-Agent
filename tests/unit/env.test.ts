import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateEnv, getAppEnv } from "@/lib/env";

describe("validateEnv", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("passes when all required vars are set", () => {
    process.env.DATABASE_URL = "file:./dev.db";
    process.env.AUTH_SECRET = "test-secret";
    expect(() => validateEnv()).not.toThrow();
  });

  it("throws naming every missing required var", () => {
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    expect(() => validateEnv()).toThrowError(/DATABASE_URL.*AUTH_SECRET|AUTH_SECRET.*DATABASE_URL/);
  });

  it("throws when only one required var is missing", () => {
    process.env.DATABASE_URL = "file:./dev.db";
    delete process.env.AUTH_SECRET;
    expect(() => validateEnv()).toThrowError(/AUTH_SECRET/);
  });

  it("does not require optional integrations (Anthropic/Adzuna/Stripe)", () => {
    process.env.DATABASE_URL = "file:./dev.db";
    process.env.AUTH_SECRET = "test-secret";
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ADZUNA_APP_ID;
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => validateEnv()).not.toThrow();
  });
});

describe("getAppEnv", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("uses APP_ENV verbatim when set to a valid value", () => {
    process.env.APP_ENV = "staging";
    expect(getAppEnv()).toBe("staging");
    process.env.APP_ENV = "production";
    expect(getAppEnv()).toBe("production");
    process.env.APP_ENV = "development";
    expect(getAppEnv()).toBe("development");
  });

  it("falls back to NODE_ENV when APP_ENV is unset or invalid", () => {
    delete process.env.APP_ENV;
    vi.stubEnv("NODE_ENV", "production");
    expect(getAppEnv()).toBe("production");

    vi.stubEnv("NODE_ENV", "development");
    expect(getAppEnv()).toBe("development");

    // An invalid/typo'd APP_ENV falls back rather than silently becoming some fourth value.
    process.env.APP_ENV = "prod"; // not a real value
    vi.stubEnv("NODE_ENV", "production");
    expect(getAppEnv()).toBe("production");

    vi.unstubAllEnvs();
  });
});

describe("validateEnv — production safety assertions (APP_ENV=production only)", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    process.env.APP_ENV = "production";
    process.env.DATABASE_URL = "postgresql://user:pass@prod-db.example.com:5432/app";
    process.env.AUTH_SECRET = "a".repeat(40);
    process.env.AUTH_URL = "https://app.example.com";
    process.env.S3_BUCKET = "prod-resumes";
    delete process.env.RATE_LIMIT_DISABLED;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("passes when every production safety condition is met", () => {
    expect(() => validateEnv()).not.toThrow();
  });

  it("throws when RATE_LIMIT_DISABLED is true", () => {
    process.env.RATE_LIMIT_DISABLED = "true";
    expect(() => validateEnv()).toThrowError(/RATE_LIMIT_DISABLED/);
  });

  it("throws when DATABASE_URL points at localhost", () => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_career_agent";
    expect(() => validateEnv()).toThrowError(/DATABASE_URL/);
  });

  it("throws when S3_BUCKET is not set (would silently fall back to local-disk storage)", () => {
    delete process.env.S3_BUCKET;
    expect(() => validateEnv()).toThrowError(/S3_BUCKET/);
  });

  it("throws when AUTH_SECRET is missing or too short", () => {
    process.env.AUTH_SECRET = "short";
    expect(() => validateEnv()).toThrowError(/AUTH_SECRET/);
  });

  it("throws when AUTH_URL points at localhost", () => {
    process.env.AUTH_URL = "http://localhost:3000";
    expect(() => validateEnv()).toThrowError(/AUTH_URL/);
  });

  it("reports every violated condition at once, not just the first", () => {
    process.env.RATE_LIMIT_DISABLED = "true";
    delete process.env.S3_BUCKET;
    try {
      validateEnv();
      expect.fail("expected validateEnv to throw");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/RATE_LIMIT_DISABLED/);
      expect(message).toMatch(/S3_BUCKET/);
    }
  });

  it("does not apply these checks outside APP_ENV=production (staging is exempt)", () => {
    process.env.APP_ENV = "staging";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_career_agent";
    delete process.env.S3_BUCKET;
    expect(() => validateEnv()).not.toThrow();
  });
});
