'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import { User, RoleType, Department } from '@/Edu-task/types/user';
import { LeaveRequest, LeaveType, LeaveSession, ApprovalStatus, AttachmentFile } from '@/Edu-task/types/leave';
import { Task, TaskPriority, TaskStatus } from '@/Edu-task/types/task';
import { AppNotification } from '@/Edu-task/types/notification';
import { storage, INITIAL_DEPARTMENTS } from '@/Edu-task/lib/storage';
import { genId } from '@/Edu-task/lib/utils';
import { ToastKind, ToastMessage } from '@/Edu-task/components/common/Toast';
import {
  WorkflowConfig, TelegramConfig,
  DEFAULT_WORKFLOW_CONFIG, DEFAULT_TELEGRAM_CONFIG,
} from '@/Edu-task/types/settings';
import {
  ClassGroup, PeriodConfig, Room, DEFAULT_PERIOD_CONFIG,
} from '@/Edu-task/types/schedule';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { firebaseAuthService } from '@/Edu-task/services/firebaseAuthService';
import { useAuthLogic } from './hooks/useAuthLogic';
import { useUserLogic } from './hooks/useUserLogic';
import { useDepartmentLogic } from './hooks/useDepartmentLogic';
import { useTaskLogic } from './hooks/useTaskLogic';
import { useLeaveLogic } from './hooks/useLeaveLogic';
import { useCatalogLogic, RoomInput, ClassInput } from './hooks/useCatalogLogic';
import { useMakeupLogic, MakeupInput } from './hooks/useMakeupLogic';
import { useBookingLogic, BookingInput } from './hooks/useBookingLogic';
import { useAttendanceLogic, AttendanceInput } from './hooks/useAttendanceLogic';
import { useMeetingLogic, MeetingInput } from './hooks/useMeetingLogic';
import {
  usePlanLogic, PlanInput, MilestoneInput, ReminderInput,
} from './hooks/usePlanLogic';
import { MilestoneStatus, Plan } from '@/Edu-task/types/plan';
import { ReminderSchedule } from '@/Edu-task/types/reminder';
import { useEquipmentLogic, EquipmentInput, LoanInput } from './hooks/useEquipmentLogic';
import { Equipment, EquipmentCondition, EquipmentLoan } from '@/Edu-task/types/equipment';
import { useStudentLogic, StudentInput, ConductInput } from './hooks/useStudentLogic';
import {
  ClassAttendance, ConductRecord, Student, StudentAttendanceEntry,
} from '@/Edu-task/types/student';
import { SchoolSession } from '@/Edu-task/types/schedule';
import { AttendanceMark, Meeting } from '@/Edu-task/types/meeting';
import { canManageMeetings } from '@/Edu-task/lib/permissions';
import { MakeupClass } from '@/Edu-task/types/makeup';
import { RoomBooking } from '@/Edu-task/types/booking';
import { AttendanceRecord } from '@/Edu-task/types/attendance';
import { PeriodSlot } from '@/Edu-task/types/schedule';
import { canViewAllAttendance, isDeptLeader } from '@/Edu-task/lib/permissions';

interface AppContextType {
  currentUser: User | null;
  activeRole: RoleType;
  users: User[];
  leaves: LeaveRequest[];
  tasks: Task[];
  notifications: AppNotification[];
  isAuthenticated: boolean;

  // Transient user feedback
  toasts: ToastMessage[];
  showToast: (kind: ToastKind, text: string) => void;
  dismissToast: (id: string) => void;

  // Approval flow & integrations (admin configurable)
  workflowConfig: WorkflowConfig;
  telegramConfig: TelegramConfig;
  updateWorkflowConfig: (config: WorkflowConfig) => Promise<boolean>;
  updateTelegramConfig: (config: TelegramConfig) => Promise<boolean>;

  // School & Department Config
  schoolName: string;
  departments: Department[];
  updateSchoolName: (name: string) => Promise<boolean>;
  addDepartment: (data: { name: string; code: string; description?: string }) => Promise<boolean>;
  updateDepartment: (id: string, data: { name: string; code: string; description?: string }) => Promise<boolean>;
  deleteDepartment: (id: string) => Promise<boolean>;

  // Scheduling catalogs: rooms, classes and the period timetable
  rooms: Room[];
  classes: ClassGroup[];
  periodConfig: PeriodConfig;
  addRoom: (data: RoomInput) => Promise<boolean>;
  updateRoom: (id: string, data: RoomInput) => Promise<boolean>;
  deleteRoom: (id: string, referencingBookings?: number) => Promise<boolean>;
  addClass: (data: ClassInput) => Promise<boolean>;
  updateClass: (id: string, data: ClassInput) => Promise<boolean>;
  deleteClass: (id: string, referencingRecords?: number) => Promise<boolean>;
  updatePeriodConfig: (config: PeriodConfig) => Promise<boolean>;

  // Đăng ký dạy bù
  makeups: MakeupClass[];
  getMakeupSlotProblems: (
    slot: PeriodSlot,
    params: { teacherId: string; classId?: string; roomId?: string; excludeId?: string }
  ) => string[];
  createMakeup: (data: MakeupInput) => Promise<MakeupClass | null>;
  updateMakeup: (id: string, data: MakeupInput) => Promise<boolean>;
  decideMakeup: (id: string, decision: 'APPROVED' | 'REJECTED', comment?: string) => Promise<boolean>;
  cancelMakeup: (id: string, reason?: string) => Promise<boolean>;
  completeMakeup: (id: string) => Promise<boolean>;
  deleteMakeup: (id: string) => Promise<boolean>;

  // Đăng ký phòng
  bookings: RoomBooking[];
  getBookingSlotProblems: (
    slot: PeriodSlot,
    params: { roomId: string; classId?: string; excludeId?: string }
  ) => string[];
  getRoomBusySlots: (roomId: string, date: string) => PeriodSlot[];
  createBooking: (data: BookingInput) => Promise<RoomBooking | null>;
  decideBooking: (id: string, decision: 'CONFIRMED' | 'REJECTED', comment?: string) => Promise<boolean>;
  cancelBooking: (id: string, reason?: string) => Promise<boolean>;
  deleteBooking: (id: string) => Promise<boolean>;

  // Sổ nề nếp (giám thị)
  attendance: AttendanceRecord[];
  recordIssue: (data: AttendanceInput) => Promise<AttendanceRecord | null>;
  updateAttendanceRecord: (id: string, data: AttendanceInput) => Promise<boolean>;
  submitExplanation: (id: string, text: string) => Promise<boolean>;
  reviewAttendanceRecord: (
    id: string,
    decision: 'EXCUSED' | 'CONFIRMED',
    reviewNote?: string
  ) => Promise<boolean>;
  deleteAttendanceRecord: (id: string) => Promise<boolean>;

  // Cuộc họp & điểm danh (thư ký)
  meetings: Meeting[];
  createMeeting: (data: MeetingInput) => Promise<Meeting | null>;
  updateMeeting: (id: string, data: MeetingInput) => Promise<boolean>;
  markAttendance: (
    meetingId: string,
    userId: string,
    mark: AttendanceMark,
    extra?: { minutesLate?: number; note?: string }
  ) => Promise<boolean>;
  markRemainingPresent: (meetingId: string) => Promise<boolean>;
  setMeetingStatus: (id: string, status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED') => Promise<boolean>;
  saveMinutes: (id: string, content: string) => Promise<boolean>;
  deleteMeeting: (id: string) => Promise<boolean>;

  // Kế hoạch & lịch nhắc
  plans: Plan[];
  reminders: ReminderSchedule[];
  createPlan: (data: PlanInput) => Promise<Plan | null>;
  updatePlan: (id: string, data: Partial<PlanInput>) => Promise<boolean>;
  archivePlan: (id: string, isArchived: boolean) => Promise<boolean>;
  deletePlan: (id: string) => Promise<boolean>;
  addMilestone: (planId: string, data: MilestoneInput, users: User[]) => Promise<boolean>;
  setMilestoneStatus: (planId: string, milestoneId: string, status: MilestoneStatus) => Promise<boolean>;
  removeMilestone: (planId: string, milestoneId: string) => Promise<boolean>;
  createReminder: (data: ReminderInput) => Promise<ReminderSchedule | null>;
  toggleReminder: (id: string, isActive: boolean) => Promise<boolean>;
  deleteReminder: (id: string) => Promise<boolean>;

  // Thiết bị & phiếu mượn
  equipment: Equipment[];
  loans: EquipmentLoan[];
  addEquipment: (data: EquipmentInput) => Promise<boolean>;
  updateEquipment: (id: string, data: EquipmentInput) => Promise<boolean>;
  deleteEquipment: (id: string) => Promise<boolean>;
  restoreEquipment: (id: string, quantity: number) => Promise<boolean>;
  requestLoan: (data: LoanInput) => Promise<EquipmentLoan | null>;
  decideLoan: (id: string, decision: 'BORROWED' | 'REJECTED', comment?: string) => Promise<boolean>;
  returnLoan: (id: string, condition: EquipmentCondition, note?: string) => Promise<boolean>;
  cancelLoan: (id: string, reason?: string) => Promise<boolean>;

  // Học sinh
  students: Student[];
  studentAttendance: ClassAttendance[];
  conduct: ConductRecord[];
  createStudent: (data: StudentInput) => Promise<Student | null>;
  updateStudent: (id: string, data: StudentInput) => Promise<boolean>;
  deleteStudent: (id: string) => Promise<boolean>;
  findRoll: (classId: string, date: string, session: SchoolSession) => ClassAttendance | null;
  buildRoll: (classId: string, date: string, session: SchoolSession) => StudentAttendanceEntry[];
  saveRoll: (
    classId: string,
    date: string,
    session: SchoolSession,
    entries: StudentAttendanceEntry[]
  ) => Promise<boolean>;
  recordConduct: (data: ConductInput) => Promise<ConductRecord | null>;
  deleteConduct: (id: string) => Promise<boolean>;

  // Auth & Account Management
  loginWithFirebase: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  registerWithFirebase: (email: string, pass: string, fullName: string, deptId: string, deptName: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // User Management
  addUserProfile: (user: User) => Promise<boolean>;
  approveUserProfile: (userId: string, role: RoleType, deptId: string, deptName: string) => Promise<boolean>;
  rejectUserProfile: (userId: string) => Promise<boolean>;
  deleteUserProfile: (userId: string) => Promise<boolean>;

  // Notifications
  markNotificationRead: (notifId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Role Switching
  switchActiveRole: (role: RoleType) => void;
  
  // Leave Actions
  createLeaveRequest: (data: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    session: LeaveSession;
    reason: string;
    substituteTeacherId?: string;
    notes?: string;
    id?: string;
    proofFiles?: AttachmentFile[];
  }) => Promise<LeaveRequest | null>;

  updateLeaveRequest: (
    leaveId: string,
    data: {
      leaveType: LeaveType;
      startDate: string;
      endDate: string;
      session: LeaveSession;
      reason: string;
      notes?: string;
      proofFiles?: AttachmentFile[];
    }
  ) => Promise<boolean>;

  changeSubstituteTeacher: (
    leaveId: string,
    newSubstituteTeacherId: string
  ) => Promise<boolean>;

  cancelLeaveRequest: (leaveId: string, cancelReason?: string) => Promise<boolean>;
  deleteLeaveRequest: (leaveId: string) => Promise<boolean>;

  processLeaveStep: (
    leaveId: string,
    decision: ApprovalStatus,
    comment?: string,
    assignedSubstituteTeacherId?: string
  ) => Promise<boolean>;

  // Conflict Checker
  getTeacherLeaveConflict: (
    teacherId: string, 
    startDate: string, 
    endDate: string,
    session?: LeaveSession,
    excludeLeaveId?: string
  ) => {
    hasConflict: boolean;
    conflictDetail?: LeaveRequest;
  };
  
  // Task Actions
  createTask: (data: {
    title: string;
    description: string;
    assigneeType: 'INDIVIDUAL' | 'MULTIPLE' | 'DEPARTMENT';
    targetUserIds?: string[];
    targetDepartmentId?: string;
    deadline: string;
    priority: TaskPriority;
    id?: string;
    attachments?: AttachmentFile[];
    visibilitySettings?: {
      bghCanView?: boolean;
      assigneeGroupLeadersCanView?: boolean;
      specificVicePrincipalIds?: string[];
    };
  }) => Promise<Task | null>;

  updateTaskProgress: (
    taskId: string,
    newStatus: TaskStatus,
    reportNotes?: string
  ) => Promise<boolean>;

  requestExtension: (
    taskId: string,
    requestedDeadline: string,
    reason: string
  ) => Promise<boolean>;

  reviewExtension: (
    taskId: string,
    extensionId: string,
    decision: 'APPROVED' | 'DECLINED',
    comment?: string
  ) => Promise<boolean>;

  approveTaskCompletion: (
    taskId: string,
    decision: 'APPROVE' | 'REVISE',
    feedback?: string
  ) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;

}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(() => storage.getUsers());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<RoleType>('ADMIN');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const [schoolName, setSchoolName] = useState<string>(() => storage.getSchoolName());
  const [departments, setDepartments] = useState<Department[]>(() => storage.getDepartments());
  const [leaves, setLeaves] = useState<LeaveRequest[]>(() => storage.getLeaves());
  const [tasks, setTasks] = useState<Task[]>(() => storage.getTasks());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [fbUser, setFbUser] = useState<FirebaseAuthUser | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfig>(DEFAULT_WORKFLOW_CONFIG);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(DEFAULT_TELEGRAM_CONFIG);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [periodConfig, setPeriodConfig] = useState<PeriodConfig>(DEFAULT_PERIOD_CONFIG);
  const [makeups, setMakeups] = useState<MakeupClass[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [reminders, setReminders] = useState<ReminderSchedule[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loans, setLoans] = useState<EquipmentLoan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<ClassAttendance[]>([]);
  const [conduct, setConduct] = useState<ConductRecord[]>([]);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((kind: ToastKind, text: string) => {
    const id = genId('TOAST');
    setToasts(prev => [...prev, { id, kind, text }]);
    // Errors stay longer: they usually ask the user to retry something.
    const timer = setTimeout(() => dismissToast(id), kind === 'error' ? 8000 : 4000);
    timersRef.current.push(timer);
  }, [dismissToast]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach(clearTimeout); };
  }, []);

  // Register the Firebase Auth listener exactly once (on mount). It only stores
  // the raw Firebase user; deriving the app profile happens in the effect below
  // so we never re-subscribe the listener every time `users` changes.
  useEffect(() => {
    const unsubscribe = firebaseAuthService.onAuthChange(setFbUser);
    return () => unsubscribe();
  }, []);

  // Derive the current app user whenever the auth state or the users list
  // changes. This effect exists precisely to mirror an external system (Firebase
  // Auth) into React state, which is the sanctioned use of an effect. The
  // signed-out branch must run synchronously so no protected view renders for a
  // logged-out user, and the signed-in branch needs an async profile fetch, so
  // neither can be derived during render.
  useEffect(() => {
    if (!fbUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      setIsAuthenticated(false);
      setCurrentUser(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsAuthenticated(true);
      const userEmail = fbUser.email?.toLowerCase();
      let match = users.find(u => u.email.toLowerCase() === userEmail || u.id === fbUser.uid);

      const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'admin@gmail.com';
      const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());

      if (userEmail && adminEmails.includes(userEmail)) {
        if (!match) {
          match = await firebaseAuthService.seedAdminUserProfile();
        } else {
          match = {
            ...match,
            roles: ['ADMIN', 'PRINCIPAL', 'TEACHER'],
            activeRole: match.activeRole || 'ADMIN',
            status: 'ACTIVE',
          };
        }
      }

      if (cancelled) return;

      if (match) {
        setCurrentUser(match);
        setActiveRole(match.activeRole || match.roles[0] || 'ADMIN');
      } else {
        // New user not yet in the users list -> show pending profile.
        const fallbackUser: User = {
          id: fbUser.uid,
          fullName: fbUser.displayName || userEmail || 'Người dùng',
          email: userEmail || '',
          departmentId: 'DEPT_TOAN_TIN',
          departmentName: 'Tổ Toán - Tin',
          roles: ['TEACHER'],
          activeRole: 'TEACHER',
          isTeachingStaff: true,
          status: 'PENDING_APPROVAL',
        };
        setCurrentUser(fallbackUser);
        setActiveRole('TEACHER');
      }
    })();

    return () => { cancelled = true; };
  }, [fbUser, users]);

  // Depend on primitives rather than the whole `currentUser` object: the object
  // identity changes on every users snapshot, which would tear down and rebuild
  // every Firestore subscription each time anyone's profile is touched.
  const currentUserId = currentUser?.id;
  const currentUserDeptId = currentUser?.departmentId;
  // Mirrors `isAdmin()` in firestore.rules — the roles allowed to write shared
  // school config, and therefore the only ones that can seed it.
  const canSeedConfig = !!currentUser?.roles?.some(r =>
    r === 'ADMIN' || r === 'PRINCIPAL' || r === 'VICE_PRINCIPAL'
  );
  // Reduced to booleans for the same reason: the subscription effect must not
  // depend on the `currentUser` object, whose identity changes every snapshot.
  const seesAllAttendance = canViewAllAttendance(currentUser, activeRole);
  const leadsDepartment = isDeptLeader(currentUser, activeRole);
  const seesAllMeetings = canManageMeetings(currentUser, activeRole);

  // Subscribe to Firebase Firestore Realtime Database
  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return;

    const filter = { role: activeRole, deptId: currentUserDeptId, userId: currentUserId };

    const unsubUsers = firebaseService.subscribeUsers((fbUsers) => {
      setUsers(prevUsers => {
        const mergedUsers = fbUsers.map(fbU => {
          const prevU = prevUsers.find(pu => pu.id === fbU.id);
          if (prevU && prevU.activeRole) {
            return { ...fbU, activeRole: prevU.activeRole };
          }
          return fbU;
        });
        storage.saveUsers(mergedUsers);
        return mergedUsers;
      });
    });

    const unsubLeaves = firebaseService.subscribeLeaves((fbLeaves) => {
      setLeaves(fbLeaves);
      storage.saveLeaves(fbLeaves);
    }, filter);

    const unsubTasks = firebaseService.subscribeTasks((fbTasks) => {
      setTasks(fbTasks);
      storage.saveTasks(fbTasks);
    }, filter);

    const unsubNotifs = firebaseService.subscribeNotifications((fbNotifs) => {
      setNotifications(fbNotifs);
    }, currentUserId);

    // Shared school config. Departments used to live only in localStorage, which
    // meant each browser had its own private list; they are now server-owned.
    const unsubDepartments = firebaseService.subscribeDepartments((fbDepts) => {
      if (fbDepts.length === 0) {
        // First run against an empty project: migrate the built-in defaults so
        // every device converges on one list. Only an admin is allowed to write.
        if (canSeedConfig) {
          firebaseService.seedDepartments(INITIAL_DEPARTMENTS)
            .catch(err => console.error('Failed to seed departments:', err));
        }
        return; // keep showing the local defaults until the seed round-trips
      }
      setDepartments(fbDepts);
      storage.saveDepartments(fbDepts);
    });

    const unsubSchoolName = firebaseService.subscribeSchoolName((name) => {
      if (!name) return;
      setSchoolName(name);
      storage.saveSchoolName(name);
    });

    // Never-configured settings resolve to null; fall back to the defaults so
    // the app behaves exactly as it did before these became configurable.
    const unsubWorkflow = firebaseService.subscribeWorkflowConfig(config => {
      setWorkflowConfig(config ?? DEFAULT_WORKFLOW_CONFIG);
    });

    // `settings/telegram` holds the bot token and is now admin-read-only, so
    // only admins subscribe. Nobody else needs it: sending moved to a Cloud
    // Function, and subscribing anyway would hand every teacher a
    // permission-denied error in the console on every page load.
    const unsubTelegram = canSeedConfig
      ? firebaseService.subscribeTelegramConfig(config => {
          setTelegramConfig(config ?? DEFAULT_TELEGRAM_CONFIG);
        })
      : () => {};

    // Scheduling catalogs. Unlike departments these are not seeded: an empty
    // room list is a legitimate state for a school that has not set one up, and
    // guessing room names would be worse than showing none.
    const unsubRooms = firebaseService.subscribeRooms(setRooms);
    const unsubClasses = firebaseService.subscribeClasses(setClasses);
    const unsubPeriods = firebaseService.subscribePeriodConfig(config => {
      setPeriodConfig(config ?? DEFAULT_PERIOD_CONFIG);
    });

    // Make-up classes and room bookings are scoped to a rolling window instead
    // of being fetched whole: these collections grow every term and never
    // shrink, while anything older than a couple of months is history nobody
    // acts on. 60 days back is enough to review last month's register.
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 60);
    const scheduleWindowStart = windowStart.toISOString().slice(0, 10);

    const unsubMakeups = firebaseService.subscribeMakeups(setMakeups, scheduleWindowStart);
    const unsubBookings = firebaseService.subscribeBookings(setBookings, scheduleWindowStart);

    // The nề nếp log is narrowed by audience in the QUERY, not just in the UI:
    // a teacher's browser should never receive records about their colleagues
    // in the first place. Mirrors the read rule in firestore.rules.
    const unsubAttendance = firebaseService.subscribeAttendance(
      setAttendance,
      scheduleWindowStart,
      seesAllAttendance
        ? { seeAll: true }
        : leadsDepartment
          ? { seeAll: false, deptId: currentUserDeptId }
          : { seeAll: false, userId: currentUserId }
    );

    const unsubMeetings = firebaseService.subscribeMeetings(
      setMeetings,
      scheduleWindowStart,
      seesAllMeetings ? { seeAll: true } : { seeAll: false, userId: currentUserId }
    );

    // Plans and reminder schedules are readable by everyone by design: a plan
    // exists so staff know what the school is working towards, and a schedule
    // people cannot inspect makes its own notifications inexplicable.
    const unsubPlans = firebaseService.subscribePlans(setPlans);
    const unsubReminders = firebaseService.subscribeReminders(setReminders);

    // Equipment availability is computed from OPEN loans, so the window has to
    // be generous: dropping an old loan that was never returned would silently
    // free up kit that is still missing. A year back, not 60 days.
    const loanWindow = new Date();
    loanWindow.setFullYear(loanWindow.getFullYear() - 1);
    const unsubEquipment = firebaseService.subscribeEquipment(setEquipment);
    const unsubLoans = firebaseService.subscribeLoans(setLoans, loanWindow.toISOString().slice(0, 10));

    // The roster is small and needed whole to build any register. Rolls and
    // conduct records are the highest-volume data in the app — one roll per
    // class per session per school day — so they use the same 60-day window as
    // the other scheduling collections.
    const unsubStudents = firebaseService.subscribeStudents(setStudents);
    const unsubStudentAttendance = firebaseService.subscribeClassAttendance(
      setStudentAttendance, scheduleWindowStart
    );
    const unsubConduct = firebaseService.subscribeConduct(setConduct, scheduleWindowStart);

    return () => {
      unsubUsers();
      unsubLeaves();
      unsubTasks();
      unsubNotifs();
      unsubDepartments();
      unsubSchoolName();
      unsubWorkflow();
      unsubTelegram();
      unsubRooms();
      unsubClasses();
      unsubPeriods();
      unsubMakeups();
      unsubBookings();
      unsubAttendance();
      unsubMeetings();
      unsubPlans();
      unsubReminders();
      unsubEquipment();
      unsubLoans();
      unsubStudents();
      unsubStudentAttendance();
      unsubConduct();
    };
  }, [
    isAuthenticated, currentUserId, currentUserDeptId, canSeedConfig, activeRole,
    seesAllAttendance, leadsDepartment, seesAllMeetings,
  ]);

  const { loginWithGoogle, loginWithFirebase, registerWithFirebase, logout } = useAuthLogic({
    setCurrentUser,
    setIsAuthenticated,
  });

  const { addUserProfile, approveUserProfile, rejectUserProfile, deleteUserProfile, switchActiveRole } = useUserLogic({
    users,
    setUsers,
    currentUser,
    setActiveRole,
    notify: showToast,
  });

  const { updateSchoolName, addDepartment, updateDepartment, deleteDepartment } = useDepartmentLogic({
    schoolName,
    setSchoolName,
    departments,
    setDepartments,
    users,
    setUsers,
    leaves,
    setLeaves,
    tasks,
    setTasks,
    notify: showToast,
  });

  const {
    addRoom, updateRoom, deleteRoom,
    addClass, updateClass, deleteClass,
    updatePeriodConfig,
  } = useCatalogLogic({
    rooms, setRooms,
    classes, setClasses,
    periodConfig, setPeriodConfig,
    notify: showToast,
  });

  const {
    getMakeupSlotProblems, createMakeup, updateMakeup,
    decideMakeup, cancelMakeup, completeMakeup, deleteMakeup,
  } = useMakeupLogic({
    currentUser, activeRole, users,
    makeups, setMakeups,
    bookings, leaves, rooms, classes,
    notify: showToast,
  });

  const {
    getBookingSlotProblems, getRoomBusySlots, createBooking,
    decideBooking, cancelBooking, deleteBooking,
  } = useBookingLogic({
    currentUser, activeRole, users,
    bookings, setBookings,
    makeups, rooms, classes,
    notify: showToast,
  });

  const {
    recordIssue, updateRecord: updateAttendanceRecord, submitExplanation,
    reviewRecord: reviewAttendanceRecord, deleteRecord: deleteAttendanceRecord,
  } = useAttendanceLogic({
    currentUser, activeRole, users, classes,
    attendance, setAttendance,
    notify: showToast,
  });

  const {
    createMeeting, updateMeeting, markAttendance, markRemainingPresent,
    setMeetingStatus, saveMinutes, deleteMeeting,
  } = useMeetingLogic({
    currentUser, activeRole, users,
    meetings, setMeetings,
    notify: showToast,
  });

  const {
    createPlan, updatePlan, archivePlan, deletePlan,
    addMilestone, setMilestoneStatus, removeMilestone,
    createReminder, toggleReminder, deleteReminder,
  } = usePlanLogic({
    currentUser, activeRole,
    plans, setPlans,
    reminders, setReminders,
    notify: showToast,
  });

  const {
    addEquipment, updateEquipment, deleteEquipment, restoreEquipment,
    requestLoan, decideLoan, returnLoan, cancelLoan,
  } = useEquipmentLogic({
    currentUser, activeRole,
    equipment, setEquipment,
    loans, setLoans,
    users,
    notify: showToast,
  });

  const {
    createStudent, updateStudent, deleteStudent,
    findRoll, buildRoll, saveRoll,
    recordConduct, deleteConduct,
  } = useStudentLogic({
    currentUser, activeRole, classes,
    students, setStudents,
    studentAttendance, setStudentAttendance,
    conduct, setConduct,
    notify: showToast,
  });

  const { createTask, updateTaskProgress, requestExtension, reviewExtension, approveTaskCompletion, deleteTask } = useTaskLogic({
    currentUser,
    activeRole,
    users,
    tasks,
    setTasks,
    notify: showToast,
  });

  const { getTeacherLeaveConflict, createLeaveRequest, cancelLeaveRequest, deleteLeaveRequest, updateLeaveRequest, changeSubstituteTeacher, processLeaveStep } = useLeaveLogic({
    currentUser,
    activeRole,
    users,
    leaves,
    setLeaves,
    setNotifications,
    notify: showToast,
    workflowConfig,
  });

  // Admin-only settings writes. Same optimistic-then-rollback shape as the rest
  // of the app so a rejected write can never look like it succeeded.
  const updateWorkflowConfig = async (config: WorkflowConfig): Promise<boolean> => {
    const previous = workflowConfig;
    setWorkflowConfig(config);
    try {
      await firebaseService.saveWorkflowConfig(config);
      return true;
    } catch (err) {
      console.error('Failed to save workflow config:', err);
      setWorkflowConfig(previous);
      showToast('error', 'Không lưu được cấu hình luồng duyệt. Thay đổi đã được hoàn tác.');
      return false;
    }
  };

  const updateTelegramConfig = async (config: TelegramConfig): Promise<boolean> => {
    const previous = telegramConfig;
    setTelegramConfig(config);
    try {
      await firebaseService.saveTelegramConfig(config);
      return true;
    } catch (err) {
      console.error('Failed to save Telegram config:', err);
      setTelegramConfig(previous);
      showToast('error', 'Không lưu được cấu hình Telegram. Thay đổi đã được hoàn tác.');
      return false;
    }
  };

  // Notifications. Marking as read is best-effort and idempotent: the optimistic
  // update makes the badge respond instantly, and the realtime snapshot corrects
  // it if the write is rejected — so there is nothing to roll back by hand.
  const markNotificationRead = async (notifId: string) => {
    const target = notifications.find(n => n.id === notifId);
    if (!target || target.isRead) return;

    setNotifications(prev => prev.map(n => (n.id === notifId ? { ...n, isRead: true } : n)));
    storage.markNotificationRead(notifId);
    try {
      await firebaseService.markNotificationRead(notifId);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllNotificationsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) return;

    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    unreadIds.forEach(id => storage.markNotificationRead(id));
    try {
      await firebaseService.markAllNotificationsRead(unreadIds);
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        activeRole,
        users,
        leaves,
        tasks,
        notifications,
        isAuthenticated,
        toasts,
        showToast,
        dismissToast,
        workflowConfig,
        telegramConfig,
        updateWorkflowConfig,
        updateTelegramConfig,
        schoolName,
        departments,
        updateSchoolName,
        addDepartment,
        updateDepartment,
        deleteDepartment,
        rooms,
        classes,
        periodConfig,
        addRoom,
        updateRoom,
        deleteRoom,
        addClass,
        updateClass,
        deleteClass,
        updatePeriodConfig,
        makeups,
        getMakeupSlotProblems,
        createMakeup,
        updateMakeup,
        decideMakeup,
        cancelMakeup,
        completeMakeup,
        deleteMakeup,
        bookings,
        getBookingSlotProblems,
        getRoomBusySlots,
        createBooking,
        decideBooking,
        cancelBooking,
        deleteBooking,
        attendance,
        recordIssue,
        updateAttendanceRecord,
        submitExplanation,
        reviewAttendanceRecord,
        deleteAttendanceRecord,
        meetings,
        createMeeting,
        updateMeeting,
        markAttendance,
        markRemainingPresent,
        setMeetingStatus,
        saveMinutes,
        deleteMeeting,
        plans,
        reminders,
        createPlan,
        updatePlan,
        archivePlan,
        deletePlan,
        addMilestone,
        setMilestoneStatus,
        removeMilestone,
        createReminder,
        toggleReminder,
        deleteReminder,
        equipment,
        loans,
        addEquipment,
        updateEquipment,
        deleteEquipment,
        restoreEquipment,
        requestLoan,
        decideLoan,
        returnLoan,
        cancelLoan,
        students,
        studentAttendance,
        conduct,
        createStudent,
        updateStudent,
        deleteStudent,
        findRoll,
        buildRoll,
        saveRoll,
        recordConduct,
        deleteConduct,
        loginWithFirebase,
        loginWithGoogle,
        registerWithFirebase,
        logout,
        addUserProfile,
        approveUserProfile,
        rejectUserProfile,
        deleteUserProfile,
        markNotificationRead,
        markAllNotificationsRead,
        switchActiveRole,
        createLeaveRequest,
        updateLeaveRequest,
        changeSubstituteTeacher,
        cancelLeaveRequest,
        deleteLeaveRequest,
        processLeaveStep,
        createTask,
        updateTaskProgress,
        requestExtension,
        reviewExtension,
        approveTaskCompletion,
        deleteTask,
        getTeacherLeaveConflict,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
