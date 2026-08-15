import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

// s3rver is a real, pure-Node S3-compatible server — this test proves the S3StorageProvider
// actually works against a real S3 API surface (PutObject/GetObject/DeleteObject/
// ListObjectsV2/presigned URLs), not just that it typechecks. No cloud account or Docker
// required. s3rver ships no TypeScript types, hence the dynamic require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const S3rver = require("s3rver");

const PORT = 5411;
const BUCKET = "resumes-test";
let server: { close: (cb: (err?: unknown) => void) => void };
let dataDir: string;

describe("S3StorageProvider (against a real local S3-compatible server)", () => {
  beforeAll(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "s3rver-"));

    await new Promise<void>((resolve, reject) => {
      server = new S3rver({
        port: PORT,
        address: "localhost",
        silent: true,
        directory: dataDir,
        configureBuckets: [{ name: BUCKET, configs: [] }],
      }).run((err: unknown) => (err ? reject(err) : resolve()));
    });

    process.env.S3_BUCKET = BUCKET;
    process.env.S3_REGION = "us-east-1";
    process.env.S3_ENDPOINT = `http://localhost:${PORT}`;
    process.env.S3_ACCESS_KEY_ID = "S3RVER";
    process.env.S3_SECRET_ACCESS_KEY = "S3RVER";
  }, 20000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(dataDir, { recursive: true, force: true });
    delete process.env.S3_BUCKET;
    delete process.env.S3_REGION;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
  });

  it("round-trips a file through put/get", async () => {
    const { getS3Storage } = await import("@/lib/storage/s3");
    const provider = getS3Storage();
    const content = Buffer.from("this is a fake resume PDF's bytes");

    const key = await provider.put({
      userId: "user-a",
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      data: content,
    });

    expect(key).toMatch(/^user-a\//);
    const fetched = await provider.get(key);
    expect(fetched.toString()).toBe(content.toString());
  });

  it("deletes a single object", async () => {
    const { getS3Storage } = await import("@/lib/storage/s3");
    const provider = getS3Storage();
    const key = await provider.put({
      userId: "user-b",
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("to be deleted"),
    });

    await provider.delete(key);
    await expect(provider.get(key)).rejects.toThrow();
  });

  it("deleteAll removes every object under a user's prefix and nothing else", async () => {
    const { getS3Storage } = await import("@/lib/storage/s3");
    const provider = getS3Storage();

    const keyC1 = await provider.put({ userId: "user-c", fileName: "a.pdf", mimeType: "application/pdf", data: Buffer.from("1") });
    const keyC2 = await provider.put({ userId: "user-c", fileName: "b.pdf", mimeType: "application/pdf", data: Buffer.from("2") });
    const keyD1 = await provider.put({ userId: "user-d", fileName: "c.pdf", mimeType: "application/pdf", data: Buffer.from("3") });

    await provider.deleteAll("user-c");

    await expect(provider.get(keyC1)).rejects.toThrow();
    await expect(provider.get(keyC2)).rejects.toThrow();
    // A different user's object under a different prefix must survive.
    const stillThere = await provider.get(keyD1);
    expect(stillThere.toString()).toBe("3");
  });

  it("issues a working, time-limited signed download URL", async () => {
    const { getS3Storage } = await import("@/lib/storage/s3");
    const provider = getS3Storage();
    const key = await provider.put({
      userId: "user-e",
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("signed url content"),
    });

    const url = await provider.getSignedDownloadUrl(key, 60);
    expect(url).toContain("X-Amz-Signature"); // proves it's actually a signed request, not a bare object URL
    expect(url).toContain("X-Amz-Expires=60");
    expect(url).toContain(key);

    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("signed url content");

    // NOTE on what this test cannot prove: s3rver (the local S3-compatible emulator used here)
    // does not enforce bucket ACLs/IAM policy the way real AWS S3 does — it accepts unsigned
    // requests that a real private bucket would reject with 403. put() never sets a public-read
    // ACL, which is the code-level guarantee this repo controls; that an unsigned request to the
    // real production bucket is actually rejected is an infrastructure property to verify once
    // against the real bucket (confirm "Block Public Access" is on and no bucket policy grants
    // public read) — that check belongs in deployment verification, not this unit-level test.
  });
});
