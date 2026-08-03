/**
 * Client-side upload rules. Kept pure and separate from the Firebase SDK so the
 * limits can be unit-tested, and so they stay readable next to their mirror in
 * `storage.rules` — the browser check is only a courtesy, the bucket enforces it.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB, matches storage.rules

export const ACCEPTED_MIME_PREFIXES = ['image/'];
export const ACCEPTED_MIME_TYPES = ['application/pdf'];

/** `accept` attribute for the file input. */
export const ACCEPT_ATTRIBUTE = 'image/*,application/pdf';

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isAcceptedType(mimeType: string): boolean {
  if (!mimeType) return false;
  return (
    ACCEPTED_MIME_TYPES.includes(mimeType) ||
    ACCEPTED_MIME_PREFIXES.some(prefix => mimeType.startsWith(prefix))
  );
}

/**
 * Returns a Vietnamese error message, or null when the file is acceptable.
 */
export function validateUpload(file: { name: string; size: number; type: string }): string | null {
  if (!isAcceptedType(file.type)) {
    return `"${file.name}" không được hỗ trợ. Chỉ nhận ảnh (PNG, JPG…) và PDF.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" nặng ${formatFileSize(file.size)}, vượt giới hạn ${formatFileSize(MAX_UPLOAD_BYTES)}.`;
  }
  if (file.size === 0) {
    return `"${file.name}" là file rỗng.`;
  }
  return null;
}

/**
 * Strips characters that would break a storage path, while keeping the name
 * recognisable. A random prefix is added by the caller so two uploads of
 * "giay-kham.pdf" never collide.
 */
export function sanitizeFileName(name: string): string {
  // Trim BEFORE collapsing whitespace: doing it the other way round turns an
  // all-blank name into "_", which then slips past the empty-name fallback.
  const cleaned = name
    .normalize('NFC')
    .trim()
    .replace(/[/\\?%*:|"<>#\[\]]/g, '-')
    .replace(/\s+/g, '_');
  // Keep the tail: the extension matters more than a long prefix.
  return cleaned.length > 100 ? cleaned.slice(-100) : cleaned || 'file';
}
