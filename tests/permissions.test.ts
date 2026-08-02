import { describe, it, expect } from 'vitest';
import {
  ROLE_CAPABILITIES,
  canApproveLeaveStep,
  canAssignTask,
  canViewLeave,
  canViewStats,
  effectiveRoles,
  isAdmin,
  isDeptLeader,
  isSchoolLeadership,
} from '@/Edu-task/lib/permissions';
import { User, RoleType } from '@/Edu-task/types/user';

function makeUser(roles: RoleType[], overrides: Partial<User> = {}): User {
  return {
    id: 'USR_1',
    fullName: 'Nguyễn Văn A',
    email: 'a@truong.edu.vn',
    departmentId: 'DEPT_TOAN_TIN',
    departmentName: 'Tổ Toán - Tin',
    roles,
    activeRole: roles[0],
    isTeachingStaff: true,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('effectiveRoles', () => {
  it('combines assigned roles with the active one', () => {
    const user = makeUser(['TEACHER', 'GROUP_LEADER']);
    expect(effectiveRoles(user, 'GROUP_LEADER').sort()).toEqual(['GROUP_LEADER', 'TEACHER']);
  });

  it('does not duplicate a role already assigned', () => {
    expect(effectiveRoles(makeUser(['TEACHER']), 'TEACHER')).toEqual(['TEACHER']);
  });

  it('handles a missing user', () => {
    expect(effectiveRoles(null, 'TEACHER')).toEqual(['TEACHER']);
    expect(effectiveRoles(null, null)).toEqual([]);
  });
});

describe('role predicates', () => {
  it('recognises school leadership but not a plain teacher', () => {
    expect(isSchoolLeadership(makeUser(['PRINCIPAL']), 'PRINCIPAL')).toBe(true);
    expect(isSchoolLeadership(makeUser(['SECRETARY']), 'SECRETARY')).toBe(true);
    expect(isSchoolLeadership(makeUser(['TEACHER']), 'TEACHER')).toBe(false);
  });

  it('recognises department leaders', () => {
    expect(isDeptLeader(makeUser(['HEAD_OF_DEPT']), 'HEAD_OF_DEPT')).toBe(true);
    expect(isDeptLeader(makeUser(['GROUP_LEADER']), 'GROUP_LEADER')).toBe(true);
    expect(isDeptLeader(makeUser(['TEACHER']), 'TEACHER')).toBe(false);
  });

  it('treats the bootstrap admin email as an admin regardless of roles', () => {
    const seeded = makeUser(['TEACHER'], { email: 'admin@gmail.com' });
    expect(isAdmin(seeded, 'TEACHER')).toBe(true);
    expect(isAdmin(makeUser(['TEACHER']), 'TEACHER')).toBe(false);
  });
});

describe('canAssignTask — the check that had drifted across three components', () => {
  it.each([
    ['ADMIN'],
    ['PRINCIPAL'],
    ['VICE_PRINCIPAL'],
    ['HEAD_OF_DEPT'],
    ['GROUP_LEADER'],
  ] as [RoleType][])('allows %s', (role) => {
    expect(canAssignTask(makeUser([role]), role)).toBe(true);
  });

  it.each([
    ['TEACHER'],
    ['ACCOUNTANT'],
    ['TRADE_UNION'],
    ['SECRETARY'],
    ['INSPECTOR'],
  ] as [RoleType][])('denies %s', (role) => {
    expect(canAssignTask(makeUser([role]), role)).toBe(false);
  });

  it('keeps the capability while a multi-role user is acting as a teacher', () => {
    const principal = makeUser(['PRINCIPAL', 'TEACHER']);
    expect(canAssignTask(principal, 'TEACHER')).toBe(true);
  });
});

describe('canViewStats', () => {
  it('covers both school leadership and department leaders', () => {
    expect(canViewStats(makeUser(['INSPECTOR']), 'INSPECTOR')).toBe(true);
    expect(canViewStats(makeUser(['GROUP_LEADER']), 'GROUP_LEADER')).toBe(true);
  });

  it('excludes plain teachers and accountants', () => {
    expect(canViewStats(makeUser(['TEACHER']), 'TEACHER')).toBe(false);
    expect(canViewStats(makeUser(['ACCOUNTANT']), 'ACCOUNTANT')).toBe(false);
  });
});

describe('canViewLeave', () => {
  const leave = {
    departmentId: 'DEPT_TOAN_TIN',
    applicantId: 'USR_OTHER',
    substituteTeacherId: 'USR_SUB',
  };

  it('lets school leadership see everything', () => {
    expect(canViewLeave(makeUser(['PRINCIPAL']), 'PRINCIPAL', leave)).toBe(true);
  });

  it('lets a department leader see their own department', () => {
    const leader = makeUser(['HEAD_OF_DEPT'], { departmentId: 'DEPT_TOAN_TIN' });
    expect(canViewLeave(leader, 'HEAD_OF_DEPT', leave)).toBe(true);
  });

  it('hides another department from a department leader', () => {
    const leader = makeUser(['HEAD_OF_DEPT'], { departmentId: 'DEPT_ANH' });
    expect(canViewLeave(leader, 'HEAD_OF_DEPT', leave)).toBe(false);
  });

  it('lets a teacher see their own request and one they must cover', () => {
    const applicant = makeUser(['TEACHER'], { id: 'USR_OTHER' });
    expect(canViewLeave(applicant, 'TEACHER', leave)).toBe(true);

    const substitute = makeUser(['TEACHER'], { id: 'USR_SUB' });
    expect(canViewLeave(substitute, 'TEACHER', leave)).toBe(true);
  });

  it('hides an unrelated request from a teacher', () => {
    const bystander = makeUser(['TEACHER'], { id: 'USR_NOBODY' });
    expect(canViewLeave(bystander, 'TEACHER', leave)).toBe(false);
  });

  it('denies when there is no user', () => {
    expect(canViewLeave(null, 'TEACHER', leave)).toBe(false);
  });
});

describe('canApproveLeaveStep — uses the ACTIVE role, not every assigned role', () => {
  const deptId = 'DEPT_TOAN_TIN';

  it('lets the department leader sign off the department step', () => {
    const leader = makeUser(['HEAD_OF_DEPT'], { departmentId: deptId });
    expect(canApproveLeaveStep({
      user: leader, activeRole: 'HEAD_OF_DEPT', stepLevel: 'GROUP_LEADER', leaveDepartmentId: deptId,
    })).toBe(true);
  });

  it('blocks a department leader from another department', () => {
    const leader = makeUser(['HEAD_OF_DEPT'], { departmentId: 'DEPT_ANH' });
    expect(canApproveLeaveStep({
      user: leader, activeRole: 'HEAD_OF_DEPT', stepLevel: 'GROUP_LEADER', leaveDepartmentId: deptId,
    })).toBe(false);
  });

  it('blocks a department leader at the executive step', () => {
    const leader = makeUser(['HEAD_OF_DEPT'], { departmentId: deptId });
    expect(canApproveLeaveStep({
      user: leader, activeRole: 'HEAD_OF_DEPT', stepLevel: 'VICE_PRINCIPAL', leaveDepartmentId: deptId,
    })).toBe(false);
  });

  it('lets the executive step be signed by a principal or vice principal', () => {
    for (const role of ['PRINCIPAL', 'VICE_PRINCIPAL'] as RoleType[]) {
      expect(canApproveLeaveStep({
        user: makeUser([role]), activeRole: role, stepLevel: 'VICE_PRINCIPAL', leaveDepartmentId: deptId,
      })).toBe(true);
    }
  });

  it('lets an admin unblock any step', () => {
    const admin = makeUser(['ADMIN'], { departmentId: 'DEPT_BGH' });
    expect(canApproveLeaveStep({
      user: admin, activeRole: 'ADMIN', stepLevel: 'GROUP_LEADER', leaveDepartmentId: deptId,
    })).toBe(true);
  });

  it('refuses a principal who has switched into the teacher role', () => {
    // Approving is a formal act performed *as* a role: someone acting as a
    // teacher must not be able to sign as the principal.
    const principal = makeUser(['PRINCIPAL', 'TEACHER'], { departmentId: deptId });
    expect(canApproveLeaveStep({
      user: principal, activeRole: 'TEACHER', stepLevel: 'VICE_PRINCIPAL', leaveDepartmentId: deptId,
    })).toBe(false);
  });

  it('refuses a plain teacher outright', () => {
    const teacher = makeUser(['TEACHER'], { departmentId: deptId });
    expect(canApproveLeaveStep({
      user: teacher, activeRole: 'TEACHER', stepLevel: 'GROUP_LEADER', leaveDepartmentId: deptId,
    })).toBe(false);
  });

  it('denies when there is no user', () => {
    expect(canApproveLeaveStep({
      user: null, activeRole: 'ADMIN', stepLevel: 'GROUP_LEADER', leaveDepartmentId: deptId,
    })).toBe(false);
  });
});

describe('capability table', () => {
  it('reserves RBAC administration for admins only', () => {
    expect(ROLE_CAPABILITIES['config:rbac']).toEqual(['ADMIN']);
  });

  it('lets every role file their own leave request', () => {
    expect(ROLE_CAPABILITIES['leave:create']).toContain('TEACHER');
    expect(ROLE_CAPABILITIES['leave:create']).toContain('ACCOUNTANT');
  });
});
