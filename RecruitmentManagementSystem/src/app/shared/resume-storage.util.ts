/**
 * Encode a resume file for persistence in `ts_applications.resume_url`.
 * Uses a data URL so no separate blob store is required (Cordys/SOAP).
 * For very large files, returns null — caller should save without URL or use external upload.
 */
export const RESUME_DATA_URL_MAX_BYTES = 900_000;

export async function fileToResumeDataUrl(file: File): Promise<string | null> {
  if (!file || file.size > RESUME_DATA_URL_MAX_BYTES) {
    return null;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      resolve(typeof r === 'string' ? r : null);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
