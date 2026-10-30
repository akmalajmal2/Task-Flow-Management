import { createClient } from "@/lib/supabase/client";
import type { DecisionFile } from "@/lib/types";

const FILE_BUCKET = "task-files";
export const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
export const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf";
const OK = new Set(ACCEPT.split(","));

export const isImage = (type: string) => type.startsWith("image/");

export const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Returns a message when the file can't be attached, otherwise null. */
export function fileProblem(f: File): string | null {
  if (!OK.has(f.type)) return `${f.name}: only photos and PDFs can be attached`;
  if (f.size > MAX_BYTES) return `${f.name} is larger than 5 MB`;
  return null;
}

/** Upload straight from the browser (server actions have a 1 MB body limit). Returns what was stored. */
export async function uploadFiles(projectId: string, taskId: string, files: File[]): Promise<DecisionFile[]> {
  const bucket = createClient().storage.from(FILE_BUCKET);
  const stamp = Date.now();
  const done: DecisionFile[] = [];
  for (const [i, f] of files.entries()) {
    const safe = f.name.replace(/[^\w.\- ]+/g, "_").slice(-80);
    const path = `${projectId}/${taskId}/${stamp}-${i}-${safe}`;
    const { error } = await bucket.upload(path, f, { contentType: f.type, upsert: false });
    if (error) throw new Error(`Could not upload ${f.name}: ${error.message}`);
    done.push({ path, name: f.name, type: f.type, size: f.size });
  }
  return done;
}

/** Short-lived links so the private files can be opened or previewed. */
export async function signedUrls(files: DecisionFile[]): Promise<Record<string, string>> {
  if (!files.length) return {};
  const { data } = await createClient().storage.from(FILE_BUCKET).createSignedUrls(files.map((f) => f.path), 3600);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}
