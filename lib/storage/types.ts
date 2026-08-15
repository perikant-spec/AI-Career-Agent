// Abstraction over where uploaded files (resumes) physically live. `LocalDiskStorage` is the
// only implementation today; swapping to an S3-compatible provider later means implementing
// this interface again, not touching any call site.
export interface StorageProvider {
  /** Persists a file and returns an opaque storageKey to retrieve it later. */
  put(params: { userId: string; fileName: string; data: Buffer }): Promise<string>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  /** Removes every file ever stored for a user — used by account deletion, since the DB rows
   *  cascade automatically but physical files don't. */
  deleteAll(userId: string): Promise<void>;
}
