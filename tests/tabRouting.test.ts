import { describe, it, expect } from 'vitest';
import { TAB_SLUGS, DEFAULT_TAB, tabFromSearch, searchForTab, canAccessTab } from '@/Edu-task/lib/tabRouting';
import { TabType } from '@/Edu-task/components/layout/Sidebar';
import { RoleType, User } from '@/Edu-task/types/user';

/**
 * Tab slugs end up in links people paste to each other, and the URL is now the
 * only thing that says which tab is open after a reload — so both directions of
 * the mapping, and the role check applied to a hand-typed address, are pinned.
 */

const ALL_TABS = Object.keys(TAB_SLUGS) as TabType[];

function makeUser(roles: RoleType[]): User {
  return {
    id: 'USR_1',
    fullName: 'Người dùng',
    email: 'u@school.vn',
    departmentId: 'DEPT_1',
    departmentName: 'Tổ 1',
    roles,
    activeRole: roles[0],
    isTeachingStaff: true,
    status: 'ACTIVE',
  };
}

describe('tabFromSearch', () => {
  it('resolves every slug back to the tab it came from', () => {
    for (const tab of ALL_TABS) {
      expect(tabFromSearch(searchForTab(tab) || '?tab=' + TAB_SLUGS[tab])).toBe(tab);
    }
  });

  it('falls back to the dashboard for an empty, unknown or malformed query', () => {
    expect(tabFromSearch('')).toBe(DEFAULT_TAB);
    expect(tabFromSearch('?tab=')).toBe(DEFAULT_TAB);
    expect(tabFromSearch('?tab=khong-ton-tai')).toBe(DEFAULT_TAB);
    expect(tabFromSearch('?other=don-xin-nghi')).toBe(DEFAULT_TAB);
  });

  it('reads the tab even when other query params are present', () => {
    expect(tabFromSearch('?utm_source=zalo&tab=don-xin-nghi')).toBe('leave');
  });
});

describe('searchForTab', () => {
  it('leaves the default tab on a bare path', () => {
    expect(searchForTab(DEFAULT_TAB)).toBe('');
  });

  it('emits a query for every other tab', () => {
    for (const tab of ALL_TABS.filter(t => t !== DEFAULT_TAB)) {
      expect(searchForTab(tab)).toBe(`?tab=${TAB_SLUGS[tab]}`);
    }
  });

  it('uses distinct slugs, so no two tabs share a URL', () => {
    expect(new Set(Object.values(TAB_SLUGS)).size).toBe(ALL_TABS.length);
  });
});

describe('canAccessTab', () => {
  const teacher = makeUser(['TEACHER']);
  const principal = makeUser(['PRINCIPAL']);
  const admin = makeUser(['ADMIN']);

  it('lets anyone open the everyday tabs', () => {
    for (const tab of ['dashboard', 'leave', 'task', 'schedule'] as TabType[]) {
      expect(canAccessTab(teacher, 'TEACHER', tab)).toBe(true);
    }
  });

  it('keeps a teacher out of the restricted tabs even when the URL asks for them', () => {
    expect(canAccessTab(teacher, 'TEACHER', 'stats')).toBe(false);
    expect(canAccessTab(teacher, 'TEACHER', 'audit')).toBe(false);
    expect(canAccessTab(teacher, 'TEACHER', 'config')).toBe(false);
  });

  it('grants leadership the audit log but still not the admin console', () => {
    expect(canAccessTab(principal, 'PRINCIPAL', 'audit')).toBe(true);
    expect(canAccessTab(principal, 'PRINCIPAL', 'config')).toBe(false);
  });

  it('grants the admin console to admins', () => {
    expect(canAccessTab(admin, 'ADMIN', 'config')).toBe(true);
  });

  it('refuses restricted tabs when there is no signed-in user', () => {
    expect(canAccessTab(null, null, 'config')).toBe(false);
    expect(canAccessTab(null, null, 'stats')).toBe(false);
  });
});
