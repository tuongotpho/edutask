import { describe, it, expect } from 'vitest';
import {
  aggregateProgress,
  openMilestones,
  planProgress,
  visiblePlans,
} from '@/Edu-task/lib/planProgress';
import { MilestoneStatus, Plan, PlanMilestone } from '@/Edu-task/types/plan';

function milestone(id: string, status: MilestoneStatus, dueDate = '2026-09-30'): PlanMilestone {
  return { id, title: `Mốc ${id}`, dueDate, status };
}

function plan(over: Partial<Plan> = {}): Plan {
  return {
    id: 'P1', schoolId: 'S', code: 'KH-2026-001',
    title: 'Kế hoạch', scope: 'SCHOOL',
    startDate: '2026-09-01', endDate: '2027-05-31',
    milestones: [],
    ownerId: 'OWNER', ownerName: 'Hiệu trưởng',
    isArchived: false,
    createdAt: '2026-08-01 08:00', updatedAt: '2026-08-01 08:00',
    ...over,
  };
}

describe('planProgress', () => {
  it('counts milestones delivered, not days elapsed', () => {
    const p = plan({
      milestones: [
        milestone('a', 'DONE'),
        milestone('b', 'DONE'),
        milestone('c', 'IN_PROGRESS'),
        milestone('d', 'PENDING'),
      ],
    });
    const progress = planProgress(p, '2026-08-08');
    expect(progress.total).toBe(4);
    expect(progress.done).toBe(2);
    expect(progress.inProgress).toBe(1);
    expect(progress.percent).toBe(50);
  });

  it('reports an empty plan as unmeasured rather than complete', () => {
    // Returning 100% here would let a plan with nothing in it look finished —
    // the most misleading number a dashboard could carry.
    expect(planProgress(plan(), '2026-08-08').percent).toBeNull();
  });

  it('counts overdue milestones that are not done', () => {
    const p = plan({
      milestones: [
        milestone('a', 'PENDING', '2026-08-01'),
        milestone('b', 'DONE', '2026-08-01'),
        milestone('c', 'PENDING', '2026-12-01'),
      ],
    });
    expect(planProgress(p, '2026-08-08').overdue).toBe(1);
  });

  it('survives a plan with no milestones array at all', () => {
    const broken = { ...plan(), milestones: undefined } as unknown as Plan;
    expect(planProgress(broken, '2026-08-08').percent).toBeNull();
  });
});

describe('aggregateProgress', () => {
  it('weights by milestone count, not by plan', () => {
    // Averaging percentages would let a 2-milestone plan swing the school
    // figure as hard as a 50-milestone one.
    const small = plan({ id: 'small', milestones: [milestone('a', 'DONE'), milestone('b', 'DONE')] });
    const large = plan({
      id: 'large',
      milestones: Array.from({ length: 8 }, (_, i) => milestone(`l${i}`, 'PENDING')),
    });
    // Naive average would be (100 + 0) / 2 = 50; weighted is 2/10 = 20.
    expect(aggregateProgress([small, large], '2026-08-08').percent).toBe(20);
  });

  it('excludes archived plans', () => {
    const active = plan({ id: 'a', milestones: [milestone('m', 'DONE')] });
    const archived = plan({
      id: 'b', isArchived: true,
      milestones: Array.from({ length: 9 }, (_, i) => milestone(`x${i}`, 'PENDING')),
    });
    expect(aggregateProgress([active, archived], '2026-08-08').percent).toBe(100);
  });

  it('is unmeasured when there is nothing to measure', () => {
    expect(aggregateProgress([], '2026-08-08').percent).toBeNull();
    expect(aggregateProgress([plan()], '2026-08-08').percent).toBeNull();
  });
});

describe('openMilestones', () => {
  it('lists what is left, soonest first', () => {
    const p = plan({
      milestones: [
        milestone('late', 'PENDING', '2026-12-01'),
        milestone('done', 'DONE', '2026-09-01'),
        milestone('soon', 'IN_PROGRESS', '2026-09-15'),
      ],
    });
    expect(openMilestones(p).map(m => m.id)).toEqual(['soon', 'late']);
  });
});

describe('visiblePlans', () => {
  const schoolPlan = plan({ id: 'school', scope: 'SCHOOL' });
  const toanPlan = plan({ id: 'toan', scope: 'DEPARTMENT', departmentId: 'D_TOAN' });
  const hoaPlan = plan({ id: 'hoa', scope: 'DEPARTMENT', departmentId: 'D_HOA' });
  const all = [schoolPlan, toanPlan, hoaPlan];

  it('shows leadership everything', () => {
    expect(visiblePlans(all, { seesEverything: true }).map(p => p.id))
      .toEqual(['school', 'toan', 'hoa']);
  });

  it('shows a teacher the school plan and their own department’s', () => {
    expect(visiblePlans(all, { departmentId: 'D_TOAN', seesEverything: false }).map(p => p.id))
      .toEqual(['school', 'toan']);
  });

  it('hides another department’s plan', () => {
    const visible = visiblePlans(all, { departmentId: 'D_TOAN', seesEverything: false });
    expect(visible.some(p => p.id === 'hoa')).toBe(false);
  });
});
