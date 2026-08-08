import { HistoryLog } from './approval';

/**
 * Mượn thiết bị — the equipment register.
 *
 * The shape that matters here is QUANTITY. A room is booked whole: one booking
 * takes the room. Equipment is not — a school owns six projectors, three can be
 * out at once, and the question people actually ask is "còn cái nào rảnh
 * không?". So availability is arithmetic over open loans, not a yes/no flag,
 * and it is computed rather than stored: a stored counter drifts the moment one
 * write fails, and a register nobody trusts sends people back to the paper book.
 */

export type EquipmentCategory =
  | 'PROJECTOR'
  | 'LAPTOP'
  | 'AUDIO'
  | 'CAMERA'
  | 'LAB'
  | 'SPORTS'
  | 'FURNITURE'
  | 'OTHER';

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  PROJECTOR: 'Máy chiếu / màn chiếu',
  LAPTOP: 'Máy tính xách tay / máy tính bảng',
  AUDIO: 'Âm thanh (loa, micro, ampli)',
  CAMERA: 'Máy ảnh / máy quay',
  LAB: 'Thiết bị thí nghiệm',
  SPORTS: 'Dụng cụ thể dục thể thao',
  FURNITURE: 'Bàn ghế, bảng, phông bạt',
  OTHER: 'Thiết bị khác',
};

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] =
  Object.keys(EQUIPMENT_CATEGORY_LABELS) as EquipmentCategory[];

export type EquipmentCondition = 'GOOD' | 'NEEDS_REPAIR' | 'BROKEN';

export const EQUIPMENT_CONDITION_LABELS: Record<
  EquipmentCondition,
  { label: string; color: string; bg: string }
> = {
  GOOD: { label: 'Bình thường', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  NEEDS_REPAIR: { label: 'Cần sửa chữa', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  BROKEN: { label: 'Hỏng, không dùng được', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
};

export interface Equipment {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  category: EquipmentCategory;

  /**
   * How many the school owns. Availability is this minus what is currently out
   * — never a stored "available" field, which would drift on any failed write.
   */
  totalQuantity: number;
  /**
   * Units withdrawn from service (broken, being repaired). They count towards
   * `totalQuantity` on the asset register but cannot be lent.
   */
  outOfServiceQuantity: number;

  condition: EquipmentCondition;
  location?: string;
  note?: string;
  /** Whether a loan needs signing off. Expensive kit usually does. */
  requiresApproval: boolean;
  isActive: boolean;
}

export type LoanStatus =
  | 'REQUESTED'
  | 'BORROWED'
  | 'RETURNED'
  | 'REJECTED'
  | 'CANCELLED';

export const LOAN_STATUS_LABELS: Record<LoanStatus, { label: string; color: string; bg: string }> = {
  REQUESTED: { label: 'Chờ duyệt', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  BORROWED: { label: 'Đang mượn', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
  RETURNED: { label: 'Đã trả', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  REJECTED: { label: 'Từ chối', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  CANCELLED: { label: 'Đã hủy', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
};

/** Statuses that still hold units — a pending request reserves them too. */
export const LOAN_OPEN_STATUSES: LoanStatus[] = ['REQUESTED', 'BORROWED'];

export interface EquipmentLoan {
  id: string;
  schoolId: string;
  /** e.g. MT-2026-014 */
  code: string;

  equipmentId: string;
  equipmentName: string;
  quantity: number;

  borrowerId: string;
  borrowerName: string;
  departmentId: string;
  departmentName: string;

  purpose: string;
  /** `YYYY-MM-DD` */
  borrowDate: string;
  dueDate: string;

  status: LoanStatus;

  approverId?: string;
  approverName?: string;
  decidedAt?: string;
  decisionComment?: string;

  returnedAt?: string;
  returnedToId?: string;
  returnedToName?: string;
  /** Condition the kit came back in; anything but GOOD gets flagged. */
  returnCondition?: EquipmentCondition;
  returnNote?: string;

  history: HistoryLog[];
  createdAt: string;
  updatedAt: string;
}
