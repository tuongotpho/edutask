import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A department is referenced by id from users, leaves and tasks, and its name is
 * copied onto all three. Both directions of that duplication have bitten:
 * renaming used to miss the copies on tasks (`targetDepartmentName` and each
 * `assignees[].departmentName`), and deleting used to leave department-wide
 * tasks pointing at an id that no longer exists. These tests pin both down.
 */

const savedTasks: unknown[] = [];
const savedUsers: unknown[] = [];

vi.mock('@/Edu-task/lib/storage', () => ({
  storage: {
    saveDepartments: vi.fn(),
    saveUsers: vi.fn(),
    saveLeaves: vi.fn(),
    saveTasks: vi.fn(),
  },
}));

vi.mock('@/Edu-task/services/firebaseService', () => ({
  firebaseService: {
    saveDepartment: vi.fn(async () => {}),
    saveUser: vi.fn(async (u: unknown) => { savedUsers.push(u); }),
    saveLeave: vi.fn(async () => {}),
    saveTask: vi.fn(async (t: unknown) => { savedTasks.push(t); }),
    deleteDepartment: vi.fn(async () => {}),
  },
}));

import { useDepartmentLogic } from '@/Edu-task/context/hooks/useDepartmentLogic';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { Department, User } from '@/Edu-task/types/user';
import { LeaveRequest } from '@/Edu-task/types/leave';
import { Task, TaskAssigneeProgress } from '@/Edu-task/types/task';

const OLD_NAME = 'Tổ Toán - Tin';
const NEW_NAME = 'Tổ Toán - Tin học';

function makeUser(id: string, departmentId: string): User {
  return {
    id,
    fullName: `Giáo viên ${id}`,
    email: `${id}@school.vn`,
    departmentId,
    departmentName: departmentId === 'DEPT_TOAN' ? OLD_NAME : 'Tổ Hoá - Sinh',
    roles: ['TEACHER'],
    activeRole: 'TEACHER',
    isTeachingStaff: true,
    status: 'ACTIVE',
  };
}

function makeAssignee(userId: string, departmentName: string): TaskAssigneeProgress {
  return { userId, userName: `Giáo viên ${userId}`, departmentName, status: 'ASSIGNED' };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK_1',
    code: 'CV-2026-001',
    title: 'Nộp kế hoạch giảng dạy',
    description: '',
    assignerId: 'USR_BGH',
    assignerName: 'Hiệu trưởng',
    assignerRole: 'PRINCIPAL',
    assigneeType: 'INDIVIDUAL',
    assignees: [],
    attachments: [],
    deadline: '2026-09-01 17:00',
    startDate: '2026-08-01',
    priority: 'NORMAL',
    status: 'ASSIGNED',
    viewerIds: [],
    extensionRequests: [],
    activities: [],
    createdAt: '2026-08-01 08:00',
    updatedAt: '2026-08-01 08:00',
    ...overrides,
  };
}

/**
 * The hook holds no React state of its own — it only closes over the props — so
 * it can be driven directly with plain arrays and recording setters.
 */
function setup(tasks: Task[], users: User[] = [makeUser('USR_1', 'DEPT_TOAN'), makeUser('USR_2', 'DEPT_HOA')]) {
  const departments: Department[] = [
    { id: 'DEPT_TOAN', name: OLD_NAME, code: 'TOAN-TIN' },
    { id: 'DEPT_HOA', name: 'Tổ Hoá - Sinh', code: 'HOA-SINH' },
  ];
  const leaves: LeaveRequest[] = [];

  const state = { departments, users, leaves, tasks };
  const notify = vi.fn();

  // Despite the name, `useDepartmentLogic` calls no React hooks — it is a plain
  // factory that closes over the state setters it is handed, and the `use`
  // prefix only follows the project's naming convention for domain logic. So it
  // is safe to call outside a component, which is what makes these tests
  // possible without a renderer.
  // eslint-disable-next-line react-hooks/rules-of-hooks -- see above
  const logic = useDepartmentLogic({
    schoolName: 'THPT A',
    setSchoolName: vi.fn(),
    departments,
    setDepartments: (v: unknown) => { state.departments = v as Department[]; },
    users,
    setUsers: (v: unknown) => { state.users = v as User[]; },
    leaves,
    setLeaves: (v: unknown) => { state.leaves = v as LeaveRequest[]; },
    tasks,
    setTasks: (v: unknown) => { state.tasks = v as Task[]; },
    notify,
  } as unknown as Parameters<typeof useDepartmentLogic>[0]);

  return { logic, state, notify };
}

describe('updateDepartment — cascading the renamed department onto tasks', () => {
  beforeEach(() => {
    savedTasks.length = 0;
    savedUsers.length = 0;
    vi.mocked(firebaseService.saveTask).mockClear();
    vi.mocked(firebaseService.saveDepartment).mockClear();
  });

  it('rewrites departmentName on assignees who belong to the renamed department', async () => {
    const task = makeTask({ assignees: [makeAssignee('USR_1', OLD_NAME), makeAssignee('USR_2', 'Tổ Hoá - Sinh')] });
    const { logic, state } = setup([task]);

    const ok = await logic.updateDepartment('DEPT_TOAN', { name: NEW_NAME, code: 'TOAN-TIN' });

    expect(ok).toBe(true);
    expect(state.tasks[0].assignees[0].departmentName).toBe(NEW_NAME);
    // An assignee from another department must be left alone.
    expect(state.tasks[0].assignees[1].departmentName).toBe('Tổ Hoá - Sinh');
  });

  it('rewrites targetDepartmentName on department-wide tasks', async () => {
    const task = makeTask({
      assigneeType: 'DEPARTMENT',
      targetDepartmentId: 'DEPT_TOAN',
      targetDepartmentName: OLD_NAME,
      assignees: [makeAssignee('USR_1', OLD_NAME)],
    });
    const { logic, state } = setup([task]);

    await logic.updateDepartment('DEPT_TOAN', { name: NEW_NAME, code: 'TOAN-TIN' });

    expect(state.tasks[0].targetDepartmentName).toBe(NEW_NAME);
  });

  it('pushes only the tasks that actually changed to Firestore', async () => {
    const touched = makeTask({ id: 'TASK_1', assignees: [makeAssignee('USR_1', OLD_NAME)] });
    const untouched = makeTask({ id: 'TASK_2', assignees: [makeAssignee('USR_2', 'Tổ Hoá - Sinh')] });
    const { logic, state } = setup([touched, untouched]);

    await logic.updateDepartment('DEPT_TOAN', { name: NEW_NAME, code: 'TOAN-TIN' });

    expect(firebaseService.saveTask).toHaveBeenCalledTimes(1);
    expect((savedTasks[0] as Task).id).toBe('TASK_1');
    // Unaffected tasks keep their identity, so React skips re-rendering them.
    expect(state.tasks[1]).toBe(untouched);
  });

  it('rolls tasks back when the Firestore write fails', async () => {
    const task = makeTask({ assignees: [makeAssignee('USR_1', OLD_NAME)] });
    const { logic, state, notify } = setup([task]);
    vi.mocked(firebaseService.saveTask).mockRejectedValueOnce(new Error('offline'));

    const ok = await logic.updateDepartment('DEPT_TOAN', { name: NEW_NAME, code: 'TOAN-TIN' });

    expect(ok).toBe(false);
    expect(state.tasks[0].assignees[0].departmentName).toBe(OLD_NAME);
    expect(state.departments.find(d => d.id === 'DEPT_TOAN')?.name).toBe(OLD_NAME);
    expect(notify).toHaveBeenCalled();
  });

  it('still rewrites users and leaves alongside tasks', async () => {
    const { logic, state } = setup([]);

    await logic.updateDepartment('DEPT_TOAN', { name: NEW_NAME, code: 'TOAN-TIN' });

    expect(state.users.find(u => u.id === 'USR_1')?.departmentName).toBe(NEW_NAME);
    expect(state.users.find(u => u.id === 'USR_2')?.departmentName).toBe('Tổ Hoá - Sinh');
    expect(savedUsers).toHaveLength(1);
  });
});

describe('deleteDepartment — refusing to orphan records', () => {
  beforeEach(() => {
    vi.mocked(firebaseService.deleteDepartment).mockClear();
  });

  it('refuses while a department-wide task still targets it', async () => {
    const task = makeTask({
      assigneeType: 'DEPARTMENT',
      targetDepartmentId: 'DEPT_TOAN',
      targetDepartmentName: OLD_NAME,
      // The last member has already been removed, so the member guard passes
      // and only the task reference is left dangling.
      assignees: [],
    });
    const { logic, state, notify } = setup([task], []);

    const ok = await logic.deleteDepartment('DEPT_TOAN');

    expect(ok).toBe(false);
    expect(notify).toHaveBeenCalledWith('error', expect.stringContaining('1 nhiệm vụ'));
    expect(firebaseService.deleteDepartment).not.toHaveBeenCalled();
    expect(state.departments.map(d => d.id)).toContain('DEPT_TOAN');
  });

  it('ignores tasks that target a different department', async () => {
    const task = makeTask({
      assigneeType: 'DEPARTMENT',
      targetDepartmentId: 'DEPT_HOA',
      targetDepartmentName: 'Tổ Hoá - Sinh',
    });
    const { logic, state } = setup([task], []);

    const ok = await logic.deleteDepartment('DEPT_TOAN');

    expect(ok).toBe(true);
    expect(state.departments.map(d => d.id)).toEqual(['DEPT_HOA']);
  });

  it('still deletes a department nothing points at', async () => {
    const { logic, state } = setup([], []);

    const ok = await logic.deleteDepartment('DEPT_TOAN');

    expect(ok).toBe(true);
    expect(firebaseService.deleteDepartment).toHaveBeenCalledWith('DEPT_TOAN');
    expect(state.departments.map(d => d.id)).toEqual(['DEPT_HOA']);
  });
});
