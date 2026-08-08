import {
  AttendanceMark,
  Meeting,
  MeetingKind,
  MeetingParticipant,
} from '@/Edu-task/types/meeting';
import { User, RoleType } from '@/Edu-task/types/user';
import { AppNotification, NotificationDraft } from '@/Edu-task/types/notification';
import { genId } from '@/Edu-task/lib/utils';
import { currentSchoolId } from '@/Edu-task/lib/tenant';
import { formatDateVi, weekdayLabel } from '@/Edu-task/lib/schedule';
import { canManageMeetings } from '@/Edu-task/lib/permissions';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

/**
 * Cuộc họp & điểm danh.
 *
 * The participant list is resolved to concrete people at creation time rather
 * than stored as a rule ("tất cả giáo viên") and evaluated later. A meeting is
 * a historical record: who was *called* to the meeting on that day must not
 * change because someone joined or left the school afterwards, and a roll that
 * silently rewrites itself is worthless as evidence.
 */

interface MeetingLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  users: User[];
  meetings: Meeting[];
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được lên máy chủ. Thay đổi đã được hoàn tác — vui lòng thử lại.';

export interface MeetingInput {
  title: string;
  agenda?: string;
  kind: MeetingKind;
  date: string;
  startTime: string;
  endTime?: string;
  location?: string;
  scope: 'ALL_STAFF' | 'DEPARTMENTS' | 'CUSTOM';
  departmentIds?: string[];
  /** Only for `CUSTOM`. */
  userIds?: string[];
  chairedById?: string;
}

export function useMeetingLogic({
  currentUser, activeRole, users, meetings, setMeetings, notify,
}: MeetingLogicProps) {

  const commit = async (next: Meeting[], toSave: Meeting): Promise<boolean> => {
    const previous = meetings;
    setMeetings(next);
    try {
      await firebaseService.saveMeeting(toSave);
      return true;
    } catch (err) {
      console.error('Failed to save meeting:', err);
      setMeetings(previous);
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

  /** Turns a scope into the actual list of people, snapshotted for good. */
  const resolveParticipants = (data: MeetingInput): MeetingParticipant[] => {
    const active = users.filter(u => u.status === 'ACTIVE');

    const selected =
      data.scope === 'ALL_STAFF'
        ? active
        : data.scope === 'DEPARTMENTS'
          ? active.filter(u => (data.departmentIds ?? []).includes(u.departmentId))
          : active.filter(u => (data.userIds ?? []).includes(u.id));

    return selected
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
      .map(u => ({
        userId: u.id,
        userName: u.fullName,
        departmentName: u.departmentName,
      }));
  };

  const createMeeting = async (data: MeetingInput): Promise<Meeting | null> => {
    if (!currentUser) throw new Error('User not logged in');

    if (!canManageMeetings(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền tạo cuộc họp.');
      return null;
    }
    if (!data.title.trim()) {
      notify('error', 'Vui lòng nhập tên cuộc họp.');
      return null;
    }

    const participants = resolveParticipants(data);
    if (participants.length === 0) {
      notify('error', 'Chưa có thành phần dự họp nào. Vui lòng chọn lại.');
      return null;
    }

    const chair = data.chairedById ? users.find(u => u.id === data.chairedById) : undefined;
    const timestamp = now();

    const meeting: Meeting = {
      id: genId('MTG_2026'),
      schoolId: currentSchoolId(),
      code: `CH-2026-${Date.now().toString().slice(-6)}`,
      title: data.title.trim(),
      agenda: data.agenda?.trim() || undefined,
      kind: data.kind,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime || undefined,
      location: data.location?.trim() || undefined,
      scope: data.scope,
      departmentIds: data.scope === 'DEPARTMENTS' ? data.departmentIds : undefined,
      participants,
      participantIds: participants.map(p => p.userId),
      chairedById: chair?.id,
      chairedByName: chair?.fullName,
      secretaryId: currentUser.id,
      secretaryName: currentUser.fullName,
      status: 'SCHEDULED',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const ok = await commit([meeting, ...meetings], meeting);
    if (!ok) return null;

    // Everyone called to the meeting is told. The secretary is excluded — they
    // just created it and do not need to be informed of their own action.
    await Promise.all(
      participants
        .filter(p => p.userId !== currentUser.id)
        .map(p =>
          pushNotification({
            id: genId('NTF'),
            recipientUserId: p.userId,
            title: 'Giấy mời họp',
            message: `${meeting.title} — ${weekdayLabel(meeting.date)} ${formatDateVi(meeting.date)} lúc ${meeting.startTime}${
              meeting.location ? ` tại ${meeting.location}` : ''
            }.`,
            type: 'SYSTEM',
            isRead: false,
            createdAt: timestamp,
          })
        )
    );

    return meeting;
  };

  const updateMeeting = async (id: string, data: MeetingInput): Promise<boolean> => {
    const target = meetings.find(m => m.id === id);
    if (!target || !currentUser) return false;

    if (!canManageMeetings(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền sửa cuộc họp.');
      return false;
    }

    // Re-resolving the roll would wipe marks already made, so the participant
    // list is only rebuilt while the meeting has not been held.
    const rebuildRoll = target.status === 'SCHEDULED';
    const participants = rebuildRoll ? resolveParticipants(data) : target.participants;

    // Marks already entered survive a re-resolve, so editing the invitee list
    // after a partial roll call does not silently erase work.
    const previousMarks = new Map(target.participants.map(p => [p.userId, p]));
    const merged = participants.map(p => ({ ...p, ...previousMarks.get(p.userId), userName: p.userName }));

    const chair = data.chairedById ? users.find(u => u.id === data.chairedById) : undefined;
    const updated: Meeting = {
      ...target,
      title: data.title.trim(),
      agenda: data.agenda?.trim() || undefined,
      kind: data.kind,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime || undefined,
      location: data.location?.trim() || undefined,
      scope: data.scope,
      departmentIds: data.scope === 'DEPARTMENTS' ? data.departmentIds : undefined,
      participants: merged,
      participantIds: merged.map(p => p.userId),
      chairedById: chair?.id,
      chairedByName: chair?.fullName,
      updatedAt: now(),
    };

    return commit(meetings.map(m => (m.id === id ? updated : m)), updated);
  };

  /** One person's mark. Called repeatedly while reading the roll aloud. */
  const markAttendance = async (
    meetingId: string,
    userId: string,
    mark: AttendanceMark,
    extra?: { minutesLate?: number; note?: string }
  ): Promise<boolean> => {
    const target = meetings.find(m => m.id === meetingId);
    if (!target || !currentUser) return false;

    if (!canManageMeetings(currentUser, activeRole)) {
      notify('error', 'Chỉ văn thư và Ban Giám Hiệu mới điểm danh được.');
      return false;
    }

    const updated: Meeting = {
      ...target,
      participants: target.participants.map(p =>
        p.userId === userId
          ? {
              ...p,
              mark,
              // Minutes belong to LATE only; carrying them over to another mark
              // would leave "vắng có phép, muộn 10 phút" in the record.
              minutesLate: mark === 'LATE' ? (extra?.minutesLate ?? p.minutesLate ?? 5) : undefined,
              note: extra?.note ?? p.note,
            }
          : p
      ),
      updatedAt: now(),
    };

    return commit(meetings.map(m => (m.id === meetingId ? updated : m)), updated);
  };

  /** Marks everyone not yet called as present — the usual end-of-roll shortcut. */
  const markRemainingPresent = async (meetingId: string): Promise<boolean> => {
    const target = meetings.find(m => m.id === meetingId);
    if (!target || !currentUser) return false;

    if (!canManageMeetings(currentUser, activeRole)) {
      notify('error', 'Chỉ văn thư và Ban Giám Hiệu mới điểm danh được.');
      return false;
    }

    const updated: Meeting = {
      ...target,
      participants: target.participants.map(p => (p.mark ? p : { ...p, mark: 'PRESENT' as AttendanceMark })),
      updatedAt: now(),
    };

    return commit(meetings.map(m => (m.id === meetingId ? updated : m)), updated);
  };

  const setMeetingStatus = async (
    id: string,
    status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  ): Promise<boolean> => {
    const target = meetings.find(m => m.id === id);
    if (!target || !currentUser) return false;

    if (!canManageMeetings(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền thay đổi cuộc họp.');
      return false;
    }

    const timestamp = now();
    const updated: Meeting = { ...target, status, updatedAt: timestamp };

    const ok = await commit(meetings.map(m => (m.id === id ? updated : m)), updated);
    if (!ok) return false;

    // A cancellation has to reach the people who were going to turn up.
    if (status === 'CANCELLED') {
      await Promise.all(
        target.participants
          .filter(p => p.userId !== currentUser.id)
          .map(p =>
            pushNotification({
              id: genId('NTF'),
              recipientUserId: p.userId,
              title: 'Cuộc họp đã bị hủy',
              message: `${target.title} — ${formatDateVi(target.date)} lúc ${target.startTime} đã bị hủy.`,
              type: 'SYSTEM',
              isRead: false,
              createdAt: timestamp,
            })
          )
      );
    }

    return true;
  };

  const saveMinutes = async (id: string, content: string): Promise<boolean> => {
    const target = meetings.find(m => m.id === id);
    if (!target || !currentUser) return false;

    if (!canManageMeetings(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền chốt biên bản.');
      return false;
    }
    if (!content.trim()) {
      notify('error', 'Nội dung biên bản không được để trống.');
      return false;
    }

    const timestamp = now();
    const updated: Meeting = {
      ...target,
      minutes: {
        content: content.trim(),
        finalizedAt: timestamp,
        finalizedById: currentUser.id,
        finalizedByName: currentUser.fullName,
      },
      // Writing up the minutes implies the meeting happened.
      status: target.status === 'SCHEDULED' ? 'COMPLETED' : target.status,
      updatedAt: timestamp,
    };

    return commit(meetings.map(m => (m.id === id ? updated : m)), updated);
  };

  const deleteMeeting = async (id: string): Promise<boolean> => {
    const previous = meetings;
    setMeetings(meetings.filter(m => m.id !== id));
    try {
      await firebaseService.deleteMeeting(id);
      return true;
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      setMeetings(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  return {
    createMeeting,
    updateMeeting,
    markAttendance,
    markRemainingPresent,
    setMeetingStatus,
    saveMinutes,
    deleteMeeting,
  };
}
