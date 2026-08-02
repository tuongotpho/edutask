import { describe, it, expect } from 'vitest';
import { findLeaveConflict } from '@/Edu-task/lib/leaveConflict';
import { LeaveRequest, LeaveSession } from '@/Edu-task/types/leave';

/**
 * Double-booking a substitute teacher is the most damaging silent failure this
 * app can produce, so the overlap rule is pinned down here.
 */

function makeLeave(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 'LV_1',
    code: 'DXN-2026-000001',
    applicantId: 'USR_1',
    applicantName: 'Giáo viên A',
    applicantRole: 'Giáo viên',
    departmentId: 'DEPT_TOAN_TIN',
    departmentName: 'Tổ Toán - Tin',
    leaveType: 'SICK',
    startDate: '2026-03-10',
    endDate: '2026-03-12',
    totalDays: 3,
    session: 'FULL_DAY',
    reason: 'Khám bệnh',
    proofFiles: [],
    currentStepIndex: 0,
    steps: [],
    overallStatus: 'APPROVED',
    history: [],
    createdAt: '2026-03-01 08:00',
    updatedAt: '2026-03-01 08:00',
    ...overrides,
  };
}

describe('findLeaveConflict', () => {
  it('returns no conflict when the teacher has no leave at all', () => {
    expect(findLeaveConflict([], 'USR_1', '2026-03-10', '2026-03-12').hasConflict).toBe(false);
  });

  it('detects a fully overlapping range', () => {
    const result = findLeaveConflict([makeLeave()], 'USR_1', '2026-03-10', '2026-03-12');
    expect(result.hasConflict).toBe(true);
    expect(result.conflictDetail?.id).toBe('LV_1');
  });

  it('detects partial overlap at either edge', () => {
    const leaves = [makeLeave()];
    expect(findLeaveConflict(leaves, 'USR_1', '2026-03-08', '2026-03-10').hasConflict).toBe(true);
    expect(findLeaveConflict(leaves, 'USR_1', '2026-03-12', '2026-03-15').hasConflict).toBe(true);
  });

  it('treats adjacent-but-not-overlapping ranges as free', () => {
    const leaves = [makeLeave()];
    expect(findLeaveConflict(leaves, 'USR_1', '2026-03-08', '2026-03-09').hasConflict).toBe(false);
    expect(findLeaveConflict(leaves, 'USR_1', '2026-03-13', '2026-03-14').hasConflict).toBe(false);
  });

  it('ignores leave belonging to a different teacher', () => {
    expect(findLeaveConflict([makeLeave()], 'USR_2', '2026-03-10', '2026-03-12').hasConflict).toBe(false);
  });

  it.each([
    ['CANCELLED'],
    ['REJECTED'],
    ['DRAFT'],
    ['REQUEST_EDIT'],
  ] as const)('frees the slot when the existing request is %s', (status) => {
    const leaves = [makeLeave({ overallStatus: status })];
    expect(findLeaveConflict(leaves, 'USR_1', '2026-03-10', '2026-03-12').hasConflict).toBe(false);
  });

  it.each([
    ['APPROVED'],
    ['IN_REVIEW'],
  ] as const)('still blocks when the existing request is %s', (status) => {
    const leaves = [makeLeave({ overallStatus: status })];
    expect(findLeaveConflict(leaves, 'USR_1', '2026-03-10', '2026-03-12').hasConflict).toBe(true);
  });

  it('lets opposite half-days share the same date', () => {
    const leaves = [makeLeave({ session: 'MORNING' })];
    const result = findLeaveConflict(leaves, 'USR_1', '2026-03-10', '2026-03-12', 'AFTERNOON');
    expect(result.hasConflict).toBe(false);
  });

  it('blocks the same half-day on overlapping dates', () => {
    const leaves = [makeLeave({ session: 'MORNING' })];
    expect(findLeaveConflict(leaves, 'USR_1', '2026-03-10', '2026-03-12', 'MORNING').hasConflict).toBe(true);
  });

  it('lets a FULL_DAY request collide with any half-day and vice versa', () => {
    const halfDayExisting = [makeLeave({ session: 'AFTERNOON' })];
    expect(findLeaveConflict(halfDayExisting, 'USR_1', '2026-03-10', '2026-03-12', 'FULL_DAY').hasConflict).toBe(true);

    const fullDayExisting = [makeLeave({ session: 'FULL_DAY' })];
    expect(findLeaveConflict(fullDayExisting, 'USR_1', '2026-03-10', '2026-03-12', 'MORNING').hasConflict).toBe(true);
  });

  it('excludes the request currently being edited', () => {
    const leaves = [makeLeave({ id: 'LV_EDITING' })];
    const result = findLeaveConflict(leaves, 'USR_1', '2026-03-10', '2026-03-12', 'FULL_DAY', 'LV_EDITING');
    expect(result.hasConflict).toBe(false);
  });

  it('returns no conflict for incomplete input rather than throwing', () => {
    const leaves = [makeLeave()];
    expect(findLeaveConflict(leaves, '', '2026-03-10', '2026-03-12').hasConflict).toBe(false);
    expect(findLeaveConflict(leaves, 'USR_1', '', '2026-03-12').hasConflict).toBe(false);
    expect(findLeaveConflict(leaves, 'USR_1', '2026-03-10', '').hasConflict).toBe(false);
  });

  it('reports the first blocking request among several', () => {
    const leaves = [
      makeLeave({ id: 'LV_OLD', startDate: '2026-01-01', endDate: '2026-01-02' }),
      makeLeave({ id: 'LV_CLASH' }),
    ];
    const result = findLeaveConflict(leaves, 'USR_1', '2026-03-11', '2026-03-11');
    expect(result.conflictDetail?.id).toBe('LV_CLASH');
  });

  it('defaults to FULL_DAY when no session is supplied', () => {
    const leaves = [makeLeave({ session: 'MORNING' })];
    const explicit = findLeaveConflict(leaves, 'USR_1', '2026-03-10', '2026-03-12', 'FULL_DAY' as LeaveSession);
    const implicit = findLeaveConflict(leaves, 'USR_1', '2026-03-10', '2026-03-12');
    expect(implicit.hasConflict).toBe(explicit.hasConflict);
  });
});
