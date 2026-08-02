'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleType, ROLE_LABELS, Department } from '@/Edu-task/types/user';
import { LeaveRequest, LeaveType, LeaveSession, ApprovalStatus, LeaveHistoryLog } from '@/Edu-task/types/leave';
import { Task, TaskPriority, TaskStatus } from '@/Edu-task/types/task';
import { AppNotification } from '@/Edu-task/types/notification';
import { storage } from '@/Edu-task/lib/storage';
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
  
  // School & Department Config
  schoolName: string;
  departments: Department[];
  updateSchoolName: (name: string) => void;
  addDepartment: (data: { name: string; code: string; description?: string }) => void;
  updateDepartment: (id: string, data: { name: string; code: string; description?: string }) => void;
  deleteDepartment: (id: string) => void;

  // Auth & Account Management
  loginWithFirebase: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  registerWithFirebase: (email: string, pass: string, fullName: string, deptId: string, deptName: string) => Promise<void>;
  loginAsDemoUser: (email: string) => void;
  logout: () => Promise<void>;
  
  // User Management
  addUserProfile: (user: User) => Promise<void>;
  approveUserProfile: (userId: string, role: RoleType, deptId: string, deptName: string) => Promise<void>;
  rejectUserProfile: (userId: string) => Promise<void>;
  deleteUserProfile: (userId: string) => Promise<void>;

  // Role & User Switching
  switchUser: (userId: string) => void;
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
  }) => LeaveRequest;
  
  updateLeaveRequest: (
    leaveId: string,
    data: {
      leaveType: LeaveType;
      startDate: string;
      endDate: string;
      session: LeaveSession;
      reason: string;
      notes?: string;
    }
  ) => void;

  changeSubstituteTeacher: (
    leaveId: string,
    newSubstituteTeacherId: string
  ) => void;
  
  cancelLeaveRequest: (leaveId: string, cancelReason?: string) => void;
  deleteLeaveRequest: (leaveId: string) => void;
  
  processLeaveStep: (
    leaveId: string, 
    decision: ApprovalStatus, 
    comment?: string,
    assignedSubstituteTeacherId?: string
  ) => void;

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
    visibilitySettings?: {
      bghCanView?: boolean;
      assigneeGroupLeadersCanView?: boolean;
      specificVicePrincipalIds?: string[];
    };
  }) => Task;
  
  updateTaskProgress: (
    taskId: string, 
    newStatus: TaskStatus, 
    reportNotes?: string
  ) => void;
  
  requestExtension: (
    taskId: string, 
    requestedDeadline: string, 
    reason: string
  ) => void;
  
  reviewExtension: (
    taskId: string, 
    extensionId: string, 
    decision: 'APPROVED' | 'DECLINED', 
    comment?: string
  ) => void;
  
  approveTaskCompletion: (
    taskId: string, 
    decision: 'APPROVE' | 'REVISE', 
    feedback?: string
  ) => void;

  // Data Reset
  resetSystemData: () => void;
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

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = firebaseAuthService.onAuthChange(async (fbUser) => {
      console.log('onAuthChange fired:', fbUser?.email);
      if (fbUser) {
        setIsAuthenticated(true);
        const userEmail = fbUser.email?.toLowerCase();
        let match = users.find(u => u.email.toLowerCase() === userEmail || u.id === fbUser.uid);
        console.log('onAuthChange match found:', !!match, users.length);
        
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

        if (match) {
          console.log('onAuthChange match found:', true, users.length, 'match.activeRole:', match.activeRole, 'fallback to:', match.roles[0]);
          setCurrentUser(match);
          setActiveRole(match.activeRole || match.roles[0] || 'ADMIN');
          storage.setCurrentUserId(match.id);
        } else {
          // New fallback user profile
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
      }
    });
    return () => unsubscribe();
  }, [users]);

  // Subscribe to Firebase Firestore Realtime Database
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const filter = { role: activeRole, deptId: currentUser.departmentId, userId: currentUser.id };

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
    }, activeRole, currentUser.departmentId);

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
    }, currentUser.id);

    return () => {
      unsubUsers();
      unsubLeaves();
      unsubTasks();
      unsubNotifs();
    };
  }, [isAuthenticated, currentUser?.id, activeRole]);

  const { loginWithGoogle, loginWithFirebase, registerWithFirebase, loginAsDemoUser, logout } = useAuthLogic({
    users,
    setCurrentUser,
    setActiveRole,
    setIsAuthenticated,
  });

  const { addUserProfile, approveUserProfile, rejectUserProfile, deleteUserProfile, switchUser, switchActiveRole } = useUserLogic({
    users,
    setUsers,
    currentUser,
    setCurrentUser,
    setActiveRole,
    setNotifications,
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
  });

  const { createTask, updateTaskProgress, requestExtension, reviewExtension, approveTaskCompletion } = useTaskLogic({
    currentUser,
    activeRole,
    users,
    tasks,
    setTasks,
  });

  const { getTeacherLeaveConflict, createLeaveRequest, cancelLeaveRequest, deleteLeaveRequest, updateLeaveRequest, changeSubstituteTeacher, processLeaveStep } = useLeaveLogic({
    currentUser,
    activeRole,
    users,
    leaves,
    setLeaves,
    setNotifications,
  });

  // Reset
  const resetSystemData = () => {
    storage.resetAllData();
    const loadedUsers = storage.getUsers();
    setUsers(loadedUsers);
    setCurrentUser(loadedUsers[2]);
    setActiveRole(loadedUsers[2].roles[0]);
    setLeaves(storage.getLeaves());
    setTasks(storage.getTasks());
    setNotifications(storage.getNotifications(loadedUsers[2].id));
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
        schoolName,
        departments,
        updateSchoolName,
        addDepartment,
        updateDepartment,
        deleteDepartment,
        loginWithFirebase,
        loginWithGoogle,
        registerWithFirebase,
        loginAsDemoUser,
        logout,
        addUserProfile,
        approveUserProfile,
        rejectUserProfile,
        deleteUserProfile,
        switchUser,
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
        getTeacherLeaveConflict,
        resetSystemData,
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
