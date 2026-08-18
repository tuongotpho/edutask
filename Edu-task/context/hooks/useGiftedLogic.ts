import { useEffect, useRef } from 'react';
import { GiftedLesson, GiftedLessonStatus, GiftedProgram, GiftedProgramStatus } from '@/Edu-task/types/gifted';
import { User, RoleType } from '@/Edu-task/types/user';
import { genId } from '@/Edu-task/lib/utils';
import { currentSchoolId } from '@/Edu-task/lib/tenant';
import { canManageGifted } from '@/Edu-task/lib/permissions';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

interface GiftedLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  giftedPrograms: GiftedProgram[];
  setGiftedPrograms: React.Dispatch<React.SetStateAction<GiftedProgram[]>>;
  users: User[];
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được lên máy chủ. Thay đổi đã được hoàn tác — vui lòng thử lại.';

export interface GiftedProgramInput {
  title: string;
  subject: string;
  grade?: string;
  description?: string;
  departmentId?: string;
  coordinatorId: string;
  startDate: string;
  endDate: string;
  status?: GiftedProgramStatus;
}

export interface GiftedLessonInput {
  title: string;
  teacherId: string;
  scheduledDate?: string;
  durationPeriods?: number;
  roomName?: string;
  description?: string;
}

export function useGiftedLogic({
  currentUser,
  activeRole,
  giftedPrograms,
  setGiftedPrograms,
  users,
  notify,
}: GiftedLogicProps) {
  const now = () => new Date().toISOString().replace('T', ' ').slice(0, 16);

  /**
   * The teacher list the security rules read, derived from the lessons.
   *
   * Sorted and de-duplicated so the SAME set of teachers always produces the
   * identical array. That is not tidiness: Firestore's `affectedKeys()` compares
   * values, so an array that merely reordered would register as a changed field
   * — and the rule that lets a teacher confirm their own lesson pins exactly
   * which fields they may touch. Unstable ordering here would fail their write
   * for a field they never meant to change.
   */
  const teacherIdsFrom = (lessons: GiftedLesson[]): string[] =>
    Array.from(new Set(lessons.map(l => l.teacherId).filter(Boolean))).sort();

  /**
   * Backfills `teacherIds` onto programmes created before the field existed.
   *
   * Those documents predate the rule that lets an assigned teacher confirm
   * their own lesson, so without this they stay permanently broken for the
   * teacher — the rule reads an absent field as "no teachers" and refuses.
   *
   * Done from the app rather than as a migration script on purpose: the script
   * would need a service-account key set up before anyone could run it, for a
   * handful of documents, while a manager opening the module already holds
   * exactly the permission the write requires. It is idempotent and converges —
   * once a programme is patched, the comparison below stops matching it — and
   * it only ever writes the value derived from lessons that are already there,
   * so it cannot invent access that the roster does not already imply.
   */
  const backfilled = useRef(new Set<string>());

  useEffect(() => {
    if (!canManageGifted(currentUser, activeRole)) return;

    const stale = giftedPrograms.filter(p => {
      if (backfilled.current.has(p.id)) return false;
      const expected = teacherIdsFrom(p.lessons ?? []);
      const actual = p.teacherIds ?? [];
      return expected.join('|') !== actual.join('|');
    });
    if (stale.length === 0) return;

    for (const program of stale) {
      backfilled.current.add(program.id);
      const patched = { ...program, teacherIds: teacherIdsFrom(program.lessons ?? []) };
      firebaseService.saveGiftedProgram(patched).catch(err => {
        // Not surfaced as a toast: the manager did not ask for this, and the
        // only consequence of it failing is that it is retried next session.
        backfilled.current.delete(program.id);
        console.error(`[HSG] Không vá được teacherIds cho ${program.id}:`, err);
      });
    }
  }, [giftedPrograms, currentUser, activeRole]);

  const commitProgram = async (next: GiftedProgram[], toSave: GiftedProgram): Promise<boolean> => {
    const previous = giftedPrograms;
    setGiftedPrograms(next);
    try {
      await firebaseService.saveGiftedProgram(toSave);
      return true;
    } catch (err) {
      console.error('Failed to save gifted program:', err);
      setGiftedPrograms(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const createProgram = async (data: GiftedProgramInput): Promise<GiftedProgram | null> => {
    if (!currentUser) throw new Error('User not logged in');

    // Mirrors `allow create: if isAuth() && canManageGifted()` in firestore.rules.
    // Every other logic hook checks before writing (see useMeetingLogic,
    // useBookingLogic); this one took activeRole and never used it, so a caller
    // without the role got an opaque "không lưu được lên máy chủ" from the
    // rollback instead of being told why.
    if (!canManageGifted(currentUser, activeRole)) {
      notify('error', 'Bạn không có quyền tạo chương trình bồi dưỡng học sinh giỏi.');
      return null;
    }

    if (!data.title.trim()) {
      notify('error', 'Vui lòng nhập tên chương trình bồi dưỡng.');
      return null;
    }
    if (!data.subject.trim()) {
      notify('error', 'Vui lòng chọn môn học.');
      return null;
    }
    if (data.endDate < data.startDate) {
      notify('error', 'Ngày kết thúc phải sau ngày bắt đầu.');
      return null;
    }

    const coordinator = users.find(u => u.id === data.coordinatorId) || currentUser;

    const timestamp = now();
    const program: GiftedProgram = {
      id: genId('GIFTED_2026'),
      schoolId: currentSchoolId(),
      code: `BD-2026-${Date.now().toString().slice(-6)}`,
      title: data.title.trim(),
      subject: data.subject.trim(),
      grade: data.grade?.trim() || undefined,
      description: data.description?.trim() || undefined,
      departmentId: data.departmentId || currentUser.departmentId,
      departmentName: data.departmentId
        ? users.find(u => u.departmentId === data.departmentId)?.departmentName || currentUser.departmentName
        : currentUser.departmentName,
      coordinatorId: coordinator.id,
      coordinatorName: coordinator.fullName,
      lessons: [],
      teacherIds: [],
      status: data.status || 'IN_PROGRESS',
      startDate: data.startDate,
      endDate: data.endDate,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const ok = await commitProgram([...giftedPrograms, program], program);
    if (ok) {
      notify('success', `Đã tạo chương trình bồi dưỡng "${program.title}"`);
      return program;
    }
    return null;
  };

  const updateProgram = async (id: string, data: Partial<GiftedProgramInput>): Promise<boolean> => {
    const target = giftedPrograms.find(p => p.id === id);
    if (!target) return false;

    let coordinatorName = target.coordinatorName;
    if (data.coordinatorId && data.coordinatorId !== target.coordinatorId) {
      const coordinator = users.find(u => u.id === data.coordinatorId);
      if (coordinator) coordinatorName = coordinator.fullName;
    }

    const updated: GiftedProgram = {
      ...target,
      title: data.title?.trim() ?? target.title,
      subject: data.subject?.trim() ?? target.subject,
      grade: data.grade?.trim() ?? target.grade,
      description: data.description?.trim() ?? target.description,
      coordinatorId: data.coordinatorId ?? target.coordinatorId,
      coordinatorName,
      startDate: data.startDate ?? target.startDate,
      endDate: data.endDate ?? target.endDate,
      status: data.status ?? target.status,
      updatedAt: now(),
    };

    const ok = await commitProgram(giftedPrograms.map(p => (p.id === id ? updated : p)), updated);
    if (ok) notify('success', 'Đã cập nhật thông tin chương trình bồi dưỡng.');
    return ok;
  };

  const setProgramStatus = async (id: string, status: GiftedProgramStatus): Promise<boolean> => {
    const target = giftedPrograms.find(p => p.id === id);
    if (!target) return false;

    const updated: GiftedProgram = {
      ...target,
      status,
      updatedAt: now(),
    };

    return commitProgram(giftedPrograms.map(p => (p.id === id ? updated : p)), updated);
  };

  const deleteProgram = async (id: string): Promise<boolean> => {
    const previous = giftedPrograms;
    setGiftedPrograms(giftedPrograms.filter(p => p.id !== id));
    try {
      await firebaseService.deleteGiftedProgram(id);
      notify('success', 'Đã xóa chương trình bồi dưỡng.');
      return true;
    } catch (err) {
      console.error('Failed to delete gifted program:', err);
      setGiftedPrograms(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  // --- Lessons ---

  const addLesson = async (programId: string, data: GiftedLessonInput): Promise<boolean> => {
    const target = giftedPrograms.find(p => p.id === programId);
    if (!target) return false;

    if (!data.title.trim()) {
      notify('error', 'Vui lòng nhập tên tiết/chuyên đề.');
      return false;
    }
    if (!data.teacherId) {
      notify('error', 'Vui lòng chọn giáo viên giảng dạy.');
      return false;
    }

    const teacher = users.find(u => u.id === data.teacherId);
    const lesson: GiftedLesson = {
      id: genId('LES'),
      order: target.lessons.length + 1,
      title: data.title.trim(),
      teacherId: data.teacherId,
      teacherName: teacher ? teacher.fullName : 'Giáo viên',
      scheduledDate: data.scheduledDate || undefined,
      durationPeriods: data.durationPeriods || 1,
      roomName: data.roomName?.trim() || undefined,
      description: data.description?.trim() || undefined,
      status: 'PENDING',
    };

    const updated: GiftedProgram = {
      ...target,
      lessons: [...target.lessons, lesson],
      teacherIds: teacherIdsFrom([...target.lessons, lesson]),
      updatedAt: now(),
    };

    const ok = await commitProgram(giftedPrograms.map(p => (p.id === programId ? updated : p)), updated);
    if (ok) notify('success', `Đã thêm tiết/chuyên đề "${lesson.title}"`);
    return ok;
  };

  const updateLesson = async (
    programId: string,
    lessonId: string,
    data: Partial<GiftedLessonInput>
  ): Promise<boolean> => {
    const target = giftedPrograms.find(p => p.id === programId);
    if (!target) return false;

    const teacher = data.teacherId ? users.find(u => u.id === data.teacherId) : undefined;

    const updatedLessons = target.lessons.map(l => {
      if (l.id !== lessonId) return l;
      return {
        ...l,
        title: data.title?.trim() ?? l.title,
        teacherId: data.teacherId ?? l.teacherId,
        teacherName: teacher ? teacher.fullName : l.teacherName,
        scheduledDate: data.scheduledDate !== undefined ? data.scheduledDate : l.scheduledDate,
        durationPeriods: data.durationPeriods ?? l.durationPeriods,
        roomName: data.roomName?.trim() !== undefined ? data.roomName.trim() : l.roomName,
        description: data.description?.trim() !== undefined ? data.description.trim() : l.description,
      };
    });

    const updated: GiftedProgram = {
      ...target,
      lessons: updatedLessons,
      // Reassigning a lesson to a different teacher changes who may confirm it.
      teacherIds: teacherIdsFrom(updatedLessons),
      updatedAt: now(),
    };

    const ok = await commitProgram(giftedPrograms.map(p => (p.id === programId ? updated : p)), updated);
    if (ok) notify('success', 'Đã cập nhật chi tiết tiết học.');
    return ok;
  };

  const removeLesson = async (programId: string, lessonId: string): Promise<boolean> => {
    const target = giftedPrograms.find(p => p.id === programId);
    if (!target) return false;

    const updatedLessons = target.lessons
      .filter(l => l.id !== lessonId)
      .map((l, index) => ({ ...l, order: index + 1 }));

    const updated: GiftedProgram = {
      ...target,
      lessons: updatedLessons,
      // Removing the only lesson a teacher had also removes their access.
      teacherIds: teacherIdsFrom(updatedLessons),
      updatedAt: now(),
    };

    const ok = await commitProgram(giftedPrograms.map(p => (p.id === programId ? updated : p)), updated);
    if (ok) notify('success', 'Đã xóa tiết học khỏi chương trình.');
    return ok;
  };

  const completeLesson = async (
    programId: string,
    lessonId: string,
    note?: string
  ): Promise<boolean> => {
    const target = giftedPrograms.find(p => p.id === programId);
    if (!target || !currentUser) return false;

    const timestamp = now();
    const updatedLessons = target.lessons.map(l => {
      if (l.id !== lessonId) return l;
      return {
        ...l,
        status: 'COMPLETED' as GiftedLessonStatus,
        completedAt: timestamp,
        completedByUserId: currentUser.id,
        completedByUserName: currentUser.fullName,
        note: note?.trim() || l.note,
      };
    });

    // If all lessons completed, check if program status should automatically become COMPLETED
    const allDone = updatedLessons.length > 0 && updatedLessons.every(l => l.status === 'COMPLETED');

    const updated: GiftedProgram = {
      ...target,
      lessons: updatedLessons,
      status: allDone ? 'COMPLETED' : target.status,
      updatedAt: timestamp,
    };

    const ok = await commitProgram(giftedPrograms.map(p => (p.id === programId ? updated : p)), updated);
    if (ok) notify('success', 'Đã xác nhận hoàn thành tiết học!');
    return ok;
  };

  const reopenLesson = async (programId: string, lessonId: string): Promise<boolean> => {
    const target = giftedPrograms.find(p => p.id === programId);
    if (!target) return false;

    const timestamp = now();
    const updatedLessons = target.lessons.map(l => {
      if (l.id !== lessonId) return l;
      return {
        ...l,
        status: 'PENDING' as GiftedLessonStatus,
        completedAt: undefined,
        completedByUserId: undefined,
        completedByUserName: undefined,
      };
    });

    const updated: GiftedProgram = {
      ...target,
      lessons: updatedLessons,
      status: target.status === 'COMPLETED' ? 'IN_PROGRESS' : target.status,
      updatedAt: timestamp,
    };

    const ok = await commitProgram(giftedPrograms.map(p => (p.id === programId ? updated : p)), updated);
    if (ok) notify('success', 'Đã chuyển tiết học về trạng thái chưa hoàn thành.');
    return ok;
  };

  return {
    createProgram,
    updateProgram,
    setProgramStatus,
    deleteProgram,
    addLesson,
    updateLesson,
    removeLesson,
    completeLesson,
    reopenLesson,
  };
}
