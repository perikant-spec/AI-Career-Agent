import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import type { StorageProvider } from "./types";

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

export function isS3Configured(): boolean {
  return Boolean(process.env.S3_BUCKET);
}

/**
 * Production object-storage provider — S3-compatible (works against real AWS S3, Cloudflare R2,
 * or any S3-API-compatible endpoint via S3_ENDPOINT, which is also how this gets exercised
 * against a local s3rver instance in tests without needing real cloud credentials). Every object
 * is written with no ACL (bucket-private by default — this app never sets `public-read`), so the
 * only sanctioned read path is either a server-side `get()` or a time-limited signed URL.
 */
class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!process.env.S3_BUCKET) {
      throw new Error("S3StorageProvider constructed without S3_BUCKET set.");
    }
    this.bucket = process.env.S3_BUCKET;
    this.client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT), // required by MinIO/s3rver/most non-AWS endpoints
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined, // falls back to the default AWS credential chain (IAM role, etc.)
    });
  }

  async put({
    userId,
    fileName,
    mimeType,
    data,
  }: {
    userId: string;
    fileName: string;
    mimeType: string;
    data: Buffer;
  }): Promise<string> {
    const storageKey = `${userId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: data,
        ContentType: mimeType,
        // No ACL set — the bucket's own (private) default applies. Never pass "public-read".
      })
    );
    return storageKey;
  }

  async get(storageKey: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Object not found: ${storageKey}`);
    return Buffer.from(bytes);
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  async deleteAll(userId: string): Promise<void> {
    let continuationToken: string | undefined;
    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: `${userId}/`, ContinuationToken: continuationToken })
      );
      for (const obj of listed.Contents ?? []) {
        if (obj.Key) await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: obj.Key }));
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  async getSignedDownloadUrl(storageKey: string, expiresInSeconds = 300): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: storageKey });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}

let cached: S3StorageProvider | null = null;
export function getS3Storage(): StorageProvider {
  if (!cached) cached = new S3StorageProvider();
  return cached;
}
