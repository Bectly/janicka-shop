/**
 * Browser-side photo compression for the QR mobile add pipeline.
 *
 * Spec: docs/qr-operational-gaps.md section C.
 * - Canvas re-encode → strips EXIF implicitly
 * - Resize main to 1600px longest side, thumb to 800px
 * - Output WebP @ q=0.85, JPEG fallback
 * - createImageBitmap with new Image() fallback (older Safari)
 * - HEIC unsupported → throw on Firefox; Chrome/Safari handle via OS codec
 * - Concurrent compression+upload limited via runWithLimit semaphore (default 3)
 */

const MAIN_MAX = 1600;
const THUMB_MAX = 800;
const QUALITY = 0.85;
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

export interface CompressedPhoto {
  main: Blob;
  thumb: Blob;
}

let _webpSupport: boolean | null = null;

function supportsWebpEncode(): boolean {
  if (_webpSupport !== null) return _webpSupport;
  if (typeof document === "undefined") {
    _webpSupport = false;
    return false;
  }
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const url = c.toDataURL("image/webp");
    _webpSupport = url.startsWith("data:image/webp");
  } catch {
    _webpSupport = false;
  }
  return _webpSupport;
}

interface DecodedSource {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  close?: () => void;
}

async function decodeBitmap(file: File): Promise<DecodedSource> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        close: () => bitmap.close(),
      };
    } catch {
      // fall through to <img> fallback (older Safari, some HEIC paths)
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new Error("Obrázek se nepodařilo načíst (nepodporovaný formát?)"));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function targetDimensions(srcW: number, srcH: number, maxSide: number) {
  const longest = Math.max(srcW, srcH);
  if (longest <= maxSide) return { w: srcW, h: srcH };
  const scale = maxSide / longest;
  return {
    w: Math.max(1, Math.round(srcW * scale)),
    h: Math.max(1, Math.round(srcH * scale)),
  };
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  preferWebp: boolean
): Promise<Blob> {
  const tryEncode = (type: string) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), type, QUALITY);
    });

  if (preferWebp) {
    const webp = await tryEncode("image/webp");
    if (webp && webp.size > 0) return webp;
  }
  const jpeg = await tryEncode("image/jpeg");
  if (jpeg && jpeg.size > 0) return jpeg;
  throw new Error("Kódování obrázku selhalo");
}

async function encodeAt(source: DecodedSource, maxSide: number): Promise<Blob> {
  const { w, h } = targetDimensions(source.width, source.height, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas context není dostupný");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  source.draw(ctx, w, h);
  return canvasToBlob(canvas, supportsWebpEncode());
}

export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  if (HEIC_TYPES.has(file.type)) {
    // Firefox can't decode HEIC; Chrome/Safari go through OS codec via createImageBitmap.
    // We optimistically try and let decode failure surface a Czech error.
  }

  let source: DecodedSource;
  try {
    source = await decodeBitmap(file);
  } catch (err) {
    if (HEIC_TYPES.has(file.type)) {
      throw new Error(
        "Tento prohlížeč neumí HEIC/HEIF. Pořiď fotku v JPEG."
      );
    }
    throw err instanceof Error ? err : new Error("Dekódování fotky selhalo");
  }

  try {
    const [main, thumb] = await Promise.all([
      encodeAt(source, MAIN_MAX),
      encodeAt(source, THUMB_MAX),
    ]);
    return { main, thumb };
  } finally {
    source.close?.();
  }
}

/**
 * Concurrent task pool with a fixed worker count. Used to cap simultaneous
 * compress+upload pipelines on flaky 4G (spec: max 3 in flight).
 */
export async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const concurrency = Math.max(1, Math.min(limit, items.length));

  async function pump() {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => pump()));
  return results;
}

export const __test = {
  targetDimensions,
  supportsWebpEncode: () => supportsWebpEncode(),
  resetWebpCache: () => {
    _webpSupport = null;
  },
};
