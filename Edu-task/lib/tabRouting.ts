// Type-only: this module is imported by unit tests, and pulling the sidebar
// component itself into a node environment would drag in the whole app tree.
import type { TabType } from '@/Edu-task/components/layout/Sidebar';
import { RoleType, User } from '@/Edu-task/types/user';
import { canManageRbac, canViewStats, isSchoolLeadership } from '@/Edu-task/lib/permissions';

/**
 * Tab ↔ URL slug.
 *
 * The tabs used to live only in React state, so a reload dropped you back on
 * the dashboard, Back left the app entirely, and a tab could not be linked to.
 * Slugs are Vietnamese and stable: they appear in links people paste to each
 * other, so renaming one breaks their bookmarks.
 */
export const TAB_SLUGS: Record<TabType, string> = {
  dashboard: 'tong-quan',
  leave: 'don-xin-nghi',
  task: 'giao-viec',
  schedule: 'lich-nghi',
  lessons: 'day-bu-phong',
  attendance: 'ne-nep',
  meetings: 'cuoc-hop',
  plans: 'ke-hoach',
  students: 'hoc-sinh',
  gifted: 'boi-duong-hsg',
  stats: 'bao-cao',
  audit: 'nhat-ky',
  config: 'quan-tri',
  guide: 'huong-dan',
};

const SLUG_TO_TAB: Record<string, TabType> = Object.fromEntries(
  Object.entries(TAB_SLUGS).map(([tab, slug]) => [slug, tab as TabType])
) as Record<string, TabType>;

export const DEFAULT_TAB: TabType = 'dashboard';

/** Reads `?tab=` out of a query string, falling back to the dashboard. */
export function tabFromSearch(search: string): TabType {
  const slug = new URLSearchParams(search).get('tab');
  return (slug && SLUG_TO_TAB[slug]) || DEFAULT_TAB;
}

/**
 * The dashboard is the default, so it stays on the bare path — a shared link to
 * the home screen should not carry a redundant `?tab=tong-quan`.
 */
export function searchForTab(tab: TabType): string {
  return tab === DEFAULT_TAB ? '' : `?tab=${TAB_SLUGS[tab]}`;
}

/**
 * Which tabs a role may open.
 *
 * The sidebar hides entries it should not offer, but a URL can now ask for any
 * tab directly, so the same rule has to be enforced when reading the address
 * bar. Both callers share this function precisely so the two cannot drift.
 */
export function canAccessTab(user: User | null, activeRole: RoleType | null | undefined, tab: TabType): boolean {
  switch (tab) {
    case 'stats':
      return canViewStats(user, activeRole);
    case 'audit':
      return isSchoolLeadership(user, activeRole);
    case 'config':
      return canManageRbac(user, activeRole);
    default:
      return true;
  }
}
