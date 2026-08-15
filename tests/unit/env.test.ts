import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateEnv } from "@/lib/env";

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
