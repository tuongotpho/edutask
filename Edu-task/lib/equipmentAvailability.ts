import {
  Equipment,
  EquipmentLoan,
  LOAN_OPEN_STATUSES,
} from '@/Edu-task/types/equipment';

/**
 * How much kit is actually free, and what is late coming back.
 *
 * Availability is computed from open loans every time rather than kept as a
 * stored counter. A counter has to be decremented on borrow and incremented on
 * return; miss one of those — a failed write, a loan deleted by hand, a
 * half-finished migration — and the register is permanently wrong with nothing
 * to reconcile against. Recomputing costs a filter over a few hundred rows and
 * can never drift.
 */

/** Units of this item currently spoken for, including pending requests. */
export function reservedQuantity(
  equipmentId: string,
  loans: EquipmentLoan[],
  excludeLoanId?: string
): number {
  return loans
    .filter(
      loan =>
        loan.equipmentId === equipmentId &&
        loan.id !== excludeLoanId &&
        LOAN_OPEN_STATUSES.includes(loan.status)
    )
    .reduce((sum, loan) => sum + (loan.quantity ?? 0), 0);
}

/** Units that can be lent at all — the broken ones never can. */
export function serviceableQuantity(equipment: Equipment): number {
  return Math.max(0, (equipment.totalQuantity ?? 0) - (equipment.outOfServiceQuantity ?? 0));
}

export interface AvailabilitySnapshot {
  total: number;
  outOfService: number;
  serviceable: number;
  reserved: number;
  available: number;
}

export function availability(
  equipment: Equipment,
  loans: EquipmentLoan[],
  excludeLoanId?: string
): AvailabilitySnapshot {
  const serviceable = serviceableQuantity(equipment);
  const reserved = reservedQuantity(equipment.id, loans, excludeLoanId);
  return {
    total: equipment.totalQuantity ?? 0,
    outOfService: equipment.outOfServiceQuantity ?? 0,
    serviceable,
    reserved,
    // Never negative: over-lending in the past (or a stock count reduced after
    // the fact) must read as "hết", not as a negative that breaks the maths.
    available: Math.max(0, serviceable - reserved),
  };
}

/** Whether this many units can be taken out, and why not if they cannot. */
export function canBorrow(
  equipment: Equipment,
  loans: EquipmentLoan[],
  quantity: number,
  excludeLoanId?: string
): { ok: true } | { ok: false; reason: string } {
  if (!equipment.isActive) {
    return { ok: false, reason: `${equipment.name} đã ngừng sử dụng.` };
  }
  if (equipment.condition === 'BROKEN') {
    return { ok: false, reason: `${equipment.name} đang hỏng, chưa cho mượn được.` };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, reason: 'Số lượng mượn phải là số nguyên từ 1 trở lên.' };
  }

  const snapshot = availability(equipment, loans, excludeLoanId);
  if (snapshot.serviceable === 0) {
    return { ok: false, reason: `${equipment.name} hiện không có cái nào dùng được.` };
  }
  if (quantity > snapshot.available) {
    return {
      ok: false,
      reason: `Chỉ còn ${snapshot.available}/${snapshot.serviceable} ${equipment.name} rảnh (đang có ${snapshot.reserved} cái được mượn hoặc chờ duyệt).`,
    };
  }
  return { ok: true };
}

/**
 * A loan is overdue once its due date has passed and the kit is still out.
 *
 * Derived, never stored — the same decision as `isTaskOverdue`, and for the
 * same reason: a stored flag needs something to flip it, and nothing would.
 */
export function isLoanOverdue(loan: EquipmentLoan, today: string): boolean {
  if (loan.status !== 'BORROWED') return false;
  return (loan.dueDate ?? '') < today;
}

export function overdueLoans(loans: EquipmentLoan[], today: string): EquipmentLoan[] {
  return loans
    .filter(loan => isLoanOverdue(loan, today))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
}

/** Total units out on loan right now, across all equipment. */
export function totalOnLoan(loans: EquipmentLoan[]): number {
  return loans
    .filter(loan => loan.status === 'BORROWED')
    .reduce((sum, loan) => sum + (loan.quantity ?? 0), 0);
}

/** Items needing attention: broken, or with units withdrawn from service. */
export function faultyEquipment(equipment: Equipment[]): Equipment[] {
  return equipment.filter(
    item => item.condition === 'BROKEN' || item.condition === 'NEEDS_REPAIR' || (item.outOfServiceQuantity ?? 0) > 0
  );
}

/** Catalog order: usable first, then by category and name. */
export function sortEquipment(items: Equipment[]): Equipment[] {
  return [...items].sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name, 'vi')
  );
}
