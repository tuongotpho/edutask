import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  onSnapshot as onSnapshotRaw,
  writeBatch,
  Unsubscribe,
  query,
  where,
  Query,
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/Edu-task/lib/firebase';
import { sanitizeForFirestore } from '@/Edu-task/lib/utils';
import { User, Department } from '@/Edu-task/types/user';
import { LeaveRequest } from '@/Edu-task/types/leave';
import { Task } from '@/Edu-task/types/task';
import { AppNotification } from '@/Edu-task/types/notification';
import { WorkflowConfig, TelegramConfig } from '@/Edu-task/types/settings';
import {
  ClassGroup,
  DEFAULT_PERIOD_CONFIG,
  PeriodConfig,
  Room,
} from '@/Edu-task/types/schedule';
import { MakeupClass } from '@/Edu-task/types/makeup';
import { RoomBooking } from '@/Edu-task/types/booking';
import { AttendanceRecord } from '@/Edu-task/types/attendance';
import { Meeting } from '@/Edu-task/types/meeting';
import { Plan } from '@/Edu-task/types/plan';
import { ReminderSchedule } from '@/Edu-task/types/reminder';
import { Equipment, EquipmentLoan } from '@/Edu-task/types/equipment';
import { ClassAttendance, ConductRecord, Student } from '@/Edu-task/types/student';
import { GiftedProgram } from '@/Edu-task/types/gifted';
import { Invitation, invitationKey } from '@/Edu-task/types/invitation';

/**
 * `onSnapshot` with an error handler — always.
 *
 * A Firestore listener created without one does not warn and does not retry: on
 * `permission-denied` it simply stops, and the state it feeds never updates
 * again. The screen waiting on that data therefore shows its loading state
 * forever, which reads to the user as the tab having frozen rather than as a
 * permissions problem — and leaves nothing in the console to diagnose it with.
 *
 * Every listener in this file went out that way. Rather than add a third
 * argument to twenty-six call sites, the import is aliased and `onSnapshot`
 * below shadows it, so each call keeps its original shape and none can be
 * written without a handler by accident.
 *
 * This makes the failure VISIBLE, not harmless: a denied listener still leaves
 * its screen without data. The console line names the path so the next person
 * can go straight to the rule that refused it.
 */
function describeTarget(target: unknown): string {
  const path = (target as { path?: string }).path;
  if (typeof path === 'string') return path;
  // A Query keeps its collection path internally; best-effort, never throws.
  const internal = (target as { _query?: { path?: { toString(): string } } })._query?.path;
  return internal ? `${internal.toString()} (query)` : 'unknown path';
}

function onSnapshot(
  target: DocumentReference<DocumentData>,
  next: (snapshot: DocumentSnapshot<DocumentData>) => void
): Unsubscribe;
function onSnapshot(
  target: Query<DocumentData> | CollectionReference<DocumentData>,
  next: (snapshot: QuerySnapshot<DocumentData>) => void
): Unsubscribe;
function onSnapshot(
  target: DocumentReference<DocumentData> | Query<DocumentData>,
  next: (snapshot: never) => void
): Unsubscribe {
  return onSnapshotRaw(
    target as Query<DocumentData>,
    next as (snapshot: QuerySnapshot<DocumentData>) => void,
    err => {
      console.error(
        `[Firestore] Mất kết nối dữ liệu "${describeTarget(target)}" — ${err.code}: ${err.message}`
      );
    }
  );
}

export const firebaseService = {
  // --- Departments (shared config: must live server-side so every device and
  // every user sees the same list, not just whoever created it) ---
  subscribeDepartments(onUpdate: (departments: Department[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'departments'), (snapshot) => {
      const departments: Department[] = [];
      snapshot.forEach((d) => departments.push(d.data() as Department));
      departments.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      onUpdate(departments);
    });
  },

  async saveDepartment(department: Department): Promise<void> {
    await setDoc(doc(db, 'departments', department.id), sanitizeForFirestore(department), { merge: true });
  },

  async deleteDepartment(departmentId: string): Promise<void> {
    await deleteDoc(doc(db, 'departments', departmentId));
  },

  // One-off migration of the built-in defaults the very first time this project
  // runs against an empty `departments` collection. Batched so it either lands
  // completely or not at all.
  async seedDepartments(departments: Department[]): Promise<void> {
    const batch = writeBatch(db);
    departments.forEach(d => {
      batch.set(doc(db, 'departments', d.id), sanitizeForFirestore(d));
    });
    await batch.commit();
  },

  // --- School settings ---
  subscribeSchoolName(onUpdate: (name: string | null) => void): Unsubscribe {
    return onSnapshot(doc(db, 'settings', 'school'), (snapshot) => {
      const data = snapshot.data();
      onUpdate(typeof data?.name === 'string' ? data.name : null);
    });
  },

  async saveSchoolName(name: string): Promise<void> {
    await setDoc(doc(db, 'settings', 'school'), { name }, { merge: true });
  },

  // Approval-flow configuration. Falls back to null so callers can apply their
  // own defaults rather than guessing from a partially written document.
  subscribeWorkflowConfig(onUpdate: (config: WorkflowConfig | null) => void): Unsubscribe {
    return onSnapshot(doc(db, 'settings', 'workflow'), snapshot => {
      const data = snapshot.data();
      if (!data || typeof data.deptOnlyMaxDays !== 'number') {
        onUpdate(null);
        return;
      }
      onUpdate({
        deptOnlyMaxDays: data.deptOnlyMaxDays,
        alwaysExecutiveTypes: Array.isArray(data.alwaysExecutiveTypes) ? data.alwaysExecutiveTypes : [],
      });
    });
  },

  async saveWorkflowConfig(config: WorkflowConfig): Promise<void> {
    await setDoc(doc(db, 'settings', 'workflow'), sanitizeForFirestore(config), { merge: true });
  },

  subscribeTelegramConfig(onUpdate: (config: TelegramConfig | null) => void): Unsubscribe {
    return onSnapshot(doc(db, 'settings', 'telegram'), snapshot => {
      const data = snapshot.data();
      if (!data) {
        onUpdate(null);
        return;
      }
      onUpdate({
        enabled: !!data.enabled,
        botToken: typeof data.botToken === 'string' ? data.botToken : '',
        chatId: typeof data.chatId === 'string' ? data.chatId : '',
        events: {
          LEAVE_CREATED: data.events?.LEAVE_CREATED !== false,
          LEAVE_DECIDED: data.events?.LEAVE_DECIDED !== false,
          TASK_ASSIGNED: data.events?.TASK_ASSIGNED !== false,
        },
      });
    });
  },

  async saveTelegramConfig(config: TelegramConfig): Promise<void> {
    await setDoc(doc(db, 'settings', 'telegram'), sanitizeForFirestore(config), { merge: true });
  },

  /**
   * How many teaching periods the school runs, and when. Every module finer
   * than a whole session (make-up classes, room bookings, the lateness log)
   * reads this, so it is shared config rather than per-feature settings.
   */
  subscribePeriodConfig(onUpdate: (config: PeriodConfig | null) => void): Unsubscribe {
    return onSnapshot(doc(db, 'settings', 'periods'), snapshot => {
      const data = snapshot.data();
      if (!data || typeof data.morningPeriods !== 'number') {
        onUpdate(null);
        return;
      }
      onUpdate({
        morningPeriods: data.morningPeriods,
        afternoonPeriods: typeof data.afternoonPeriods === 'number' ? data.afternoonPeriods : 0,
        // Falling back to the built-in timetable rather than `{}` keeps period
        // labels and "which period is on now" working on a school that has
        // never opened the settings screen.
        times: data.times && typeof data.times === 'object' ? data.times : DEFAULT_PERIOD_CONFIG.times,
      });
    });
  },

  async savePeriodConfig(config: PeriodConfig): Promise<void> {
    await setDoc(doc(db, 'settings', 'periods'), sanitizeForFirestore(config), { merge: true });
  },

  // --- Rooms & classes (shared catalogs, same server-owned shape as departments) ---
  subscribeRooms(onUpdate: (rooms: Room[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'rooms'), snapshot => {
      const rooms: Room[] = [];
      snapshot.forEach(d => rooms.push(d.data() as Room));
      onUpdate(rooms);
    });
  },

  async saveRoom(room: Room): Promise<void> {
    await setDoc(doc(db, 'rooms', room.id), sanitizeForFirestore(room), { merge: true });
  },

  async deleteRoom(roomId: string): Promise<void> {
    await deleteDoc(doc(db, 'rooms', roomId));
  },

  subscribeClasses(onUpdate: (classes: ClassGroup[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'classes'), snapshot => {
      const classes: ClassGroup[] = [];
      snapshot.forEach(d => classes.push(d.data() as ClassGroup));
      onUpdate(classes);
    });
  },

  async saveClass(classGroup: ClassGroup): Promise<void> {
    await setDoc(doc(db, 'classes', classGroup.id), sanitizeForFirestore(classGroup), { merge: true });
  },

  async deleteClass(classId: string): Promise<void> {
    await deleteDoc(doc(db, 'classes', classId));
  },

  // --- Users ---
  subscribeUsers(onUpdate: (users: User[]) => void): Unsubscribe {
    // The users collection is small and needed everywhere (dropdowns to assign
    // tasks/leaves), so we fetch all of them.
    const q: Query<DocumentData> = collection(db, 'users');
    return onSnapshot(q, (snapshot) => {
      const users: User[] = [];
      snapshot.forEach((d) => users.push(d.data() as User));
      onUpdate(users);
    });
  },

  async saveUser(user: User): Promise<void> {
    await setDoc(doc(db, 'users', user.id), sanitizeForFirestore(user), { merge: true });
  },

  async deleteUser(userId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId));
  },

  // --- Leaves ---
  subscribeLeaves(onUpdate: (leaves: LeaveRequest[]) => void, filters?: { role?: string; deptId?: string; userId?: string }): Unsubscribe {
    const base = collection(db, 'leaves');
    const sortNewestFirst = (leaves: LeaveRequest[]) =>
      leaves.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const toLeaves = (snapshot: { forEach: (cb: (d: { data: () => DocumentData }) => void) => void }) => {
      const leaves: LeaveRequest[] = [];
      snapshot.forEach(d => leaves.push(d.data() as LeaveRequest));
      return leaves;
    };

    // A teacher must see the requests they filed AND the ones they were asked to
    // cover. Firestore cannot express that as a single equality filter, so we run
    // both queries and merge. (An `or()` query would read better but can require
    // its own composite index; two plain equality filters are always servable.)
    //
    // Without the second query a substitute teacher never received the document
    // at all, so the assignment was invisible to them no matter what the UI or
    // the security rules allowed.
    if (filters?.role === 'TEACHER' && filters.userId) {
      let asApplicant: LeaveRequest[] = [];
      let asSubstitute: LeaveRequest[] = [];

      const emit = () => {
        const byId = new Map<string, LeaveRequest>();
        [...asApplicant, ...asSubstitute].forEach(l => byId.set(l.id, l));
        onUpdate(sortNewestFirst(Array.from(byId.values())));
      };

      const unsubApplicant = onSnapshot(
        query(base, where('applicantId', '==', filters.userId)),
        snapshot => { asApplicant = toLeaves(snapshot); emit(); }
      );
      const unsubSubstitute = onSnapshot(
        query(base, where('substituteTeacherId', '==', filters.userId)),
        snapshot => { asSubstitute = toLeaves(snapshot); emit(); }
      );

      return () => { unsubApplicant(); unsubSubstitute(); };
    }

    // Applying basic frontend limits based on role to prevent massive fetches.
    // Firestore security rules enforce the real boundary on the backend.
    let q: Query<DocumentData> = base;
    if (filters?.role === 'GROUP_LEADER' || filters?.role === 'HEAD_OF_DEPT') {
      q = query(q, where('departmentId', '==', filters.deptId));
    }

    return onSnapshot(q, (snapshot) => {
      onUpdate(sortNewestFirst(toLeaves(snapshot)));
    });
  },

  async saveLeave(leave: LeaveRequest): Promise<void> {
    await setDoc(doc(db, 'leaves', leave.id), sanitizeForFirestore(leave), { merge: true });
  },

  async deleteLeave(leaveId: string): Promise<void> {
    await deleteDoc(doc(db, 'leaves', leaveId));
  },

  // --- Tasks ---
  subscribeTasks(onUpdate: (tasks: Task[]) => void, filters?: { role?: string; deptId?: string; userId?: string }): Unsubscribe {
    let q: Query<DocumentData> = collection(db, 'tasks');

    if (filters) {
      if (filters.role !== 'ADMIN' && filters.userId) {
        q = query(q, where('viewerIds', 'array-contains', filters.userId));
      }
    }

    return onSnapshot(q, (snapshot) => {
      const tasks: Task[] = [];
      snapshot.forEach((d) => {
        tasks.push(d.data() as Task);
      });
      tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(tasks);
    });
  },

  async saveTask(task: Task): Promise<void> {
    await setDoc(doc(db, 'tasks', task.id), sanitizeForFirestore(task), { merge: true });
  },

  // Write failures must propagate: callers roll back their optimistic update and
  // tell the user. Swallowing the error here would silently desync the UI.
  async deleteTask(taskId: string): Promise<void> {
    await deleteDoc(doc(db, 'tasks', taskId));
  },

  // --- Make-up classes & room bookings ---
  //
  // Both are scoped to a rolling date window rather than fetched whole. These
  // collections grow by hundreds of rows a term and never stop, while the only
  // rows anyone acts on are recent or upcoming ones — an unbounded subscription
  // would grow the client's memory and read cost every single term.
  //
  // The window has no upper bound: a booking made for next June must still be
  // visible, or the clash check would happily double-book it.

  subscribeMakeups(onUpdate: (makeups: MakeupClass[]) => void, fromDate: string): Unsubscribe {
    const q = query(collection(db, 'makeups'), where('makeupSlot.date', '>=', fromDate));
    return onSnapshot(q, snapshot => {
      const makeups: MakeupClass[] = [];
      snapshot.forEach(d => makeups.push(d.data() as MakeupClass));
      makeups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(makeups);
    });
  },

  async saveMakeup(makeup: MakeupClass): Promise<void> {
    await setDoc(doc(db, 'makeups', makeup.id), sanitizeForFirestore(makeup), { merge: true });
  },

  async deleteMakeup(makeupId: string): Promise<void> {
    await deleteDoc(doc(db, 'makeups', makeupId));
  },

  subscribeBookings(onUpdate: (bookings: RoomBooking[]) => void, fromDate: string): Unsubscribe {
    const q = query(collection(db, 'bookings'), where('slot.date', '>=', fromDate));
    return onSnapshot(q, snapshot => {
      const bookings: RoomBooking[] = [];
      snapshot.forEach(d => bookings.push(d.data() as RoomBooking));
      bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(bookings);
    });
  },

  async saveBooking(booking: RoomBooking): Promise<void> {
    await setDoc(doc(db, 'bookings', booking.id), sanitizeForFirestore(booking), { merge: true });
  },

  async deleteBooking(bookingId: string): Promise<void> {
    await deleteDoc(doc(db, 'bookings', bookingId));
  },

  // --- Sổ nền nếp (supervisor's lateness log) ---
  //
  // Scoped by BOTH date and audience. Unlike bookings, these records are about
  // named colleagues, so the query is narrowed to what the viewer is entitled
  // to see rather than relying on the UI to hide rows — a teacher's browser
  // should never receive the whole school's log in the first place.
  subscribeAttendance(
    onUpdate: (records: AttendanceRecord[]) => void,
    fromDate: string,
    scope: { seeAll: boolean; deptId?: string; userId?: string }
  ): Unsubscribe {
    const base = collection(db, 'attendance');
    const sortNewestFirst = (records: AttendanceRecord[]) =>
      records.sort((a, b) => (b.slot?.date ?? '').localeCompare(a.slot?.date ?? '') ||
        (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    const toRecords = (snapshot: { forEach: (cb: (d: { data: () => DocumentData }) => void) => void }) => {
      const records: AttendanceRecord[] = [];
      snapshot.forEach(d => records.push(d.data() as AttendanceRecord));
      return records;
    };

    let q: Query<DocumentData> = query(base, where('slot.date', '>=', fromDate));

    if (!scope.seeAll) {
      if (scope.deptId) {
        // A department leader sees their department's log.
        q = query(q, where('departmentId', '==', scope.deptId));
      } else if (scope.userId) {
        // Everyone else sees only records naming them.
        q = query(q, where('teacherId', '==', scope.userId));
      } else {
        onUpdate([]);
        return () => {};
      }
    }

    return onSnapshot(q, snapshot => onUpdate(sortNewestFirst(toRecords(snapshot))));
  },

  async saveAttendance(record: AttendanceRecord): Promise<void> {
    await setDoc(doc(db, 'attendance', record.id), sanitizeForFirestore(record), { merge: true });
  },

  async deleteAttendance(recordId: string): Promise<void> {
    await deleteDoc(doc(db, 'attendance', recordId));
  },

  // --- Cuộc họp ---
  subscribeMeetings(
    onUpdate: (meetings: Meeting[]) => void,
    fromDate: string,
    scope: { seeAll: boolean; userId?: string }
  ): Unsubscribe {
    const base = collection(db, 'meetings');

    // Leadership reads by date window. Everyone else reads by membership —
    // and deliberately WITHOUT a date filter, because combining
    // `array-contains` with a range on another field needs a dedicated
    // composite index, which would fail closed on a fresh project until
    // someone noticed the console error. Meetings number in the dozens per
    // year, so trimming the window client-side costs nothing.
    const q: Query<DocumentData> = scope.seeAll
      ? query(base, where('date', '>=', fromDate))
      : scope.userId
        ? query(base, where('participantIds', 'array-contains', scope.userId))
        : base;

    if (!scope.seeAll && !scope.userId) {
      onUpdate([]);
      return () => {};
    }

    return onSnapshot(q, snapshot => {
      const meetings: Meeting[] = [];
      snapshot.forEach(d => {
        const meeting = d.data() as Meeting;
        if ((meeting.date ?? '') >= fromDate) meetings.push(meeting);
      });
      meetings.sort((a, b) =>
        (b.date ?? '').localeCompare(a.date ?? '') ||
        (b.startTime ?? '').localeCompare(a.startTime ?? '')
      );
      onUpdate(meetings);
    });
  },

  async saveMeeting(meeting: Meeting): Promise<void> {
    await setDoc(doc(db, 'meetings', meeting.id), sanitizeForFirestore(meeting), { merge: true });
  },

  async deleteMeeting(meetingId: string): Promise<void> {
    await deleteDoc(doc(db, 'meetings', meetingId));
  },

  // --- Kế hoạch & lịch nhắc ---
  //
  // Both are small, school-wide reference data that every screen showing
  // progress needs, so they are fetched whole rather than windowed. A school
  // runs tens of plans, not thousands.
  subscribePlans(onUpdate: (plans: Plan[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'plans'), snapshot => {
      const plans: Plan[] = [];
      snapshot.forEach(d => plans.push(d.data() as Plan));
      plans.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
      onUpdate(plans);
    });
  },

  async savePlan(plan: Plan): Promise<void> {
    await setDoc(doc(db, 'plans', plan.id), sanitizeForFirestore(plan), { merge: true });
  },

  async deletePlan(planId: string): Promise<void> {
    await deleteDoc(doc(db, 'plans', planId));
  },

  subscribeReminders(onUpdate: (reminders: ReminderSchedule[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'reminders'), snapshot => {
      const reminders: ReminderSchedule[] = [];
      snapshot.forEach(d => reminders.push(d.data() as ReminderSchedule));
      reminders.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
      onUpdate(reminders);
    });
  },

  async saveReminder(reminder: ReminderSchedule): Promise<void> {
    await setDoc(doc(db, 'reminders', reminder.id), sanitizeForFirestore(reminder), { merge: true });
  },

  async deleteReminder(reminderId: string): Promise<void> {
    await deleteDoc(doc(db, 'reminders', reminderId));
  },

  // --- Thiết bị & phiếu mượn ---
  subscribeEquipment(onUpdate: (items: Equipment[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'equipment'), snapshot => {
      const items: Equipment[] = [];
      snapshot.forEach(d => items.push(d.data() as Equipment));
      onUpdate(items);
    });
  },

  async saveEquipment(item: Equipment): Promise<void> {
    await setDoc(doc(db, 'equipment', item.id), sanitizeForFirestore(item), { merge: true });
  },

  async deleteEquipment(equipmentId: string): Promise<void> {
    await deleteDoc(doc(db, 'equipment', equipmentId));
  },

  /**
   * Loans are windowed by `borrowDate`, but the window has to be generous:
   * availability is computed from OPEN loans, so dropping an old one that was
   * never returned would silently free up kit that is still missing. A year
   * back keeps the register honest without unbounded growth.
   */
  subscribeLoans(onUpdate: (loans: EquipmentLoan[]) => void, fromDate: string): Unsubscribe {
    const q = query(collection(db, 'equipmentLoans'), where('borrowDate', '>=', fromDate));
    return onSnapshot(q, snapshot => {
      const loans: EquipmentLoan[] = [];
      snapshot.forEach(d => loans.push(d.data() as EquipmentLoan));
      loans.sort((a, b) => (b.borrowDate ?? '').localeCompare(a.borrowDate ?? ''));
      onUpdate(loans);
    });
  },

  async saveLoan(loan: EquipmentLoan): Promise<void> {
    await setDoc(doc(db, 'equipmentLoans', loan.id), sanitizeForFirestore(loan), { merge: true });
  },

  async deleteLoan(loanId: string): Promise<void> {
    await deleteDoc(doc(db, 'equipmentLoans', loanId));
  },

  // --- Học sinh ---
  //
  // The roster is fetched whole: a school has hundreds of students, not
  // millions, and every register screen needs the full list to build a roll.
  subscribeStudents(onUpdate: (students: Student[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'students'), snapshot => {
      const students: Student[] = [];
      snapshot.forEach(d => students.push(d.data() as Student));
      students.sort(
        (a, b) =>
          a.className.localeCompare(b.className, 'vi', { numeric: true }) ||
          a.fullName.localeCompare(b.fullName, 'vi')
      );
      onUpdate(students);
    });
  },

  async saveStudent(student: Student): Promise<void> {
    await setDoc(doc(db, 'students', student.id), sanitizeForFirestore(student), { merge: true });
  },

  async deleteStudent(studentId: string): Promise<void> {
    await deleteDoc(doc(db, 'students', studentId));
  },

  // Rolls are the highest-volume collection in the system — one per class per
  // session per school day — so they are windowed by date rather than fetched
  // whole. Nobody edits last term's register.
  subscribeClassAttendance(
    onUpdate: (records: ClassAttendance[]) => void,
    fromDate: string
  ): Unsubscribe {
    const q = query(collection(db, 'studentAttendance'), where('date', '>=', fromDate));
    return onSnapshot(q, snapshot => {
      const records: ClassAttendance[] = [];
      snapshot.forEach(d => records.push(d.data() as ClassAttendance));
      records.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      onUpdate(records);
    });
  },

  async saveClassAttendance(record: ClassAttendance): Promise<void> {
    await setDoc(doc(db, 'studentAttendance', record.id), sanitizeForFirestore(record), { merge: true });
  },

  subscribeConduct(onUpdate: (records: ConductRecord[]) => void, fromDate: string): Unsubscribe {
    const q = query(collection(db, 'studentConduct'), where('date', '>=', fromDate));
    return onSnapshot(q, snapshot => {
      const records: ConductRecord[] = [];
      snapshot.forEach(d => records.push(d.data() as ConductRecord));
      records.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      onUpdate(records);
    });
  },

  async saveConduct(record: ConductRecord): Promise<void> {
    await setDoc(doc(db, 'studentConduct', record.id), sanitizeForFirestore(record), { merge: true });
  },

  async deleteConduct(recordId: string): Promise<void> {
    await deleteDoc(doc(db, 'studentConduct', recordId));
  },

  // --- Notifications ---
  subscribeNotifications(onUpdate: (notifs: AppNotification[]) => void, userId?: string): Unsubscribe {
    let q: Query<DocumentData> = collection(db, 'notifications');

    if (userId) {
      q = query(q, where('recipientUserId', '==', userId));
    }

    return onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      snapshot.forEach((d) => {
        notifs.push(d.data() as AppNotification);
      });
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(notifs);
    });
  },

  async saveNotification(notif: AppNotification): Promise<void> {
    await setDoc(doc(db, 'notifications', notif.id), sanitizeForFirestore(notif), { merge: true });
  },

  // Security rules only permit the recipient to touch `isRead`, so this is a
  // targeted update rather than a whole-document write.
  async markNotificationRead(notifId: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', notifId), { isRead: true });
  },

  async markAllNotificationsRead(notifIds: string[]): Promise<void> {
    if (notifIds.length === 0) return;
    const batch = writeBatch(db);
    notifIds.forEach(id => batch.update(doc(db, 'notifications', id), { isRead: true }));
    await batch.commit();
  },

  // --- Bồi dưỡng Học sinh giỏi ---
  subscribeGiftedPrograms(onUpdate: (programs: GiftedProgram[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'giftedPrograms'), snapshot => {
      const programs: GiftedProgram[] = [];
      snapshot.forEach(d => programs.push(d.data() as GiftedProgram));
      programs.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
      onUpdate(programs);
    });
  },

  async saveGiftedProgram(program: GiftedProgram): Promise<void> {
    await setDoc(doc(db, 'giftedPrograms', program.id), sanitizeForFirestore(program), { merge: true });
  },

  // --- Thư mời tài khoản ---

  /**
   * Đọc thư mời của CHÍNH người đang đăng nhập.
   *
   * Luật chỉ cho lấy đúng một tài liệu mang tên email của mình, không cho liệt
   * kê cả danh sách — nên hàm này nhận email chứ không nhận điều kiện lọc.
   */
  async getInvitation(email: string): Promise<Invitation | null> {
    const snap = await getDoc(doc(db, 'invitations', invitationKey(email)));
    return snap.exists() ? (snap.data() as Invitation) : null;
  },

  async saveInvitation(invitation: Invitation): Promise<void> {
    await setDoc(
      doc(db, 'invitations', invitationKey(invitation.email)),
      sanitizeForFirestore({ ...invitation, email: invitationKey(invitation.email) })
    );
  },

  async deleteInvitation(email: string): Promise<void> {
    await deleteDoc(doc(db, 'invitations', invitationKey(email)));
  },

  /** Danh sách thư mời chưa dùng — chỉ Ban Giám hiệu đọc được. */
  subscribeInvitations(onUpdate: (invitations: Invitation[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'invitations'), snapshot => {
      const list: Invitation[] = [];
      snapshot.forEach(d => list.push(d.data() as Invitation));
      list.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
      onUpdate(list);
    });
  },

  async deleteGiftedProgram(programId: string): Promise<void> {
    await deleteDoc(doc(db, 'giftedPrograms', programId));
  }
};
