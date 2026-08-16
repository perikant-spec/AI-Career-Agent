// Abstraction over where uploaded files (resumes) physically live. `LocalDiskStorage` is a
// dev-only fallback; `S3StorageProvider` is the production implementation. Swapping providers
// means implementing this interface again, not touching any call site — see index.ts for the
// single branch point that picks between them.
export interface StorageProvider {
  /** Persists a file and returns an opaque storageKey to retrieve it later. Implementations
   *  must never make the stored object publicly readable. */
  put(params: { userId: string; fileName: string; mimeType: string; data: Buffer }): Promise<string>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  /** Removes every file ever stored for a user — used by account deletion, since the DB rows
   *  cascade automatically but physical files don't. */
  deleteAll(userId: string): Promise<void>;
  /** A short-lived, pre-authenticated URL for downloading a single object directly — the only
   *  sanctioned way to hand a client a link to private object storage. There is no route that
   *  calls this today (resumes are only ever read server-side, never served back as a file), but
   *  the capability exists so a future "download my original resume" feature never needs to make
   *  the bucket or object public to implement it. */
  getSignedDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
}

// Only file types the extraction pipeline (lib/resumeText/extract.ts) can actually process are
// accepted at upload time — rejecting anything else here, before it's ever stored, is strictly
// better than silently storing a file that can never be processed (the previous behavior) and
// closes off arbitrary-file-type storage as an attack surface (e.g. HTML/SVG with embedded
// scripts, executables) on a bucket that will eventually be fronted by signed URLs.
export const ALLOWED_RESUME_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
export const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".docx"];
export const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function isAllowedResumeFile(mimeType: string, fileName: string): boolean {
  if (ALLOWED_RESUME_MIME_TYPES.has(mimeType)) return true;
  const lower = fileName.toLowerCase();
  return ALLOWED_RESUME_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
