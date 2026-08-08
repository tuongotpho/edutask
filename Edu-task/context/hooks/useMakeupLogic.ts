import { MakeupClass, MakeupReason, MakeupStatus } from '@/Edu-task/types/makeup';
import { LeaveRequest } from '@/Edu-task/types/leave';
import { RoomBooking } from '@/Edu-task/types/booking';
import { ClassGroup, PeriodSlot, Room } from '@/Edu-task/types/schedule';
import { User, RoleType, ROLE_LABELS } from '@/Edu-task/types/user';
import { AppNotification, NotificationDraft } from '@/Edu-task/types/notification';
import { HistoryLog } from '@/Edu-task/types/approval';
import { genId } from '@/Edu-task/lib/utils';
import { currentSchoolId } from '@/Edu-task/lib/tenant';
import { formatSlot } from '@/Edu-task/lib/schedule';
import { canApproveMakeup } from '@/Edu-task/lib/permissions';
import {
  describeSlotProblems,
  occupanciesFromBookings,
  occupanciesFromMakeups,
} from '@/Edu-task/lib/slotConflict';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

/**
 * Đăng ký dạy bù.
 *
 * Approval is one step — the department leader — rather than the two-level flow
 * leave uses. Rescheduling a lost period is a professional matter inside the
 * tổ chuyên môn; routing it through Ban Giám Hiệu would add days of latency to
 * something that usually has to be settled this week.
 */

interface MakeupLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  users: User[];
  makeups: MakeupClass[];
  setMakeups: React.Dispatch<React.SetStateAction<MakeupClass[]>>;
  bookings: RoomBooking[];
  leaves: LeaveRequest[];
  rooms: Room[];
  classes: ClassGroup[];
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được lên máy chủ. Thay đổi đã được hoàn tác — vui lòng thử lại.';

export interface MakeupInput {
  classId: string;
  subject?: string;
  missedSlot: PeriodSlot;
  reason: MakeupReason;
  reasonNote?: string;
  relatedLeaveId?: string;
  makeupSlot: PeriodSlot;
  roomId?: string;
}

export function useMakeupLogic({
  currentUser, activeRole, users,
  makeups, setMakeups,
  bookings, leaves, rooms, classes,
  notify,
}: MakeupLogicProps) {

  const commit = async (next: MakeupClass[], toSave: MakeupClass): Promise<boolean> => {
    const previous = makeups;
    setMakeups(next);
    try {
      await firebaseService.saveMakeup(toSave);
      return true;
    } catch (err) {
      console.error('Failed to save make-up class:', err);
      setMakeups(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  // A failed notification must never undo the record it was announcing.
  // Sender stamped here, not at the call site — see useEquipmentLogic.
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

  const now = () => new Date().toISOString().replace('T', ' ').slice(0, 16);

  const log = (action: string, note?: string): HistoryLog => ({
    id: genId('LOG'),
    action,
    actorName: currentUser?.fullName ?? 'Hệ thống',
    actorRole: ROLE_LABELS[activeRole] ?? activeRole,
    timestamp: now(),
    note,
  });

  /**
   * Every reason this make-up slot cannot be used, as sentences ready to show.
   * Exposed so the form can warn while the teacher is still choosing, rather
   * than only rejecting them after they press save.
   */
  const getMakeupSlotProblems = (
    slot: PeriodSlot,
    params: { teacherId: string; classId?: string; roomId?: string; excludeId?: string }
  ): string[] => {
    const teacher = users.find(u => u.id === params.teacherId);
    return describeSlotProblems({
      candidate: {
        id: params.excludeId,
        slot,
        teacherId: params.teacherId,
        teacherName: teacher?.fullName,
        classId: params.classId,
        className: classes.find(c => c.id === params.classId)?.name,
        roomId: params.roomId,
        roomName: rooms.find(r => r.id === params.roomId)?.name,
      },
      existing: [...occupanciesFromMakeups(makeups), ...occupanciesFromBookings(bookings)],
      leaves,
    });
  };

  const createMakeup = async (data: MakeupInput): Promise<MakeupClass | null> => {
    if (!currentUser) throw new Error('User not logged in');

    const classGroup = classes.find(c => c.id === data.classId);
    if (!classGroup) {
      notify('error', 'Lớp không còn trong danh mục. Vui lòng chọn lại.');
      return null;
    }

    // Re-check at save time, not just while typing: the form was filled in over
    // several minutes and someone else may have taken the slot in between.
    const problems = getMakeupSlotProblems(data.makeupSlot, {
      teacherId: currentUser.id,
      classId: data.classId,
      roomId: data.roomId,
    });
    if (problems.length > 0) {
      notify('error', `Không đăng ký được: ${problems[0]}`);
      return null;
    }

    const room = data.roomId ? rooms.find(r => r.id === data.roomId) : undefined;
    const timestamp = now();
    const makeup: MakeupClass = {
      id: genId('MKP_2026'),
      schoolId: currentSchoolId(),
      code: `DB-2026-${Date.now().toString().slice(-6)}`,
      teacherId: currentUser.id,
      teacherName: currentUser.fullName,
      departmentId: currentUser.departmentId,
      departmentName: currentUser.departmentName,
      classId: classGroup.id,
      className: classGroup.name,
      subject: data.subject || currentUser.subject,
      missedSlot: data.missedSlot,
      reason: data.reason,
      reasonNote: data.reasonNote,
      relatedLeaveId: data.relatedLeaveId,
      makeupSlot: data.makeupSlot,
      roomId: room?.id,
      roomName: room?.name,
      status: 'IN_REVIEW',
      steps: [
        {
          level: 'HEAD_OF_DEPT',
          levelLabel: 'Tổ trưởng chuyên môn',
          status: 'PENDING',
        },
      ],
      currentStepIndex: 0,
      history: [log('Tạo đăng ký dạy bù', `Bù cho ${formatSlot(data.missedSlot)}`)],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const ok = await commit([makeup, ...makeups], makeup);
    if (!ok) return null;

    // Tell the people who have to sign it off.
    const deptLeaders = users.filter(
      u =>
        u.departmentId === currentUser.departmentId &&
        u.id !== currentUser.id &&
        u.roles?.some(r => r === 'HEAD_OF_DEPT' || r === 'GROUP_LEADER')
    );
    await Promise.all(
      deptLeaders.map(leader =>
        pushNotification({
          id: genId('NTF'),
          recipientUserId: leader.id,
          title: 'Đăng ký dạy bù cần duyệt',
          message: `${currentUser.fullName} đăng ký dạy bù lớp ${classGroup.name} vào ${formatSlot(data.makeupSlot)}.`,
          type: 'SYSTEM',
          isRead: false,
          createdAt: timestamp,
        })
      )
    );

    return makeup;
  };

  const updateMakeup = async (id: string, data: MakeupInput): Promise<boolean> => {
    const target = makeups.find(m => m.id === id);
    if (!target) return false;
    if (target.status !== 'IN_REVIEW') {
      notify('error', 'Chỉ sửa được đăng ký đang chờ duyệt.');
      return false;
    }

    const classGroup = classes.find(c => c.id === data.classId);
    if (!classGroup) {
      notify('error', 'Lớp không còn trong danh mục. Vui lòng chọn lại.');
      return false;
    }

    const problems = getMakeupSlotProblems(data.makeupSlot, {
      teacherId: target.teacherId,
      classId: data.classId,
      roomId: data.roomId,
      excludeId: id,
    });
    if (problems.length > 0) {
      notify('error', `Không lưu được: ${problems[0]}`);
      return false;
    }

    const room = data.roomId ? rooms.find(r => r.id === data.roomId) : undefined;
    const updated: MakeupClass = {
      ...target,
      classId: classGroup.id,
      className: classGroup.name,
      subject: data.subject,
      missedSlot: data.missedSlot,
      reason: data.reason,
      reasonNote: data.reasonNote,
      makeupSlot: data.makeupSlot,
      roomId: room?.id,
      roomName: room?.name,
      history: [...target.history, log('Sửa đăng ký dạy bù')],
      updatedAt: now(),
    };

    return commit(makeups.map(m => (m.id === id ? updated : m)), updated);
  };

  const decideMakeup = async (
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    comment?: string
  ): Promise<boolean> => {
    const target = makeups.find(m => m.id === id);
    if (!target || !currentUser) return false;

    // Same guard as the button that opens this, so an approve action can never
    // be reachable by a role the handler would refuse.
    if (!canApproveMakeup(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền duyệt đăng ký dạy bù.');
      return false;
    }
    if (target.status !== 'IN_REVIEW') {
      notify('error', 'Đăng ký này đã được xử lý.');
      return false;
    }

    const timestamp = now();
    const updated: MakeupClass = {
      ...target,
      status: decision,
      steps: target.steps.map((step, index) =>
        index === target.currentStepIndex
          ? {
              ...step,
              status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
              approverId: currentUser.id,
              approverName: currentUser.fullName,
              comment,
              updatedAt: timestamp,
            }
          : step
      ),
      history: [
        ...target.history,
        log(decision === 'APPROVED' ? 'Duyệt đăng ký dạy bù' : 'Từ chối đăng ký dạy bù', comment),
      ],
      updatedAt: timestamp,
    };

    const ok = await commit(makeups.map(m => (m.id === id ? updated : m)), updated);
    if (!ok) return false;

    await pushNotification({
      id: genId('NTF'),
      recipientUserId: target.teacherId,
      title: decision === 'APPROVED' ? 'Đăng ký dạy bù đã được duyệt' : 'Đăng ký dạy bù bị từ chối',
      message: `Tiết bù lớp ${target.className} vào ${formatSlot(target.makeupSlot)} — ${
        decision === 'APPROVED' ? 'đã được duyệt' : 'bị từ chối'
      }${comment ? `: ${comment}` : '.'}`,
      type: 'SYSTEM',
      isRead: false,
      createdAt: timestamp,
    });

    return true;
  };

  const cancelMakeup = async (id: string, reason?: string): Promise<boolean> => {
    const target = makeups.find(m => m.id === id);
    if (!target) return false;
    if (target.status === 'CANCELLED' || target.status === 'COMPLETED') return false;

    const updated: MakeupClass = {
      ...target,
      status: 'CANCELLED',
      history: [...target.history, log('Hủy đăng ký dạy bù', reason)],
      updatedAt: now(),
    };

    return commit(makeups.map(m => (m.id === id ? updated : m)), updated);
  };

  /** Marks an approved make-up class as actually taught. */
  const completeMakeup = async (id: string): Promise<boolean> => {
    const target = makeups.find(m => m.id === id);
    if (!target || target.status !== 'APPROVED') return false;

    const updated: MakeupClass = {
      ...target,
      status: 'COMPLETED' as MakeupStatus,
      history: [...target.history, log('Xác nhận đã dạy bù')],
      updatedAt: now(),
    };

    return commit(makeups.map(m => (m.id === id ? updated : m)), updated);
  };

  const deleteMakeup = async (id: string): Promise<boolean> => {
    const previous = makeups;
    setMakeups(makeups.filter(m => m.id !== id));
    try {
      await firebaseService.deleteMakeup(id);
      return true;
    } catch (err) {
      console.error('Failed to delete make-up class:', err);
      setMakeups(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  return {
    getMakeupSlotProblems,
    createMakeup,
    updateMakeup,
    decideMakeup,
    cancelMakeup,
    completeMakeup,
    deleteMakeup,
  };
}
