import {
  ClassAttendance,
  ConductKind,
  ConductCategory,
  ConductRecord,
  Gender,
  Student,
  StudentAttendanceEntry,
  StudentMark,
  classAttendanceId,
} from '@/Edu-task/types/student';
import { ClassGroup, SchoolSession } from '@/Edu-task/types/schedule';
import { User, RoleType } from '@/Edu-task/types/user';
import { genId } from '@/Edu-task/lib/utils';
import { currentSchoolId } from '@/Edu-task/lib/tenant';
import { tallyEntries, studentsInClass } from '@/Edu-task/lib/studentStats';
import {
  canManageStudents,
  canRecordConduct,
  canRecordStudentAttendance,
} from '@/Edu-task/lib/permissions';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

/**
 * Hồ sơ học sinh, điểm danh và nền nếp.
 *
 * The roll is built from the CURRENT roster each time it is opened, but once
 * saved the entries are a snapshot. A child who transfers out in March must
 * still appear in February's register — rebuilding old rolls from today's
 * roster would quietly rewrite history.
 */

interface StudentLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  classes: ClassGroup[];
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  studentAttendance: ClassAttendance[];
  setStudentAttendance: React.Dispatch<React.SetStateAction<ClassAttendance[]>>;
  conduct: ConductRecord[];
  setConduct: React.Dispatch<React.SetStateAction<ConductRecord[]>>;
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được lên máy chủ. Thay đổi đã được hoàn tác — vui lòng thử lại.';

export interface StudentInput {
  code: string;
  fullName: string;
  classId: string;
  dateOfBirth?: string;
  gender?: Gender;
  parentName?: string;
  parentPhone?: string;
  needsSupport: boolean;
  supportNote?: string;
  isActive: boolean;
}

export interface ConductInput {
  studentId: string;
  kind: ConductKind;
  category: ConductCategory;
  description: string;
  points: number;
  date: string;
}

export function useStudentLogic({
  currentUser, activeRole, classes,
  students, setStudents,
  studentAttendance, setStudentAttendance,
  conduct, setConduct,
  notify,
}: StudentLogicProps) {

  const now = () => new Date().toISOString().replace('T', ' ').slice(0, 16);

  // --- Roster --------------------------------------------------------------

  const commitStudents = async (next: Student[], toSave: Student): Promise<boolean> => {
    const previous = students;
    setStudents(next);
    try {
      await firebaseService.saveStudent(toSave);
      return true;
    } catch (err) {
      console.error('Failed to save student:', err);
      setStudents(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const createStudent = async (data: StudentInput): Promise<Student | null> => {
    if (!currentUser) throw new Error('User not logged in');
    if (!canManageStudents(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền sửa hồ sơ học sinh.');
      return null;
    }

    const classGroup = classes.find(c => c.id === data.classId);
    if (!classGroup) {
      notify('error', 'Vui lòng chọn lớp.');
      return null;
    }
    if (!data.fullName.trim()) {
      notify('error', 'Vui lòng nhập họ tên học sinh.');
      return null;
    }

    const code = data.code.trim();
    if (code && students.some(s => s.code === code)) {
      notify('error', `Mã học sinh "${code}" đã tồn tại.`);
      return null;
    }

    const timestamp = now();
    const student: Student = {
      id: genId('STU_2026'),
      schoolId: currentSchoolId(),
      code,
      fullName: data.fullName.trim(),
      classId: classGroup.id,
      className: classGroup.name,
      dateOfBirth: data.dateOfBirth || undefined,
      gender: data.gender,
      parentName: data.parentName?.trim() || undefined,
      parentPhone: data.parentPhone?.trim() || undefined,
      needsSupport: data.needsSupport,
      supportNote: data.supportNote?.trim() || undefined,
      isActive: data.isActive,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return (await commitStudents([...students, student], student)) ? student : null;
  };

  const updateStudent = async (id: string, data: StudentInput): Promise<boolean> => {
    const target = students.find(s => s.id === id);
    if (!target || !currentUser) return false;
    if (!canManageStudents(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền sửa hồ sơ học sinh.');
      return false;
    }

    const classGroup = classes.find(c => c.id === data.classId);
    const code = data.code.trim();
    if (code && students.some(s => s.id !== id && s.code === code)) {
      notify('error', `Mã học sinh "${code}" đã tồn tại.`);
      return false;
    }

    const updated: Student = {
      ...target,
      code,
      fullName: data.fullName.trim(),
      classId: classGroup?.id ?? target.classId,
      className: classGroup?.name ?? target.className,
      dateOfBirth: data.dateOfBirth || undefined,
      gender: data.gender,
      parentName: data.parentName?.trim() || undefined,
      parentPhone: data.parentPhone?.trim() || undefined,
      needsSupport: data.needsSupport,
      supportNote: data.supportNote?.trim() || undefined,
      isActive: data.isActive,
      updatedAt: now(),
    };

    return commitStudents(students.map(s => (s.id === id ? updated : s)), updated);
  };

  /**
   * Removing a student. Blocked while any record still names them — a conduct
   * record pointing at a deleted child is unexplainable to whoever reads it
   * later, and a register missing a name it once had is worse than useless.
   * Marking them inactive is the right move for someone who has left.
   */
  const deleteStudent = async (id: string): Promise<boolean> => {
    const conductCount = conduct.filter(c => c.studentId === id).length;
    if (conductCount > 0) {
      notify(
        'error',
        `Không thể xóa: còn ${conductCount} bản ghi nền nếp về học sinh này. ` +
        'Hãy bỏ tick "Đang học" thay vì xóa để giữ lại hồ sơ.'
      );
      return false;
    }

    const previous = students;
    setStudents(students.filter(s => s.id !== id));
    try {
      await firebaseService.deleteStudent(id);
      return true;
    } catch (err) {
      console.error('Failed to delete student:', err);
      setStudents(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  // --- Điểm danh -----------------------------------------------------------

  /** The saved roll for a class-session, or null if nobody has taken it yet. */
  const findRoll = (classId: string, date: string, session: SchoolSession): ClassAttendance | null =>
    studentAttendance.find(r => r.id === classAttendanceId(classId, date, session)) ?? null;

  /**
   * The roll to display: the saved one if it exists, otherwise a fresh sheet
   * built from the current roster with everyone marked present. Starting from
   * "all present" rather than blank is what makes a register take ten seconds
   * — the teacher only touches the exceptions.
   */
  const buildRoll = (
    classId: string,
    date: string,
    session: SchoolSession
  ): StudentAttendanceEntry[] => {
    const existing = findRoll(classId, date, session);
    if (existing) return existing.entries;

    return studentsInClass(students, classId).map(student => ({
      studentId: student.id,
      studentName: student.fullName,
      mark: 'PRESENT' as StudentMark,
    }));
  };

  const saveRoll = async (
    classId: string,
    date: string,
    session: SchoolSession,
    entries: StudentAttendanceEntry[]
  ): Promise<boolean> => {
    if (!currentUser) return false;
    if (!canRecordStudentAttendance(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền điểm danh học sinh.');
      return false;
    }

    const classGroup = classes.find(c => c.id === classId);
    if (!classGroup) {
      notify('error', 'Lớp không còn trong danh mục.');
      return false;
    }
    if (entries.length === 0) {
      notify('error', 'Lớp này chưa có học sinh nào trong danh sách.');
      return false;
    }

    const id = classAttendanceId(classId, date, session);
    const existing = findRoll(classId, date, session);
    const timestamp = now();

    const record: ClassAttendance = {
      id,
      schoolId: currentSchoolId(),
      classId: classGroup.id,
      className: classGroup.name,
      date,
      session,
      entries,
      ...tallyEntries(entries),
      recordedById: currentUser.id,
      recordedByName: currentUser.fullName,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    const previous = studentAttendance;
    setStudentAttendance(
      existing
        ? studentAttendance.map(r => (r.id === id ? record : r))
        : [record, ...studentAttendance]
    );

    try {
      await firebaseService.saveClassAttendance(record);
      return true;
    } catch (err) {
      console.error('Failed to save class attendance:', err);
      setStudentAttendance(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  // --- Nền nếp học sinh -----------------------------------------------------

  const recordConduct = async (data: ConductInput): Promise<ConductRecord | null> => {
    if (!currentUser) throw new Error('User not logged in');
    if (!canRecordConduct(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền ghi nhận nền nếp học sinh.');
      return null;
    }

    const student = students.find(s => s.id === data.studentId);
    if (!student) {
      notify('error', 'Vui lòng chọn học sinh.');
      return null;
    }
    if (!data.description.trim()) {
      notify('error', 'Vui lòng mô tả nội dung.');
      return null;
    }

    const timestamp = now();
    const record: ConductRecord = {
      id: genId('CDT_2026'),
      schoolId: currentSchoolId(),
      studentId: student.id,
      studentName: student.fullName,
      classId: student.classId,
      className: student.className,
      kind: data.kind,
      category: data.category,
      description: data.description.trim(),
      // Stored positive whatever the form sent; `kind` carries the direction.
      points: Math.abs(data.points ?? 0),
      date: data.date,
      recordedById: currentUser.id,
      recordedByName: currentUser.fullName,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const previous = conduct;
    setConduct([record, ...conduct]);

    try {
      await firebaseService.saveConduct(record);
      return record;
    } catch (err) {
      console.error('Failed to save conduct record:', err);
      setConduct(previous);
      notify('error', SAVE_FAILED);
      return null;
    }
  };

  const deleteConduct = async (id: string): Promise<boolean> => {
    const target = conduct.find(c => c.id === id);
    if (!target || !currentUser) return false;

    const previous = conduct;
    setConduct(conduct.filter(c => c.id !== id));

    try {
      await firebaseService.deleteConduct(id);
      return true;
    } catch (err) {
      console.error('Failed to delete conduct record:', err);
      setConduct(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  return {
    createStudent, updateStudent, deleteStudent,
    findRoll, buildRoll, saveRoll,
    recordConduct, deleteConduct,
  };
}
