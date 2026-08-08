/**
 * Kế hoạch & mốc tiến độ.
 *
 * A plan is a named body of work with dated milestones — the school's kế hoạch
 * năm học, a tổ's kế hoạch chuyên môn. It exists for two reasons: it is what
 * "tiến độ kế hoạch đạt 76%" is actually measured from, and it is what the
 * reminder schedules point at.
 *
 * Milestones are stored on the plan rather than as their own collection. They
 * are only ever read together with their plan, never queried across plans, and
 * a school has tens of plans with tens of milestones — well inside a document.
 */

export type PlanScope = 'SCHOOL' | 'DEPARTMENT';

export const PLAN_SCOPE_LABELS: Record<PlanScope, string> = {
  SCHOOL: 'Kế hoạch nhà trường',
  DEPARTMENT: 'Kế hoạch tổ chuyên môn',
};

export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Chưa bắt đầu', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
  IN_PROGRESS: { label: 'Đang thực hiện', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
  DONE: { label: 'Hoàn thành', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
};

export interface PlanMilestone {
  id: string;
  title: string;
  /** `YYYY-MM-DD` */
  dueDate: string;
  status: MilestoneStatus;
  /** Who owns this milestone; blank means the plan owner. */
  ownerId?: string;
  ownerName?: string;
  note?: string;
  completedAt?: string;
}

export interface Plan {
  id: string;
  schoolId: string;
  code: string;

  title: string;
  description?: string;
  scope: PlanScope;
  /** Set when `scope` is DEPARTMENT. */
  departmentId?: string;
  departmentName?: string;

  /** The period the plan covers, e.g. a school year or a term. */
  startDate: string;
  endDate: string;

  milestones: PlanMilestone[];

  ownerId: string;
  ownerName: string;
  isArchived: boolean;

  createdAt: string;
  updatedAt: string;
}
