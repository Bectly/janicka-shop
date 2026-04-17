/**
 * Product defect utilities — free-text note + separate defect photos.
 * Second-hand items may have minor imperfections. We document them honestly
 * with a plain-text description and optional detail photos.
 */

export function parseDefectImages(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (u): u is string =>
        typeof u === "string" &&
        (u.startsWith("https://") || u.startsWith("http://")),
    );
  } catch {
    return [];
  }
}

export function serializeDefectImages(urls: string[]): string {
  return JSON.stringify(
    urls
      .filter(
        (u) =>
          typeof u === "string" &&
          (u.startsWith("https://") || u.startsWith("http://")),
      )
      .slice(0, 10),
  );
}
