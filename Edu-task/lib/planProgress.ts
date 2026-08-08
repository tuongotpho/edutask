import { Plan, PlanMilestone } from '@/Edu-task/types/plan';

/**
 * Turning a plan's milestones into the "tiến độ 76%" figure.
 *
 * Progress is counted in milestones completed, not in days elapsed. A plan that
 * is two thirds through the school year with nothing delivered is at 0%, and
 * saying otherwise would be the single most misleading number on a principal's
 * dashboard.
 */

export interface PlanProgress {
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  /** 0–100, or null when the plan has no milestones to measure. */
  percent: number | null;
}

export function planProgress(plan: Plan, today: string): PlanProgress {
  const milestones = plan.milestones ?? [];
  const done = milestones.filter(m => m.status === 'DONE').length;
  const inProgress = milestones.filter(m => m.status === 'IN_PROGRESS').length;
  const overdue = milestones.filter(m => m.status !== 'DONE' && (m.dueDate ?? '') < today).length;

  return {
    total: milestones.length,
    done,
    inProgress,
    overdue,
    // A plan with no milestones is unmeasured, not complete. Returning 100
    // here would let an empty plan report perfect progress.
    percent: milestones.length === 0 ? null : Math.round((done / milestones.length) * 100),
  };
}

/**
 * Combined progress across several plans, weighted by milestone count.
 *
 * Averaging the percentages instead would let a plan with two milestones swing
 * the school figure as hard as one with fifty.
 */
export function aggregateProgress(plans: Plan[], today: string): PlanProgress {
  const active = plans.filter(p => !p.isArchived);
  const totals = active.reduce(
    (acc, plan) => {
      const progress = planProgress(plan, today);
      return {
        total: acc.total + progress.total,
        done: acc.done + progress.done,
        inProgress: acc.inProgress + progress.inProgress,
        overdue: acc.overdue + progress.overdue,
      };
    },
    { total: 0, done: 0, inProgress: 0, overdue: 0 }
  );

  return {
    ...totals,
    percent: totals.total === 0 ? null : Math.round((totals.done / totals.total) * 100),
  };
}

/** Milestones still open, soonest first — the plan's working list. */
export function openMilestones(plan: Plan): PlanMilestone[] {
  return (plan.milestones ?? [])
    .filter(m => m.status !== 'DONE')
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
}

/** Plans a user is entitled to see: school-wide ones, plus their department's. */
export function visiblePlans(
  plans: Plan[],
  params: { departmentId?: string; seesEverything: boolean }
): Plan[] {
  if (params.seesEverything) return plans;
  return plans.filter(p => p.scope === 'SCHOOL' || p.departmentId === params.departmentId);
}
