import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { StorageProvider } from "./types";

// Outside `public/` so files are never web-served directly — every read goes through an
// authenticated API route that checks the requesting user owns the resume first.
const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

class LocalDiskStorage implements StorageProvider {
  async put({ userId, fileName, data }: { userId: string; fileName: string; data: Buffer }) {
    const userDir = path.join(UPLOAD_ROOT, userId);
    await fs.mkdir(userDir, { recursive: true });

    const storageKey = path.posix.join(userId, `${randomUUID()}-${sanitizeFileName(fileName)}`);
    const fullPath = path.join(UPLOAD_ROOT, storageKey);

    await fs.writeFile(fullPath, data);
    return storageKey;
  }

  async get(storageKey: string) {
    const fullPath = this.resolveSafe(storageKey);
    return fs.readFile(fullPath);
  }

  async delete(storageKey: string) {
    const fullPath = this.resolveSafe(storageKey);
    await fs.rm(fullPath, { force: true });
  }

  async deleteAll(userId: string) {
    const userDir = path.join(UPLOAD_ROOT, userId);
    if (!userDir.startsWith(UPLOAD_ROOT)) throw new Error("Invalid user id.");
    await fs.rm(userDir, { recursive: true, force: true });
  }

  /** Rejects any storageKey that would escape UPLOAD_ROOT (e.g. via `../`). */
  private resolveSafe(storageKey: string): string {
    const fullPath = path.join(UPLOAD_ROOT, storageKey);
    if (!fullPath.startsWith(UPLOAD_ROOT)) {
      throw new Error("Invalid storage key.");
    }
    return fullPath;
  }
}

export const storage: StorageProvider = new LocalDiskStorage();
