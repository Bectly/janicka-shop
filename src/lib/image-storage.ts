/**
 * Image storage abstraction — Hetzner Phase 7 prep.
 *
 * Selects between two backends at runtime via IMAGE_STORAGE_BACKEND:
 *   - "r2"    (default): writes via R2 PutObject, public URL = NEXT_PUBLIC_R2_PUBLIC_URL/<key>
 *   - "local"          : writes to LOCAL_IMAGES_DIR/<key>, public URL = IMAGE_PUBLIC_URL_BASE/<key>
 *
 * Backwards compatible: with the env unset, every caller behaves exactly as it
 * did before this module existed (delegated through to src/lib/r2.ts).
 *
 * Phase 7 cutover (gated on Phases 2/3 closing — see
 * docs/runbooks/image-storage-phase7.md) flips the env on Hetzner so admin
 * uploads land on local SSD and customers fetch /uploads/<key> from nginx
 * instead of *.r2.dev. R2 stays as a backup target only (rclone sync nightly).
 *
 * SCOPE: this module covers the hot path — public URL building + admin upload.
 * The drafts pipeline (cleanup cron, drafts publish, claude-upload) and the
 * inbound mail attachment persist still talk to src/lib/r2.ts directly. Those
 * operations (list/copy/delete across thousands of orphaned drafts) are
 * refactored in the cutover PR — keeping them on R2 short-term keeps this prep
 * commit small enough to review.
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  uploadToR2,
  getR2PublicUrl,
  buildR2Url,
  extractR2Key,
  type R2UploadResult,
} from "@/lib/r2";

export type ImageBackendName = "r2" | "local";
export type ImageUploadResult = R2UploadResult; // { key, url }

/**
 * Resolved backend name. Defaults to "r2". Anything other than "local" falls
 * back to R2 — typos shouldn't silently switch to filesystem writes.
 */
export function getImageBackend(): ImageBackendName {
  const raw = (process.env.IMAGE_STORAGE_BACKEND ?? "").trim().toLowerCase();
  return raw === "local" ? "local" : "r2";
}

/**
 * Public URL prefix for serving images. Cutover-aware:
 *   - local backend: IMAGE_PUBLIC_URL_BASE (e.g. "https://www.jvsatnik.cz/uploads")
 *                    or fallback to "/uploads" (relative — works for same-origin)
 *   - r2 backend:    R2_PUBLIC_URL / NEXT_PUBLIC_R2_PUBLIC_URL (existing behavior)
 *
 * Returned with no trailing slash so callers can do `${base}/${key}`.
 */
export function getImagePublicUrlBase(): string {
  if (getImageBackend() === "local") {
    const explicit = process.env.IMAGE_PUBLIC_URL_BASE;
    const base = explicit && explicit.trim() !== "" ? explicit : "/uploads";
    return base.replace(/\/+$/, "");
  }
  return getR2PublicUrl();
}

/**
 * Build a public URL for an image key. Equivalent to buildR2Url under the R2
 * backend; under the local backend, returns `${IMAGE_PUBLIC_URL_BASE}/<key>`.
 */
export function buildImageUrl(key: string): string {
  if (getImageBackend() === "local") {
    return `${getImagePublicUrlBase()}/${key.replace(/^\/+/, "")}`;
  }
  return buildR2Url(key);
}

/**
 * Reverse of buildImageUrl — extracts the storage key from a public URL.
 * Returns null if the URL is not hosted on the configured public origin
 * (e.g. legacy UploadThing URLs, foreign CDN URLs).
 *
 * Local-backend caveat: when IMAGE_PUBLIC_URL_BASE is the relative "/uploads",
 * we can only match URLs that start with "/uploads/". Absolute URLs from
 * before the cutover are still routed through extractR2Key as a fallback so
 * the historical *.r2.dev links keep resolving on the cutover day itself.
 */
export function extractImageKey(url: string): string | null {
  if (getImageBackend() === "local") {
    const base = getImagePublicUrlBase();
    if (url.startsWith(base + "/")) return url.slice(base.length + 1);
    // fallback: try the historic R2 public URL so links emitted before the
    // backend flip still resolve to a valid key.
    return extractR2Key(url);
  }
  return extractR2Key(url);
}

/**
 * Local images directory on disk. Defaults to /opt/janicka-shop-images per the
 * Phase 3 runbook. Override via LOCAL_IMAGES_DIR for dev/test.
 */
function getLocalImagesDir(): string {
  return process.env.LOCAL_IMAGES_DIR ?? "/opt/janicka-shop-images";
}

/**
 * Sanitize a filename for use in a storage key. Mirrors uploadToR2 so keys
 * stay format-stable across backends — switching IMAGE_STORAGE_BACKEND should
 * not change how generated keys look.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);
}

/**
 * Write a buffer to local filesystem at <LOCAL_IMAGES_DIR>/<folder>/<key>.
 * Returns the same { key, url } shape as uploadToR2 so callers don't care.
 *
 * Path safety: we generate the key ourselves (UUID + sanitized basename) so
 * `path.resolve` against the images dir cannot escape via "../". Defensive
 * check confirms the resolved path stays within the dir.
 */
async function uploadToLocal(
  fileBuffer: Buffer,
  fileName: string,
  _contentType: string,
  folder = "products",
  explicitKey?: string
): Promise<ImageUploadResult> {
  const safeFolder = folder.replace(/[^a-zA-Z0-9._-]/g, "-");
  const safeName = sanitizeFilename(fileName);
  const key = explicitKey ?? `${safeFolder}/${randomUUID()}-${safeName}`;

  // Turbopack NFT-trace these as runtime-only — without the hint, the static
  // analyzer treats path.resolve(process.cwd(), ...) as "trace whole project"
  // and the lambda balloons past Vercel's 300 MB limit (Phase 7 build break).
  const root = path.resolve(/*turbopackIgnore: true*/ getLocalImagesDir());
  const target = path.resolve(/*turbopackIgnore: true*/ root, key);
  if (!target.startsWith(root + path.sep)) {
    throw new Error(`image-storage: refusing to write outside images dir (${key})`);
  }

  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
  await fs.writeFile(/*turbopackIgnore: true*/ target, fileBuffer);

  return { key, url: buildImageUrl(key) };
}

/**
 * Upload a buffer using the active backend. Drop-in replacement for
 * uploadToR2 — same signature, same return shape. Callers should migrate
 * to this; the underlying r2.uploadToR2 stays around for backup-script
 * use and for the drafts pipeline pending its own refactor.
 */
export async function uploadImage(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folder = "products",
  explicitKey?: string
): Promise<ImageUploadResult> {
  if (getImageBackend() === "local") {
    return uploadToLocal(fileBuffer, fileName, contentType, folder, explicitKey);
  }
  return uploadToR2(fileBuffer, fileName, contentType, folder, explicitKey);
}
