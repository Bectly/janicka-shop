/**
 * R2 Upload helpers — replaces the old UploadThing integration.
 * Client-side utilities for uploading files to Cloudflare R2 via /api/upload.
 */

/**
 * Upload files to R2 via the server-side /api/upload route.
 * Returns an array of public URLs for the uploaded files.
 */
export async function uploadFiles(files: File[]): Promise<string[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error ?? "Nahrávání selhalo"
    );
  }

  const data = (await res.json()) as { urls: string[] };
  return data.urls;
}
