import { describe, it, expect } from 'vitest';
import {
  availability,
  canBorrow,
  faultyEquipment,
  isLoanOverdue,
  overdueLoans,
  reservedQuantity,
  serviceableQuantity,
  sortEquipment,
  totalOnLoan,
} from '@/Edu-task/lib/equipmentAvailability';
import { Equipment, EquipmentLoan, LoanStatus } from '@/Edu-task/types/equipment';

function item(over: Partial<Equipment> = {}): Equipment {
  return {
    id: 'E1', schoolId: 'S', name: 'Máy chiếu', code: 'MC-01',
    category: 'PROJECTOR',
    totalQuantity: 6, outOfServiceQuantity: 0,
    condition: 'GOOD', requiresApproval: false, isActive: true,
    ...over,
  };
}

function loan(over: Partial<EquipmentLoan> = {}): EquipmentLoan {
  return {
    id: 'L1', schoolId: 'S', code: 'MT-1',
    equipmentId: 'E1', equipmentName: 'Máy chiếu', quantity: 1,
    borrowerId: 'U1', borrowerName: 'GV A',
    departmentId: 'D1', departmentName: 'Tổ Toán',
    purpose: 'Dạy chuyên đề',
    borrowDate: '2026-08-01', dueDate: '2026-08-10',
    status: 'BORROWED', history: [],
    createdAt: '', updatedAt: '',
    ...over,
  };
}

describe('what counts as spoken for', () => {
  it.each([['REQUESTED'], ['BORROWED']] as [LoanStatus][])(
    'a %s loan reserves its units',
    status => {
      // A pending request holds stock too; releasing it would let a second
      // person be promised the same kit and hand the approver a clash.
      expect(reservedQuantity('E1', [loan({ status, quantity: 2 })])).toBe(2);
    }
  );

  it.each([['RETURNED'], ['REJECTED'], ['CANCELLED']] as [LoanStatus][])(
    'a %s loan releases its units',
    status => {
      expect(reservedQuantity('E1', [loan({ status, quantity: 2 })])).toBe(0);
    }
  );

  it('ignores loans for other equipment', () => {
    expect(reservedQuantity('E1', [loan({ equipmentId: 'E9', quantity: 5 })])).toBe(0);
  });

  it('excludes a loan being edited so it does not block itself', () => {
    expect(reservedQuantity('E1', [loan({ id: 'L1', quantity: 3 })], 'L1')).toBe(0);
  });
});

describe('availability arithmetic', () => {
  it('subtracts broken units and open loans from the total', () => {
    const snapshot = availability(
      item({ totalQuantity: 6, outOfServiceQuantity: 2 }),
      [loan({ id: 'a', quantity: 1 }), loan({ id: 'b', quantity: 2, status: 'REQUESTED' })]
    );
    expect(snapshot).toEqual({
      total: 6, outOfService: 2, serviceable: 4, reserved: 3, available: 1,
    });
  });

  it('never reports a negative figure', () => {
    // Stock reduced after kit went out, or historical over-lending: the answer
    // is "hết", not a negative that poisons every comparison downstream.
    const snapshot = availability(item({ totalQuantity: 1 }), [loan({ quantity: 5 })]);
    expect(snapshot.available).toBe(0);
  });

  it('treats a missing outOfService field as zero', () => {
    const legacy = { ...item(), outOfServiceQuantity: undefined } as unknown as Equipment;
    expect(serviceableQuantity(legacy)).toBe(6);
  });
});

describe('canBorrow', () => {
  it('allows a request within what is free', () => {
    expect(canBorrow(item(), [loan({ quantity: 2 })], 3)).toEqual({ ok: true });
  });

  it('refuses more than is free and says how many are left', () => {
    const result = canBorrow(item({ totalQuantity: 3 }), [loan({ quantity: 2 })], 2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('1');
      expect(result.reason).toContain('3');
    }
  });

  it('refuses equipment that is broken', () => {
    const result = canBorrow(item({ condition: 'BROKEN' }), [], 1);
    expect(result.ok).toBe(false);
  });

  it('refuses equipment withdrawn from the catalog', () => {
    expect(canBorrow(item({ isActive: false }), [], 1).ok).toBe(false);
  });

  it('refuses when every unit is out of service', () => {
    const result = canBorrow(item({ totalQuantity: 2, outOfServiceQuantity: 2 }), [], 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('không có cái nào');
  });

  it('refuses a nonsensical quantity', () => {
    expect(canBorrow(item(), [], 0).ok).toBe(false);
    expect(canBorrow(item(), [], -1).ok).toBe(false);
    expect(canBorrow(item(), [], 1.5).ok).toBe(false);
  });

  it('lets an existing loan be re-approved without blocking on itself', () => {
    // Approving a pending request must not count that request against itself.
    const existing = loan({ id: 'L1', quantity: 6, status: 'REQUESTED' });
    expect(canBorrow(item({ totalQuantity: 6 }), [existing], 6, 'L1')).toEqual({ ok: true });
  });
});

describe('overdue loans', () => {
  it('flags kit still out past its due date', () => {
    expect(isLoanOverdue(loan({ dueDate: '2026-08-05' }), '2026-08-10')).toBe(true);
  });

  it('does not flag one due today', () => {
    expect(isLoanOverdue(loan({ dueDate: '2026-08-10' }), '2026-08-10')).toBe(false);
  });

  it('does not flag kit already returned', () => {
    expect(isLoanOverdue(loan({ dueDate: '2026-08-01', status: 'RETURNED' }), '2026-08-10')).toBe(false);
  });

  it('does not flag a request that was never handed out', () => {
    expect(isLoanOverdue(loan({ dueDate: '2026-08-01', status: 'REQUESTED' }), '2026-08-10')).toBe(false);
  });

  it('lists the longest overdue first', () => {
    const list = overdueLoans(
      [loan({ id: 'a', dueDate: '2026-08-05' }), loan({ id: 'b', dueDate: '2026-08-01' })],
      '2026-08-10'
    );
    expect(list.map(l => l.id)).toEqual(['b', 'a']);
  });
});

describe('totals', () => {
  it('counts units out, not loan rows', () => {
    expect(totalOnLoan([loan({ id: 'a', quantity: 3 }), loan({ id: 'b', quantity: 2 })])).toBe(5);
  });

  it('excludes pending requests from what is physically out', () => {
    // A request is reserved but nobody is holding it yet.
    expect(totalOnLoan([loan({ status: 'REQUESTED', quantity: 4 })])).toBe(0);
  });
});

describe('faultyEquipment', () => {
  it('picks up broken items, items needing repair, and any with units withdrawn', () => {
    const list = faultyEquipment([
      item({ id: 'ok' }),
      item({ id: 'broken', condition: 'BROKEN' }),
      item({ id: 'repair', condition: 'NEEDS_REPAIR' }),
      item({ id: 'partial', outOfServiceQuantity: 1 }),
    ]);
    expect(list.map(e => e.id).sort()).toEqual(['broken', 'partial', 'repair']);
  });
});

describe('sortEquipment', () => {
  it('puts retired items last', () => {
    const sorted = sortEquipment([
      item({ id: 'gone', name: 'A', isActive: false }),
      item({ id: 'live', name: 'B' }),
    ]);
    expect(sorted.map(e => e.id)).toEqual(['live', 'gone']);
  });
});
