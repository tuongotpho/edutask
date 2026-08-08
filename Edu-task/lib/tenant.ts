/**
 * Multi-school groundwork.
 *
 * Today this app serves exactly one school and every collection lives at the
 * root, which is the right shape for one school and the wrong shape for a
 * hundred. The eventual move — either `schools/{schoolId}/leaves/{id}`
 * subcollections or root collections filtered by tenant — needs the same one
 * thing from us either way: every document must know which school it belongs
 * to.
 *
 * Stamping `schoolId` on records as they are created costs a single field now.
 * Backfilling it across a live database later, while writing the security rules
 * that depend on it, is a migration. So new records carry it from day one even
 * though nothing reads it yet.
 *
 * What this file deliberately does NOT do is pretend the app is multi-tenant.
 * Real tenancy also needs per-school security rules, custom auth claims saying
 * which school a user belongs to, and an admin surface for provisioning — all
 * of which need a server. This is the cheap half that keeps that door open.
 */

export const DEFAULT_SCHOOL_ID = 'SCHOOL_DEFAULT';

/**
 * The school this deployment serves. One Firebase project per school keeps
 * every school's data physically separate, which is both the simplest thing to
 * operate today and the easiest story to tell about data protection; the env
 * var lets a shared-project deployment override it later without a code change.
 */
export function currentSchoolId(): string {
  return process.env.NEXT_PUBLIC_SCHOOL_ID?.trim() || DEFAULT_SCHOOL_ID;
}

/** Mixed into every record created after this change. */
export interface TenantScoped {
  schoolId: string;
}

/** Records written before tenancy existed have no `schoolId`; treat them as ours. */
export function belongsToCurrentSchool(record: Partial<TenantScoped> | null | undefined): boolean {
  if (!record) return false;
  return !record.schoolId || record.schoolId === currentSchoolId();
}
