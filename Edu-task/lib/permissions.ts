import { User, RoleType } from '@/Edu-task/types/user';
import { isAdminEmail } from '@/Edu-task/lib/admin';

/**
 * Single source of truth for "who may do what".
 *
 * These checks previously lived inline in six components and had drifted apart
 * — e.g. the sidebar offered "Giao Việc Mới" to admins and group leaders while
 * the task tab hid the same button from them. Everything now derives from the
 * one capability table below, so the UI cannot disagree with itself and the
 * RBAC matrix shown to admins is generated from the real rules rather than a
 * hand-maintained copy.
 *
 * NOTE: this is UI-level authorization only. The app talks to Firestore
 * directly, so `firestore.rules` remains the actual security boundary; these
 * helpers decide what to *show*, never what is *allowed*.
 */

export const ALL_ROLES: RoleType[] = [
  'TEACHER',
  'GROUP_LEADER',
  'HEAD_OF_DEPT',
  'VICE_PRINCIPAL',
  'PRINCIPAL',
  'SECRETARY',
  'ACCOUNTANT',
  'TRADE_UNION',
  'INSPECTOR',
  'ADMIN',
];

/** Roles whose remit is the whole school rather than one department. */
export const SCHOOL_LEADERSHIP_ROLES: RoleType[] = [
  'ADMIN',
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'SECRETARY',
  'INSPECTOR',
];

/** Roles that lead a single department. */
export const DEPT_LEADERSHIP_ROLES: RoleType[] = ['HEAD_OF_DEPT', 'GROUP_LEADER'];

export type PermissionKey =
  | 'leave:create'
  | 'leave:approve_dept'
  | 'leave:approve_exec'
  | 'leave:view_all'
  | 'task:create'
  | 'task:view_all'
  | 'stats:view'
  | 'config:rbac';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'leave:create': 'Tạo đơn xin nghỉ phép',
  'leave:approve_dept': 'Phê duyệt đơn ở cấp Nhóm/Tổ chuyên môn',
  'leave:approve_exec': 'Phê duyệt đơn ở cấp Ban Giám Hiệu',
  'leave:view_all': 'Xem đơn xin nghỉ toàn trường',
  'task:create': 'Phát hành & Giao việc',
  'task:view_all': 'Xem tiến độ công việc toàn trường',
  'stats:view': 'Xem báo cáo & thống kê',
  'config:rbac': 'Quản trị phân quyền hệ thống',
};

export const ROLE_CAPABILITIES: Record<PermissionKey, RoleType[]> = {
  'leave:create': ALL_ROLES,
  'leave:approve_dept': ['GROUP_LEADER', 'HEAD_OF_DEPT', 'PRINCIPAL', 'ADMIN'],
  'leave:approve_exec': ['VICE_PRINCIPAL', 'PRINCIPAL', 'ADMIN'],
  'leave:view_all': SCHOOL_LEADERSHIP_ROLES,
  'task:create': ['ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_OF_DEPT', 'GROUP_LEADER'],
  'task:view_all': ['VICE_PRINCIPAL', 'PRINCIPAL', 'SECRETARY', 'INSPECTOR', 'ADMIN'],
  'stats:view': [...SCHOOL_LEADERSHIP_ROLES, ...DEPT_LEADERSHIP_ROLES],
  'config:rbac': ['ADMIN'],
};

/**
 * The roles a user effectively acts with: the role they have switched into plus
 * every role assigned to them. Matching the most permissive of the previous
 * inline checks keeps role-switching a convenience rather than a way to
 * accidentally lock a principal out of their own dashboard.
 */
export function effectiveRoles(user: User | null, activeRole?: RoleType | null): RoleType[] {
  const roles = new Set<RoleType>(user?.roles ?? []);
  if (activeRole) roles.add(activeRole);
  return Array.from(roles);
}

export function hasAnyRole(
  user: User | null,
  activeRole: RoleType | null | undefined,
  allowed: RoleType[]
): boolean {
  return effectiveRoles(user, activeRole).some(r => allowed.includes(r));
}

/** Does this user hold the given capability? */
export function can(
  user: User | null,
  activeRole: RoleType | null | undefined,
  permission: PermissionKey
): boolean {
  return hasAnyRole(user, activeRole, ROLE_CAPABILITIES[permission]);
}

/**
 * Admin also covers the bootstrap email allow-list, which is how the very first
 * administrator gets in before any profile carries the ADMIN role.
 */
export function isAdmin(user: User | null, activeRole?: RoleType | null): boolean {
  return hasAnyRole(user, activeRole, ['ADMIN']) || isAdminEmail(user?.email);
}

export function isSchoolLeadership(user: User | null, activeRole?: RoleType | null): boolean {
  return hasAnyRole(user, activeRole, SCHOOL_LEADERSHIP_ROLES);
}

export function isDeptLeader(user: User | null, activeRole?: RoleType | null): boolean {
  return hasAnyRole(user, activeRole, DEPT_LEADERSHIP_ROLES);
}

export function canAssignTask(user: User | null, activeRole?: RoleType | null): boolean {
  return can(user, activeRole, 'task:create');
}

export function canViewStats(user: User | null, activeRole?: RoleType | null): boolean {
  return can(user, activeRole, 'stats:view');
}

export function canManageRbac(user: User | null, activeRole?: RoleType | null): boolean {
  return isAdmin(user, activeRole);
}

/**
 * Which leave requests a user is allowed to see.
 *  - school leadership: everything
 *  - department leaders: their own department, plus anything about themselves
 *  - everyone else: their own requests and the ones they must cover
 */
export function canViewLeave(
  user: User | null,
  activeRole: RoleType | null | undefined,
  leave: { departmentId: string; applicantId: string; substituteTeacherId?: string }
): boolean {
  if (!user) return false;
  if (isSchoolLeadership(user, activeRole)) return true;
  if (isDeptLeader(user, activeRole)) {
    return leave.departmentId === user.departmentId || leave.applicantId === user.id;
  }
  return leave.applicantId === user.id || leave.substituteTeacherId === user.id;
}

/**
 * Whether the acting role may sign off the approval step in front of them.
 *
 * Unlike the display helpers above this deliberately uses the ACTIVE role only:
 * approving is a formal act performed *as* a specific role, so a principal who
 * has switched to "Giáo viên" must not be able to sign as the principal.
 * Mirrors the server-side intent in `firestore.rules`.
 */
export function canApproveLeaveStep(params: {
  user: User | null;
  activeRole: RoleType;
  stepLevel: RoleType;
  leaveDepartmentId: string;
}): boolean {
  const { user, activeRole, stepLevel, leaveDepartmentId } = params;
  if (!user) return false;

  // Admins may unblock any step (used to rescue stuck workflows).
  if (activeRole === 'ADMIN' || user.roles?.includes('ADMIN')) return true;

  const isExecutiveStep = stepLevel === 'VICE_PRINCIPAL' || stepLevel === 'PRINCIPAL';
  if (isExecutiveStep) {
    return activeRole === 'PRINCIPAL' || activeRole === 'VICE_PRINCIPAL';
  }

  const isDepartmentStep = stepLevel === 'GROUP_LEADER' || stepLevel === 'HEAD_OF_DEPT';
  if (isDepartmentStep) {
    const actsAsDeptLeader = activeRole === 'GROUP_LEADER' || activeRole === 'HEAD_OF_DEPT';
    return actsAsDeptLeader && user.departmentId === leaveDepartmentId;
  }

  return false;
}
