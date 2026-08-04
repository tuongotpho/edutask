import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Strip any `undefined` fields (Firestore rejects them) by round-tripping
// through JSON. Shared by every service that writes to Firestore.
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) return null as unknown as T;
  return JSON.parse(JSON.stringify(obj));
}

// Strips Vietnamese tone/vowel marks (NFD covers all of them except đ/Đ,
// which is a separate codepoint, not a decomposable base+mark pair) so
// search can match "toan" against "Toán".
export function removeDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function normalizeSearchText(str: string | undefined | null): string {
  if (!str) return '';
  return removeDiacritics(str).toLowerCase().trim();
}

// Empty/whitespace-only term matches everything, mirroring the "no filter
// applied" behavior every search box on this page relies on.
export function matchesSearch(term: string, ...fields: Array<string | undefined | null>): boolean {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return true;
  return fields.some(field => normalizeSearchText(field).includes(normalizedTerm));
}

// Collision-proof id. `Date.now()` alone repeats when two documents are created
// in the same millisecond; appending random entropy makes ids globally unique
// while keeping the readable, time-ordered prefix.
export function genId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}
