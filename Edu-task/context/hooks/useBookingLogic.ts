import { BookingPurpose, RoomBooking } from '@/Edu-task/types/booking';
import { MakeupClass } from '@/Edu-task/types/makeup';
import { ClassGroup, PeriodSlot, Room } from '@/Edu-task/types/schedule';
import { User, RoleType, ROLE_LABELS } from '@/Edu-task/types/user';
import { AppNotification, NotificationDraft } from '@/Edu-task/types/notification';
import { HistoryLog } from '@/Edu-task/types/approval';
import { genId } from '@/Edu-task/lib/utils';
import { currentSchoolId } from '@/Edu-task/lib/tenant';
import { formatSlot } from '@/Edu-task/lib/schedule';
import { canManageRooms } from '@/Edu-task/lib/permissions';
import {
  findSlotConflicts,
  occupanciesFromBookings,
  occupanciesFromMakeups,
} from '@/Edu-task/lib/slotConflict';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

/**
 * Đăng ký phòng đa năng / phòng thí nghiệm.
 *
 * Whether a booking needs approval is read from the room, not decided here — so
 * a school can make the hall controlled and leave the labs first-come, first-
 * served without touching any code.
 *
 * The clash check deliberately does NOT consider the requester's leave. Booking
 * a room for a colleague to use, or for an event on a day you are away, is
 * normal; blocking it would be officious. A make-up class is different — there
 * the teacher must personally be present, which is why that check lives there.
 */

interface BookingLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  users: User[];
  bookings: RoomBooking[];
  setBookings: React.Dispatch<React.SetStateAction<RoomBooking[]>>;
  makeups: MakeupClass[];
  rooms: Room[];
  classes: ClassGroup[];
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được lên máy chủ. Thay đổi đã được hoàn tác — vui lòng thử lại.';

export interface BookingInput {
  roomId: string;
  slot: PeriodSlot;
  purpose: BookingPurpose;
  purposeNote?: string;
  classId?: string;
  expectedAttendees?: number;
}

export function useBookingLogic({
  currentUser, activeRole, users,
  bookings, setBookings,
  makeups, rooms, classes,
  notify,
}: BookingLogicProps) {

  const commit = async (next: RoomBooking[], toSave: RoomBooking): Promise<boolean> => {
    const previous = bookings;
    setBookings(next);
    try {
      await firebaseService.saveBooking(toSave);
      return true;
    } catch (err) {
      console.error('Failed to save room booking:', err);
      setBookings(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

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

  const allOccupancies = () => [
    ...occupanciesFromMakeups(makeups),
    ...occupanciesFromBookings(bookings),
  ];

  /** Reasons this room/slot cannot be booked, ready to show while the form is open. */
  const getBookingSlotProblems = (
    slot: PeriodSlot,
    params: { roomId: string; classId?: string; excludeId?: string }
  ): string[] =>
    findSlotConflicts(
      {
        id: params.excludeId,
        slot,
        roomId: params.roomId,
        roomName: rooms.find(r => r.id === params.roomId)?.name,
        classId: params.classId,
        className: classes.find(c => c.id === params.classId)?.name,
      },
      allOccupancies()
    ).map(c => c.message);

  /**
   * Which periods of a day are already taken for a room. Powers the weekly
   * room timetable and lets the form grey out slots instead of letting someone
   * pick one and only then be told no.
   */
  const getRoomBusySlots = (roomId: string, date: string): PeriodSlot[] =>
    allOccupancies()
      .filter(o => o.roomId === roomId && o.slot.date === date)
      .map(o => o.slot);

  const createBooking = async (data: BookingInput): Promise<RoomBooking | null> => {
    if (!currentUser) throw new Error('User not logged in');

    const room = rooms.find(r => r.id === data.roomId);
    if (!room) {
      notify('error', 'Phòng không còn trong danh mục. Vui lòng chọn lại.');
      return null;
    }
    if (!room.isActive) {
      notify('error', `Phòng ${room.name} đang ngừng sử dụng.`);
      return null;
    }

    // Re-checked at save time: the form may have been open while someone else
    // took the slot.
    const problems = getBookingSlotProblems(data.slot, {
      roomId: data.roomId,
      classId: data.classId,
    });
    if (problems.length > 0) {
      notify('error', `Không đặt được: ${problems[0]}`);
      return null;
    }

    const classGroup = data.classId ? classes.find(c => c.id === data.classId) : undefined;
    const timestamp = now();
    const booking: RoomBooking = {
      id: genId('BKG_2026'),
      schoolId: currentSchoolId(),
      code: `DP-2026-${Date.now().toString().slice(-6)}`,
      roomId: room.id,
      roomName: room.name,
      requesterId: currentUser.id,
      requesterName: currentUser.fullName,
      departmentId: currentUser.departmentId,
      departmentName: currentUser.departmentName,
      classId: classGroup?.id,
      className: classGroup?.name,
      slot: data.slot,
      purpose: data.purpose,
      purposeNote: data.purposeNote,
      expectedAttendees: data.expectedAttendees,
      // The room decides. Most rooms confirm on the spot, which is the whole
      // point — making people wait for approval on an ordinary lab is what
      // sends them back to the paper register.
      status: room.requiresApproval ? 'IN_REVIEW' : 'CONFIRMED',
      history: [
        log(room.requiresApproval ? 'Gửi đăng ký phòng, chờ duyệt' : 'Đặt phòng thành công'),
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const ok = await commit([booking, ...bookings], booking);
    if (!ok) return null;

    if (room.requiresApproval) {
      const approvers = users.filter(
        u => u.id !== currentUser.id && canManageRooms(u, u.activeRole)
      );
      await Promise.all(
        approvers.map(approver =>
          pushNotification({
            id: genId('NTF'),
            recipientUserId: approver.id,
            title: 'Đăng ký phòng cần duyệt',
            message: `${currentUser.fullName} đăng ký ${room.name} vào ${formatSlot(data.slot)}.`,
            type: 'SYSTEM',
            isRead: false,
            createdAt: timestamp,
          })
        )
      );
    }

    return booking;
  };

  const decideBooking = async (
    id: string,
    decision: 'CONFIRMED' | 'REJECTED',
    comment?: string
  ): Promise<boolean> => {
    const target = bookings.find(b => b.id === id);
    if (!target || !currentUser) return false;

    if (!canManageRooms(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền duyệt đăng ký phòng.');
      return false;
    }
    if (target.status !== 'IN_REVIEW') {
      notify('error', 'Đăng ký này đã được xử lý.');
      return false;
    }

    // Approving must re-check: another booking may have been confirmed for the
    // same room while this one sat in the queue.
    if (decision === 'CONFIRMED') {
      const problems = getBookingSlotProblems(target.slot, {
        roomId: target.roomId,
        classId: target.classId,
        excludeId: target.id,
      });
      if (problems.length > 0) {
        notify('error', `Không duyệt được: ${problems[0]}`);
        return false;
      }
    }

    const timestamp = now();
    const updated: RoomBooking = {
      ...target,
      status: decision,
      approverId: currentUser.id,
      approverName: currentUser.fullName,
      decidedAt: timestamp,
      decisionComment: comment,
      history: [
        ...target.history,
        log(decision === 'CONFIRMED' ? 'Duyệt đăng ký phòng' : 'Từ chối đăng ký phòng', comment),
      ],
      updatedAt: timestamp,
    };

    const ok = await commit(bookings.map(b => (b.id === id ? updated : b)), updated);
    if (!ok) return false;

    await pushNotification({
      id: genId('NTF'),
      recipientUserId: target.requesterId,
      title: decision === 'CONFIRMED' ? 'Đăng ký phòng đã được duyệt' : 'Đăng ký phòng bị từ chối',
      message: `${target.roomName} — ${formatSlot(target.slot)}: ${
        decision === 'CONFIRMED' ? 'đã xác nhận' : 'bị từ chối'
      }${comment ? `. ${comment}` : '.'}`,
      type: 'SYSTEM',
      isRead: false,
      createdAt: timestamp,
    });

    return true;
  };

  const cancelBooking = async (id: string, reason?: string): Promise<boolean> => {
    const target = bookings.find(b => b.id === id);
    if (!target || !currentUser) return false;

    const isOwner = target.requesterId === currentUser.id;
    if (!isOwner && !canManageRooms(currentUser, activeRole)) {
      notify('error', 'Chỉ người đăng ký hoặc bộ phận điều phối mới hủy được.');
      return false;
    }
    if (target.status === 'CANCELLED' || target.status === 'REJECTED') return false;

    const timestamp = now();
    const updated: RoomBooking = {
      ...target,
      status: 'CANCELLED',
      history: [...target.history, log('Hủy đăng ký phòng', reason)],
      updatedAt: timestamp,
    };

    const ok = await commit(bookings.map(b => (b.id === id ? updated : b)), updated);
    if (!ok) return false;

    // Someone else cancelling your booking is a surprise worth announcing.
    if (!isOwner) {
      await pushNotification({
        id: genId('NTF'),
        recipientUserId: target.requesterId,
        title: 'Đăng ký phòng đã bị hủy',
        message: `${target.roomName} — ${formatSlot(target.slot)} đã bị hủy bởi ${currentUser.fullName}${
          reason ? `: ${reason}` : '.'
        }`,
        type: 'SYSTEM',
        isRead: false,
        createdAt: timestamp,
      });
    }

    return true;
  };

  const deleteBooking = async (id: string): Promise<boolean> => {
    const previous = bookings;
    setBookings(bookings.filter(b => b.id !== id));
    try {
      await firebaseService.deleteBooking(id);
      return true;
    } catch (err) {
      console.error('Failed to delete room booking:', err);
      setBookings(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  return {
    getBookingSlotProblems,
    getRoomBusySlots,
    createBooking,
    decideBooking,
    cancelBooking,
    deleteBooking,
  };
}
