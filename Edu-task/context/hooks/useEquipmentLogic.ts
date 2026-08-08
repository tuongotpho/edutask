import {
  Equipment,
  EquipmentCondition,
  EquipmentLoan,
} from '@/Edu-task/types/equipment';
import { User, RoleType, ROLE_LABELS } from '@/Edu-task/types/user';
import { AppNotification, NotificationDraft } from '@/Edu-task/types/notification';
import { HistoryLog } from '@/Edu-task/types/approval';
import { genId } from '@/Edu-task/lib/utils';
import { currentSchoolId } from '@/Edu-task/lib/tenant';
import { formatDateVi } from '@/Edu-task/lib/schedule';
import { availability, canBorrow } from '@/Edu-task/lib/equipmentAvailability';
import { canManageRooms, isAdmin } from '@/Edu-task/lib/permissions';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

/**
 * Mượn & trả thiết bị.
 *
 * The rule that shapes everything: a borrower cannot mark their own loan
 * returned. Handing kit back is an act witnessed by whoever runs the store, and
 * a register where anyone can close their own entry records intentions rather
 * than equipment. Returning is therefore an office action, and it is the moment
 * damage gets recorded.
 */

interface EquipmentLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  equipment: Equipment[];
  setEquipment: React.Dispatch<React.SetStateAction<Equipment[]>>;
  loans: EquipmentLoan[];
  setLoans: React.Dispatch<React.SetStateAction<EquipmentLoan[]>>;
  users: User[];
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được lên máy chủ. Thay đổi đã được hoàn tác — vui lòng thử lại.';

export type EquipmentInput = Omit<Equipment, 'id' | 'schoolId'>;

export interface LoanInput {
  equipmentId: string;
  quantity: number;
  purpose: string;
  borrowDate: string;
  dueDate: string;
}

export function useEquipmentLogic({
  currentUser, activeRole, equipment, setEquipment, loans, setLoans, users, notify,
}: EquipmentLogicProps) {

  const now = () => new Date().toISOString().replace('T', ' ').slice(0, 16);

  const log = (action: string, note?: string): HistoryLog => ({
    id: genId('LOG'),
    action,
    actorName: currentUser?.fullName ?? 'Hệ thống',
    actorRole: ROLE_LABELS[activeRole] ?? activeRole,
    timestamp: now(),
    note,
  });

  const commitEquipment = async (next: Equipment[], toSave: Equipment): Promise<boolean> => {
    const previous = equipment;
    setEquipment(next);
    try {
      await firebaseService.saveEquipment(toSave);
      return true;
    } catch (err) {
      console.error('Failed to save equipment:', err);
      setEquipment(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const commitLoan = async (next: EquipmentLoan[], toSave: EquipmentLoan): Promise<boolean> => {
    const previous = loans;
    setLoans(next);
    try {
      await firebaseService.saveLoan(toSave);
      return true;
    } catch (err) {
      console.error('Failed to save loan:', err);
      setLoans(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  // The sender is stamped here rather than at each call site: rules reject any
  // notification whose sender is not the caller, and a new feature must not be
  // able to forget it and be refused at runtime.
  const pushNotification = async (draft: NotificationDraft) => {
    const notif: AppNotification = {
      ...draft,
      createdById: currentUser?.id ?? 'system',
      createdByName: currentUser?.fullName ?? 'Hệ thống',
    };
    try {
      await firebaseService.saveNotification(notif);
    } catch (err) {
      console.error('Failed to save notification:', err);
    }
  };

  // --- Catalog -------------------------------------------------------------

  const addEquipment = async (data: EquipmentInput): Promise<boolean> => {
    const code = data.code.trim().toUpperCase().replace(/\s+/g, '-');
    if (equipment.some(e => e.code === code)) {
      notify('error', `Mã thiết bị "${code}" đã tồn tại.`);
      return false;
    }

    const item: Equipment = { ...data, id: genId('EQP'), schoolId: currentSchoolId(), code };
    return commitEquipment([...equipment, item], item);
  };

  const updateEquipment = async (id: string, data: EquipmentInput): Promise<boolean> => {
    const target = equipment.find(e => e.id === id);
    if (!target) return false;

    const code = data.code.trim().toUpperCase().replace(/\s+/g, '-');
    if (equipment.some(e => e.id !== id && e.code === code)) {
      notify('error', `Mã thiết bị "${code}" đã tồn tại.`);
      return false;
    }

    // Reducing stock below what is already out would make availability
    // negative and the register incoherent.
    const out = availability(target, loans).reserved;
    if (data.totalQuantity < out) {
      notify('error', `Không giảm được xuống ${data.totalQuantity}: hiện đang có ${out} cái được mượn hoặc chờ duyệt.`);
      return false;
    }

    const updated: Equipment = { ...target, ...data, code };
    return commitEquipment(equipment.map(e => (e.id === id ? updated : e)), updated);
  };

  const deleteEquipment = async (id: string): Promise<boolean> => {
    const openLoans = loans.filter(
      l => l.equipmentId === id && (l.status === 'REQUESTED' || l.status === 'BORROWED')
    ).length;
    if (openLoans > 0) {
      notify('error', `Không thể xóa: còn ${openLoans} phiếu mượn chưa tất toán. Hãy bỏ tick "Đang sử dụng" thay vì xóa.`);
      return false;
    }

    const previous = equipment;
    setEquipment(equipment.filter(e => e.id !== id));
    try {
      await firebaseService.deleteEquipment(id);
      return true;
    } catch (err) {
      console.error('Failed to delete equipment:', err);
      setEquipment(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  // --- Loans ---------------------------------------------------------------

  const requestLoan = async (data: LoanInput): Promise<EquipmentLoan | null> => {
    if (!currentUser) throw new Error('User not logged in');

    const item = equipment.find(e => e.id === data.equipmentId);
    if (!item) {
      notify('error', 'Thiết bị không còn trong danh mục.');
      return null;
    }
    if (!data.purpose.trim()) {
      notify('error', 'Vui lòng nhập mục đích sử dụng.');
      return null;
    }
    if (data.dueDate < data.borrowDate) {
      notify('error', 'Ngày trả phải sau hoặc bằng ngày mượn.');
      return null;
    }

    // Re-checked at save time: someone else may have taken the last one while
    // this form was open.
    const check = canBorrow(item, loans, data.quantity);
    if (!check.ok) {
      notify('error', check.reason);
      return null;
    }

    const timestamp = now();
    const needsApproval = item.requiresApproval;
    const loan: EquipmentLoan = {
      id: genId('LOAN_2026'),
      schoolId: currentSchoolId(),
      code: `MT-2026-${Date.now().toString().slice(-6)}`,
      equipmentId: item.id,
      equipmentName: item.name,
      quantity: data.quantity,
      borrowerId: currentUser.id,
      borrowerName: currentUser.fullName,
      departmentId: currentUser.departmentId,
      departmentName: currentUser.departmentName,
      purpose: data.purpose.trim(),
      borrowDate: data.borrowDate,
      dueDate: data.dueDate,
      status: needsApproval ? 'REQUESTED' : 'BORROWED',
      history: [log(needsApproval ? 'Gửi yêu cầu mượn, chờ duyệt' : 'Mượn thiết bị')],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const ok = await commitLoan([loan, ...loans], loan);
    if (!ok) return null;

    if (needsApproval) {
      const approvers = users.filter(u => u.id !== currentUser.id && canManageRooms(u, u.activeRole));
      await Promise.all(
        approvers.map(approver =>
          pushNotification({
            id: genId('NTF'),
            recipientUserId: approver.id,
            title: 'Yêu cầu mượn thiết bị',
            message: `${currentUser.fullName} xin mượn ${data.quantity} ${item.name} từ ${formatDateVi(data.borrowDate)} đến ${formatDateVi(data.dueDate)}.`,
            type: 'SYSTEM',
            isRead: false,
            createdAt: timestamp,
          })
        )
      );
    }

    return loan;
  };

  const decideLoan = async (
    id: string,
    decision: 'BORROWED' | 'REJECTED',
    comment?: string
  ): Promise<boolean> => {
    const target = loans.find(l => l.id === id);
    if (!target || !currentUser) return false;

    if (!canManageRooms(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền duyệt mượn thiết bị.');
      return false;
    }
    if (target.status !== 'REQUESTED') {
      notify('error', 'Phiếu này đã được xử lý.');
      return false;
    }

    // Approving must re-check stock: another request may have been approved
    // while this one waited.
    if (decision === 'BORROWED') {
      const item = equipment.find(e => e.id === target.equipmentId);
      if (item) {
        const check = canBorrow(item, loans, target.quantity, target.id);
        if (!check.ok) {
          notify('error', `Không duyệt được: ${check.reason}`);
          return false;
        }
      }
    }

    const timestamp = now();
    const updated: EquipmentLoan = {
      ...target,
      status: decision,
      approverId: currentUser.id,
      approverName: currentUser.fullName,
      decidedAt: timestamp,
      decisionComment: comment,
      history: [...target.history, log(decision === 'BORROWED' ? 'Duyệt cho mượn' : 'Từ chối cho mượn', comment)],
      updatedAt: timestamp,
    };

    const ok = await commitLoan(loans.map(l => (l.id === id ? updated : l)), updated);
    if (!ok) return false;

    await pushNotification({
      id: genId('NTF'),
      recipientUserId: target.borrowerId,
      title: decision === 'BORROWED' ? 'Yêu cầu mượn thiết bị được duyệt' : 'Yêu cầu mượn thiết bị bị từ chối',
      message: `${target.quantity} ${target.equipmentName} — ${
        decision === 'BORROWED' ? `nhận tại phòng thiết bị, hạn trả ${formatDateVi(target.dueDate)}` : 'bị từ chối'
      }${comment ? `. ${comment}` : '.'}`,
      type: 'SYSTEM',
      isRead: false,
      createdAt: timestamp,
    });

    return true;
  };

  /**
   * Booking kit back in. Office-only, and the moment damage is recorded — the
   * only point in the loan where anyone actually looks at the equipment.
   */
  const returnLoan = async (
    id: string,
    condition: EquipmentCondition,
    note?: string
  ): Promise<boolean> => {
    const target = loans.find(l => l.id === id);
    if (!target || !currentUser) return false;

    if (!canManageRooms(currentUser, activeRole)) {
      notify('error', 'Chỉ bộ phận thiết bị mới xác nhận trả được.');
      return false;
    }
    if (target.status !== 'BORROWED') {
      notify('error', 'Phiếu này không ở trạng thái đang mượn.');
      return false;
    }

    const timestamp = now();
    const updated: EquipmentLoan = {
      ...target,
      status: 'RETURNED',
      returnedAt: timestamp,
      returnedToId: currentUser.id,
      returnedToName: currentUser.fullName,
      returnCondition: condition,
      returnNote: note?.trim() || undefined,
      history: [
        ...target.history,
        log('Nhận lại thiết bị', condition === 'GOOD' ? note : `Tình trạng: ${condition}${note ? ` — ${note}` : ''}`),
      ],
      updatedAt: timestamp,
    };

    const ok = await commitLoan(loans.map(l => (l.id === id ? updated : l)), updated);
    if (!ok) return false;

    // Damage found on return takes the affected units out of service straight
    // away, so the next person cannot book kit that is sitting broken in a
    // cupboard.
    if (condition !== 'GOOD') {
      const item = equipment.find(e => e.id === target.equipmentId);
      if (item) {
        const updatedItem: Equipment = {
          ...item,
          condition,
          outOfServiceQuantity: Math.min(
            item.totalQuantity,
            (item.outOfServiceQuantity ?? 0) + target.quantity
          ),
          note: note?.trim() ? `${item.note ? `${item.note} · ` : ''}${note.trim()}` : item.note,
        };
        await commitEquipment(equipment.map(e => (e.id === item.id ? updatedItem : e)), updatedItem);
      }
    }

    return true;
  };

  const cancelLoan = async (id: string, reason?: string): Promise<boolean> => {
    const target = loans.find(l => l.id === id);
    if (!target || !currentUser) return false;

    const isOwner = target.borrowerId === currentUser.id;
    if (!isOwner && !canManageRooms(currentUser, activeRole)) {
      notify('error', 'Chỉ người mượn hoặc bộ phận thiết bị mới hủy được.');
      return false;
    }
    // A borrower may withdraw a request, but cannot cancel kit already in their
    // hands — that has to be handed back and booked in.
    if (isOwner && target.status !== 'REQUESTED' && !canManageRooms(currentUser, activeRole)) {
      notify('error', 'Thiết bị đã mượn phải trả cho bộ phận thiết bị, không hủy được.');
      return false;
    }
    if (target.status === 'RETURNED' || target.status === 'CANCELLED') return false;

    const updated: EquipmentLoan = {
      ...target,
      status: 'CANCELLED',
      history: [...target.history, log('Hủy phiếu mượn', reason)],
      updatedAt: now(),
    };

    return commitLoan(loans.map(l => (l.id === id ? updated : l)), updated);
  };

  /** Puts repaired units back into circulation. */
  const restoreEquipment = async (id: string, quantity: number): Promise<boolean> => {
    const target = equipment.find(e => e.id === id);
    if (!target || !currentUser) return false;

    if (!canManageRooms(currentUser, activeRole) && !isAdmin(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền cập nhật tình trạng thiết bị.');
      return false;
    }

    const remaining = Math.max(0, (target.outOfServiceQuantity ?? 0) - Math.max(0, quantity));
    const updated: Equipment = {
      ...target,
      outOfServiceQuantity: remaining,
      condition: remaining === 0 ? 'GOOD' : target.condition,
    };

    return commitEquipment(equipment.map(e => (e.id === id ? updated : e)), updated);
  };

  return {
    addEquipment, updateEquipment, deleteEquipment, restoreEquipment,
    requestLoan, decideLoan, returnLoan, cancelLoan,
  };
}
