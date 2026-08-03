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
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { firebaseAuthService } from '@/Edu-task/services/firebaseAuthService';
import { useAuthLogic } from './hooks/useAuthLogic';
import { useUserLogic } from './hooks/useUserLogic';
import { useDepartmentLogic } from './hooks/useDepartmentLogic';
import { useTaskLogic } from './hooks/useTaskLogic';
import { useLeaveLogic } from './hooks/useLeaveLogic';

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

  // School & Department Config
  schoolName: string;
  departments: Department[];
  updateSchoolName: (name: string) => Promise<boolean>;
  addDepartment: (data: { name: string; code: string; description?: string }) => Promise<boolean>;
  updateDepartment: (id: string, data: { name: string; code: string; description?: string }) => Promise<boolean>;
  deleteDepartment: (id: string) => Promise<boolean>;

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

    return () => {
      unsubUsers();
      unsubLeaves();
      unsubTasks();
      unsubNotifs();
      unsubDepartments();
      unsubSchoolName();
    };
  }, [isAuthenticated, currentUserId, currentUserDeptId, canSeedConfig, activeRole]);

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
  });

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
        schoolName,
        departments,
        updateSchoolName,
        addDepartment,
        updateDepartment,
        deleteDepartment,
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
