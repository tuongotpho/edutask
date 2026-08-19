import {
  AttendanceIssue,
  AttendanceRecord,
  TIMED_ISSUES,
} from '@/Edu-task/types/attendance';
import { ClassGroup, PeriodSlot } from '@/Edu-task/types/schedule';
import { User, RoleType } from '@/Edu-task/types/user';
import { AppNotification, NotificationDraft } from '@/Edu-task/types/notification';
import { genId } from '@/Edu-task/lib/utils';
import { currentSchoolId } from '@/Edu-task/lib/tenant';
import { formatSlot } from '@/Edu-task/lib/schedule';
import { canRecordAttendance, canViewAllAttendance } from '@/Edu-task/lib/permissions';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

/**
 * Sổ nền nếp — recording, answering and settling lateness entries.
 *
 * The one rule worth stating out loud: the teacher named in a record is
 * notified the moment it is written. Finding out at the end-of-month thi đua
 * meeting that there were four entries about you, none of which you had a
 * chance to answer, is exactly how a system like this loses the staff room.
 */

interface AttendanceLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  users: User[];
  classes: ClassGroup[];
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được lên máy chủ. Thay đổi đã được hoàn tác — vui lòng thử lại.';

export interface AttendanceInput {
  slot: PeriodSlot;
  classId: string;
  teacherId?: string;
  issue: AttendanceIssue;
  minutes?: number;
  note?: string;
}

export function useAttendanceLogic({
  currentUser, activeRole, users, classes,
  attendance, setAttendance, notify,
}: AttendanceLogicProps) {

  const commit = async (next: AttendanceRecord[], toSave: AttendanceRecord): Promise<boolean> => {
    const previous = attendance;
    setAttendance(next);
    try {
      await firebaseService.saveAttendance(toSave);
      return true;
    } catch (err) {
      console.error('Failed to save attendance record:', err);
      setAttendance(previous);
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

  const recordIssue = async (data: AttendanceInput): Promise<AttendanceRecord | null> => {
    if (!currentUser) throw new Error('User not logged in');

    if (!canRecordAttendance(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền ghi nhận nền nếp.');
      return null;
    }

    const classGroup = classes.find(c => c.id === data.classId);
    if (!classGroup) {
      notify('error', 'Vui lòng chọn lớp.');
      return null;
    }

    // A timed issue with no duration is a record nobody can act on later.
    if (TIMED_ISSUES.includes(data.issue) && !data.minutes) {
      notify('error', 'Vui lòng nhập số phút.');
      return null;
    }

    const teacher = data.teacherId ? users.find(u => u.id === data.teacherId) : undefined;
    const timestamp = now();

    const record: AttendanceRecord = {
      id: genId('ATT_2026'),
      schoolId: currentSchoolId(),
      code: `NN-2026-${Date.now().toString().slice(-6)}`,
      slot: data.slot,
      classId: classGroup.id,
      className: classGroup.name,
      teacherId: teacher?.id,
      teacherName: teacher?.fullName,
      departmentId: teacher?.departmentId,
      departmentName: teacher?.departmentName,
      issue: data.issue,
      minutes: TIMED_ISSUES.includes(data.issue) ? data.minutes : undefined,
      note: data.note?.trim() || undefined,
      recordedById: currentUser.id,
      recordedByName: currentUser.fullName,
      status: 'RECORDED',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const ok = await commit([record, ...attendance], record);
    if (!ok) return null;

    // Tell the teacher immediately. Silence until the monthly meeting is what
    // makes this kind of log feel like surveillance rather than management.
    if (teacher) {
      await pushNotification({
        id: genId('NTF'),
        recipientUserId: teacher.id,
        title: 'Có ghi nhận nền nếp về bạn',
        message: `${formatSlot(data.slot)} · Lớp ${classGroup.name}: ${
          data.issue === 'LATE'
            ? `vào lớp muộn ${data.minutes} phút`
            : data.issue === 'EMPTY_CLASS'
              ? 'lớp trống giờ'
              : data.issue === 'LEFT_EARLY'
                ? `ra lớp sớm ${data.minutes} phút`
                : 'ghi nhận khác'
        }. Bạn có thể gửi giải trình trong mục Nền Nếp.`,
        type: 'SYSTEM',
        isRead: false,
        createdAt: timestamp,
      });
    }

    return record;
  };

  const updateRecord = async (id: string, data: AttendanceInput): Promise<boolean> => {
    const target = attendance.find(r => r.id === id);
    if (!target || !currentUser) return false;

    if (target.recordedById !== currentUser.id && !canViewAllAttendance(currentUser, activeRole)) {
      notify('error', 'Chỉ người đã ghi nhận mới sửa được bản ghi này.');
      return false;
    }

    const classGroup = classes.find(c => c.id === data.classId);
    const teacher = data.teacherId ? users.find(u => u.id === data.teacherId) : undefined;

    const updated: AttendanceRecord = {
      ...target,
      slot: data.slot,
      classId: classGroup?.id ?? target.classId,
      className: classGroup?.name ?? target.className,
      teacherId: teacher?.id,
      teacherName: teacher?.fullName,
      departmentId: teacher?.departmentId,
      departmentName: teacher?.departmentName,
      issue: data.issue,
      minutes: TIMED_ISSUES.includes(data.issue) ? data.minutes : undefined,
      note: data.note?.trim() || undefined,
      updatedAt: now(),
    };

    return commit(attendance.map(r => (r.id === id ? updated : r)), updated);
  };

  /** The teacher's reply. Only they can write it, and only about themselves. */
  const submitExplanation = async (id: string, text: string): Promise<boolean> => {
    const target = attendance.find(r => r.id === id);
    if (!target || !currentUser) return false;

    if (target.teacherId !== currentUser.id) {
      notify('error', 'Chỉ giáo viên được ghi nhận mới gửi giải trình được.');
      return false;
    }
    if (!text.trim()) {
      notify('error', 'Vui lòng nhập nội dung giải trình.');
      return false;
    }

    const timestamp = now();
    const updated: AttendanceRecord = {
      ...target,
      status: 'EXPLAINED',
      explanation: { text: text.trim(), submittedAt: timestamp },
      updatedAt: timestamp,
    };

    const ok = await commit(attendance.map(r => (r.id === id ? updated : r)), updated);
    if (!ok) return false;

    await pushNotification({
      id: genId('NTF'),
      recipientUserId: target.recordedById,
      title: 'Có giải trình cho ghi nhận nền nếp',
      message: `${target.teacherName ?? 'Giáo viên'} đã giải trình cho ghi nhận ${target.code}.`,
      type: 'SYSTEM',
      isRead: false,
      createdAt: timestamp,
    });

    return true;
  };

  /** Leadership settles it: excuse the entry, or let it stand. */
  const reviewRecord = async (
    id: string,
    decision: 'EXCUSED' | 'CONFIRMED',
    reviewNote?: string
  ): Promise<boolean> => {
    const target = attendance.find(r => r.id === id);
    if (!target || !currentUser) return false;

    if (!canViewAllAttendance(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền kết luận ghi nhận nền nếp.');
      return false;
    }

    const timestamp = now();
    const updated: AttendanceRecord = {
      ...target,
      status: decision,
      reviewedById: currentUser.id,
      reviewedByName: currentUser.fullName,
      reviewNote: reviewNote?.trim() || undefined,
      reviewedAt: timestamp,
      updatedAt: timestamp,
    };

    const ok = await commit(attendance.map(r => (r.id === id ? updated : r)), updated);
    if (!ok) return false;

    if (target.teacherId) {
      await pushNotification({
        id: genId('NTF'),
        recipientUserId: target.teacherId,
        title: decision === 'EXCUSED' ? 'Ghi nhận nền nếp đã được miễn' : 'Ghi nhận nền nếp được giữ nguyên',
        message: `${target.code} — ${
          decision === 'EXCUSED' ? 'giải trình được chấp nhận, không tính vào thi đua' : 'giữ nguyên ghi nhận'
        }${reviewNote ? `: ${reviewNote}` : '.'}`,
        type: 'SYSTEM',
        isRead: false,
        createdAt: timestamp,
      });
    }

    return true;
  };

  const deleteRecord = async (id: string): Promise<boolean> => {
    const previous = attendance;
    setAttendance(attendance.filter(r => r.id !== id));
    try {
      await firebaseService.deleteAttendance(id);
      return true;
    } catch (err) {
      console.error('Failed to delete attendance record:', err);
      setAttendance(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  return { recordIssue, updateRecord, submitExplanation, reviewRecord, deleteRecord };
}
