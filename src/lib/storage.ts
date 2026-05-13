import { promises as fs } from "node:fs";
import path from "node:path";

// Files for the playbook live OUTSIDE public/ so they aren't statically served
// without auth. The /api/files/[id] route checks auth + permission and streams
// from disk. UPLOAD_ROOT is the absolute path to that storage directory.
export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const MAX_BYTES = 12 * 1024 * 1024; // matches next.config bodySizeLimit
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

export function validateUpload(file: File): void {
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_BYTES / 1024 / 1024}MB.`);
  }
  if (!ALLOWED_MIME.has(file.type) && file.type !== "") {
    throw new Error(`Unsupported file type: ${file.type}.`);
  }
}

// Strip path traversal + collapse dangerous chars. Resource files keep
// human-readable names since admins/reps need to recognize them.
export function safeFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").trim();
  return base.replace(/[^\w.\- ]+/g, "_").slice(0, 200) || "file";
}

export async function saveFileForResource(
  resourceId: string,
  file: File,
): Promise<{ filePath: string; fileName: string; fileMime: string; fileSize: number }> {
  validateUpload(file);
  const fileName = safeFileName(file.name);
  const dir = path.join(UPLOAD_ROOT, resourceId);
  await fs.mkdir(dir, { recursive: true });
  const absPath = path.join(dir, fileName);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buf);
  return {
    filePath: `${resourceId}/${fileName}`,
    fileName,
    fileMime: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

export async function deleteFileForResource(resourceId: string): Promise<void> {
  const dir = path.join(UPLOAD_ROOT, resourceId);
  await fs.rm(dir, { recursive: true, force: true });
}

export async function readResourceFile(filePath: string): Promise<Buffer> {
  // Defensive: refuse paths that escape the upload root.
  const resolved = path.resolve(UPLOAD_ROOT, filePath);
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) {
    throw new Error("Invalid file path");
  }
  return fs.readFile(resolved);
}
