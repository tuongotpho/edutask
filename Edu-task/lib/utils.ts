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
