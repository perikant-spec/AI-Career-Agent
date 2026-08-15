import type { StorageProvider } from "./types";
import { isS3Configured, getS3Storage } from "./s3";
import { storage as localDiskStorage } from "./localDisk";

/**
 * The single branch point for storage provider selection — same pattern as
 * lib/ai#getAIProvider and lib/billing#getStripeClient. Production and staging must set
 * S3_BUCKET; local development without it falls back to disk so `npm run dev` keeps working
 * with zero setup. This function — not `process.env.S3_BUCKET` — is what every call site should
 * check.
 */
export function getStorageProvider(): StorageProvider {
  if (isS3Configured()) return getS3Storage();
  return localDiskStorage;
}

export type * from "./types";
export { ALLOWED_RESUME_MIME_TYPES, ALLOWED_RESUME_EXTENSIONS, MAX_RESUME_FILE_SIZE_BYTES, isAllowedResumeFile } from "./types";
