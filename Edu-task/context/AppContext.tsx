'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleType, ROLE_LABELS, Department } from '@/Edu-task/types/user';
import { LeaveRequest, LeaveType, LeaveSession, ApprovalStatus, LeaveHistoryLog } from '@/Edu-task/types/leave';
import { Task, TaskPriority, TaskStatus } from '@/Edu-task/types/task';
import { AppNotification } from '@/Edu-task/types/notification';
import { storage } from '@/Edu-task/lib/storage';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { firebaseAuthService } from '@/Edu-task/services/firebaseAuthService';

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
    isConfidential?: boolean;
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

  const updateSchoolName = (name: string) => {
    setSchoolName(name);
    storage.saveSchoolName(name);
  };

  const addDepartment = (data: { name: string; code: string; description?: string }) => {
    const newDept: Department = {
      id: `DEPT_${Date.now()}`,
      name: data.name,
      code: data.code.toUpperCase().replace(/\s+/g, '-'),
      description: data.description || '',
    };
    const updated = [...departments, newDept];
    setDepartments(updated);
    storage.saveDepartments(updated);
  };

  const updateDepartment = (id: string, data: { name: string; code: string; description?: string }) => {
    const updatedDepts = departments.map(d => {
      if (d.id !== id) return d;
      return {
        ...d,
        name: data.name,
        code: data.code.toUpperCase().replace(/\s+/g, '-'),
        description: data.description !== undefined ? data.description : d.description,
      };
    });
    setDepartments(updatedDepts);
    storage.saveDepartments(updatedDepts);

    // Sync departmentName across users
    const changedUsers = users.filter(u => u.departmentId === id).map(u => ({ ...u, departmentName: data.name }));
    const updatedUsers = users.map(u => u.departmentId === id ? { ...u, departmentName: data.name } : u);
    setUsers(updatedUsers);
    storage.saveUsers(updatedUsers);
    changedUsers.forEach(u => firebaseService.saveUser(u));

    // Sync departmentName across leaves
    const changedLeaves = leaves.filter(l => l.departmentId === id).map(l => ({ ...l, departmentName: data.name }));
    const updatedLeaves = leaves.map(l => l.departmentId === id ? { ...l, departmentName: data.name } : l);
    setLeaves(updatedLeaves);
    storage.saveLeaves(updatedLeaves);
    changedLeaves.forEach(l => firebaseService.saveLeave(l));
  };

  const deleteDepartment = (id: string) => {
    const updated = departments.filter(d => d.id !== id);
    setDepartments(updated);
    storage.saveDepartments(updated);
  };

  const [leaves, setLeaves] = useState<LeaveRequest[]>(() => storage.getLeaves());
  const [tasks, setTasks] = useState<Task[]>(() => storage.getTasks());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = firebaseAuthService.onAuthChange(async (fbUser) => {
      if (fbUser) {
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

        if (match) {
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

  // Seed & Subscribe to Firebase Firestore Realtime Database
  useEffect(() => {
    firebaseService.seedInitialDataIfEmpty();

    const filter = currentUser ? { role: activeRole, deptId: currentUser.departmentId, userId: currentUser.id } : undefined;

    const unsubUsers = firebaseService.subscribeUsers((fbUsers) => {
      setUsers(fbUsers);
      storage.saveUsers(fbUsers);
    }, activeRole, currentUser?.departmentId);

    const unsubLeaves = firebaseService.subscribeLeaves((fbLeaves) => {
      setLeaves(fbLeaves);
      storage.saveLeaves(fbLeaves);
    }, filter);

    const unsubTasks = firebaseService.subscribeTasks((fbTasks) => {
      setTasks(fbTasks);
      storage.saveTasks(fbTasks);
    }, filter);

    const unsubNotifs = firebaseService.subscribeNotifications((fbNotifs) => {
      if (currentUser) {
        setNotifications(fbNotifs);
      }
    }, currentUser?.id);

    return () => {
      unsubUsers();
      unsubLeaves();
      unsubTasks();
      unsubNotifs();
    };
  }, [currentUser?.id]);

  // Firebase Auth Google Login
  const loginWithGoogle = async () => {
    const { userProfile } = await firebaseAuthService.loginWithGoogle();
    setIsAuthenticated(true);
    setCurrentUser(userProfile);
    setActiveRole(userProfile.activeRole || userProfile.roles[0] || 'TEACHER');
  };

  // Firebase Auth Login
  const loginWithFirebase = async (email: string, pass: string) => {
    await firebaseAuthService.login(email, pass);
    setIsAuthenticated(true);
    const match = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (match) {
      setCurrentUser(match);
      setActiveRole(match.activeRole || match.roles[0]);
    }
  };

  // Firebase Auth Register
  const registerWithFirebase = async (email: string, pass: string, fullName: string, deptId: string, deptName: string) => {
    const newProfile = await firebaseAuthService.register(email, pass, fullName, deptId, deptName);
    setIsAuthenticated(true);
    setCurrentUser(newProfile);
    setActiveRole(newProfile.roles[0]);
    await firebaseService.saveUser(newProfile);
  };

  // Login As Demo User
  const loginAsDemoUser = (email: string) => {
    let match = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!match && email === 'admin@gmail.com') {
      match = users.find(u => u.id === 'USR_ADMIN');
    }
    if (match) {
      setIsAuthenticated(true);
      setCurrentUser(match);
      setActiveRole(match.activeRole || match.roles[0]);
      storage.setCurrentUserId(match.id);
    }
  };

  // Logout
  const logout = async () => {
    try {
      await firebaseAuthService.logout();
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // User Management
  const addUserProfile = async (user: User) => {
    await firebaseService.saveUser(user);
  };

  const approveUserProfile = async (userId: string, role: RoleType, deptId: string, deptName: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const updated: User = {
      ...target,
      departmentId: deptId,
      departmentName: deptName,
      roles: [role],
      activeRole: role,
      status: 'ACTIVE',
    };
    await firebaseService.saveUser(updated);
  };

  const rejectUserProfile = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const updated: User = {
      ...target,
      status: 'REJECTED',
    };
    await firebaseService.saveUser(updated);
  };

  const deleteUserProfile = async (userId: string) => {
    await firebaseService.deleteUser(userId);
  };

  // Switch User
  const switchUser = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    
    storage.setCurrentUserId(userId);
    setCurrentUser(target);
    setActiveRole(target.roles[0]);
    setNotifications(storage.getNotifications(userId));
  };

  // Switch Active Context Role
  const switchActiveRole = (role: RoleType) => {
    if (!currentUser) return;
    setActiveRole(role);
    const updatedUsers = users.map(u => 
      u.id === currentUser.id ? { ...u, activeRole: role } : u
    );
    setUsers(updatedUsers);
    storage.saveUsers(updatedUsers);
  };

  // Conflict Checker (Tránh giao việc khi giáo viên đang nghỉ)
  // Conflict Checker (Tránh giao việc / dạy thay khi giáo viên đang nghỉ)
  const getTeacherLeaveConflict = (
    teacherId: string, 
    startDate: string, 
    endDate: string,
    session: LeaveSession = 'FULL_DAY',
    excludeLeaveId?: string
  ): { hasConflict: boolean; conflictDetail?: LeaveRequest } => {
    if (!teacherId || !startDate || !endDate) return { hasConflict: false };

    const approvedOrPendingLeaves = leaves.filter(l => 
      l.id !== excludeLeaveId &&
      l.applicantId === teacherId &&
      (l.overallStatus === 'APPROVED' || l.overallStatus === 'IN_REVIEW')
    );

    for (const leave of approvedOrPendingLeaves) {
      // Date range overlap check
      const dateOverlap = startDate <= leave.endDate && endDate >= leave.startDate;
      if (dateOverlap) {
        // Session overlap check
        if (
          session === 'FULL_DAY' ||
          leave.session === 'FULL_DAY' ||
          session === leave.session
        ) {
          return { hasConflict: true, conflictDetail: leave };
        }
      }
    }

    return { hasConflict: false };
  };

  // Create Leave Request
  const createLeaveRequest = (data: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    session: LeaveSession;
    reason: string;
    substituteTeacherId?: string;
    notes?: string;
  }): LeaveRequest => {
    if (!currentUser) throw new Error('User not logged in');

    // Calculate total days
    const dStart = new Date(data.startDate);
    const dEnd = new Date(data.endDate);
    const diffTime = Math.abs(dEnd.getTime() - dStart.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const totalDays = data.session === 'FULL_DAY' ? diffDays : diffDays * 0.5;

    let subName = undefined;
    if (data.substituteTeacherId) {
      const sub = users.find(u => u.id === data.substituteTeacherId);
      subName = sub?.fullName;
    }

    // Default Approval Pipeline based on role & days
    const steps = [
      {
        level: 'GROUP_LEADER' as RoleType,
        levelLabel: 'Nhóm trưởng / Tổ trưởng chuyên môn',
        status: 'PENDING' as ApprovalStatus,
      },
      {
        level: 'VICE_PRINCIPAL' as RoleType,
        levelLabel: 'Ban Giám Hiệu',
        status: 'PENDING' as ApprovalStatus,
      }
    ];

    const newCode = `ĐXN-2026-00${leaves.length + 1}`;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const newLeave: LeaveRequest = {
      id: `LV_2026_${Date.now()}`,
      code: newCode,
      applicantId: currentUser.id,
      applicantName: currentUser.fullName,
      applicantRole: ROLE_LABELS[activeRole] || 'Giáo viên',
      departmentId: currentUser.departmentId,
      departmentName: currentUser.departmentName,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays,
      session: data.session,
      reason: data.reason,
      notes: data.notes,
      substituteTeacherId: data.substituteTeacherId,
      substituteTeacherName: subName,
      substituteStatus: data.substituteTeacherId ? 'PENDING' : undefined,
      proofFiles: [],
      currentStepIndex: 0,
      steps,
      overallStatus: 'IN_REVIEW',
      history: [
        {
          id: `HIST_${Date.now()}`,
          action: 'TẠO ĐƠN XIN NGHỈ',
          actorName: currentUser.fullName,
          actorRole: ROLE_LABELS[activeRole],
          timestamp: now,
          note: `Gửi đơn xin nghỉ từ ${data.startDate} đến ${data.endDate}`,
        }
      ],
      createdAt: now,
      updatedAt: now,
    };

    const updatedLeaves = [newLeave, ...leaves];
    setLeaves(updatedLeaves);
    storage.saveLeaves(updatedLeaves);
    firebaseService.saveLeave(newLeave);

    // Create Notification for Group Leader / Department Head
    const groupLeaders = users.filter(u => u.departmentId === currentUser.departmentId && (u.roles.includes('GROUP_LEADER') || u.roles.includes('HEAD_OF_DEPT')));
    for (const gl of groupLeaders) {
      if (gl.id !== currentUser.id) {
        const notif: AppNotification = {
          id: `NOTIF_${Date.now()}`,
          recipientUserId: gl.id,
          title: 'Đơn xin nghỉ phép mới cần duyệt',
          message: `${currentUser.fullName} vừa gửi đơn xin nghỉ ${totalDays} ngày (${data.startDate}). Cần phân công dạy thay & duyệt.`,
          type: 'LEAVE_REQUEST',
          isRead: false,
          createdAt: now,
        };
        storage.addNotification(notif);
        firebaseService.saveNotification(notif);
      }
    }

    return newLeave;
  };

  // Cancel Leave Request & Release Schedule Logic
  const cancelLeaveRequest = (leaveId: string, cancelReason?: string) => {
    const leave = leaves.find(l => l.id === leaveId);
    if (!leave) return;

    const actorName = currentUser?.fullName || 'Người dùng';
    const actorRole = ROLE_LABELS[activeRole] || activeRole;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const historyLog: LeaveHistoryLog = {
      id: `HIST_${Date.now()}`,
      action: 'HỦY ĐƠN XIN NGHỈ PHÉP (GIẢI PHÓNG THỜI GIAN GIẢNG DẠY & DẠY THAY)',
      actorName,
      actorRole,
      timestamp: now,
      note: cancelReason || 'Giáo viên đã chủ động hủy đơn xin nghỉ phép.',
    };

    const updatedLeave: LeaveRequest = {
      ...leave,
      overallStatus: 'CANCELLED',
      substituteStatus: 'DECLINED',
      notes: `Đơn đã HỦY bởi ${actorName}. ${cancelReason ? `Lý do: ${cancelReason}` : ''}`,
      history: [...leave.history, historyLog],
      updatedAt: now,
    };

    const updatedLeaves = leaves.map(l => l.id === leaveId ? updatedLeave : l);
    setLeaves(updatedLeaves);
    storage.saveLeaves(updatedLeaves);
    firebaseService.saveLeave(updatedLeave);

    // Send notifications to 3 stakeholder groups:
    // 1. Substitute Teacher (Giáo viên được phân công dạy thay)
    if (leave.substituteTeacherId && leave.substituteTeacherId !== currentUser?.id) {
      storage.addNotification({
        id: `NOTIF_${Date.now()}_SUB`,
        recipientUserId: leave.substituteTeacherId,
        title: '❌ Thông báo HỦY lịch dạy thay',
        message: `Giáo viên ${leave.applicantName} đã HỦY đơn xin nghỉ phép (${leave.startDate} → ${leave.endDate}). Bạn KHÔNG cần dạy thay trong khoảng thời gian này nữa.`,
        type: 'LEAVE_REQUEST',
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    }

    // 2. Department Leaders (Tổ trưởng & Nhóm trưởng của tổ)
    const deptLeaders = users.filter(u => 
      u.departmentId === leave.departmentId && 
      u.roles.some(r => r === 'HEAD_OF_DEPT' || r === 'GROUP_LEADER') &&
      u.id !== currentUser?.id
    );
    deptLeaders.forEach(leader => {
      storage.addNotification({
        id: `NOTIF_${Date.now()}_DEPT_${leader.id}`,
        recipientUserId: leader.id,
        title: '🚫 Thông báo HỦY đơn nghỉ phép tổ chuyên môn',
        message: `Giáo viên ${leave.applicantName} (${leave.departmentName}) đã HỦY đơn xin nghỉ phép từ ${leave.startDate} đến ${leave.endDate}.`,
        type: 'LEAVE_REQUEST',
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    });

    // 3. Board of Directors (Ban Giám Hiệu BGH & Admin)
    const bghUsers = users.filter(u => 
      u.roles.some(r => r === 'PRINCIPAL' || r === 'VICE_PRINCIPAL' || r === 'ADMIN') &&
      u.id !== currentUser?.id &&
      !deptLeaders.some(dl => dl.id === u.id)
    );
    bghUsers.forEach(bgh => {
      storage.addNotification({
        id: `NOTIF_${Date.now()}_BGH_${bgh.id}`,
        recipientUserId: bgh.id,
        title: '📢 [BGH] Thông báo HỦY lịch nghỉ phép',
        message: `Giáo viên ${leave.applicantName} (${leave.departmentName}) đã HỦY đơn xin nghỉ phép (${leave.startDate} → ${leave.endDate}). Lịch dạy thay và thời gian giảng dạy đã được giải phóng.`,
        type: 'LEAVE_REQUEST',
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    });

    if (currentUser) {
      setNotifications(storage.getNotifications(currentUser.id));
    }
  };

  // Permanently Delete Leave Request
  const deleteLeaveRequest = (leaveId: string) => {
    const updatedLeaves = leaves.filter(l => l.id !== leaveId);
    setLeaves(updatedLeaves);
    storage.saveLeaves(updatedLeaves);
  };

  // Update Existing Leave Request (Resubmit after request edit)
  const updateLeaveRequest = (
    leaveId: string,
    data: {
      leaveType: LeaveType;
      startDate: string;
      endDate: string;
      session: LeaveSession;
      reason: string;
      notes?: string;
    }
  ) => {
    if (!currentUser) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    let targetLeaveToSave: LeaveRequest | null = null;

    const updatedLeaves = leaves.map(leave => {
      if (leave.id !== leaveId) return leave;

      const dStart = new Date(data.startDate);
      const dEnd = new Date(data.endDate);
      const diffTime = Math.abs(dEnd.getTime() - dStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const totalDays = data.session === 'FULL_DAY' ? diffDays : diffDays * 0.5;

      const resetSteps = leave.steps.map(s => ({
        ...s,
        status: 'PENDING' as ApprovalStatus,
        approverId: undefined,
        approverName: undefined,
        comment: undefined,
      }));

      const historyLog = {
        id: `HIST_${Date.now()}`,
        action: 'CHỈNH SỬA & GỬI LẠI ĐƠN NGHỈ',
        actorName: currentUser.fullName,
        actorRole: ROLE_LABELS[activeRole] || 'Giáo viên',
        timestamp: now,
        note: `Cập nhật đơn nghỉ từ ${data.startDate} đến ${data.endDate}. Lý do: ${data.reason}`,
      };

      const updatedLeaveObj: LeaveRequest = {
        ...leave,
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        session: data.session,
        reason: data.reason,
        notes: data.notes,
        totalDays,
        currentStepIndex: 0,
        steps: resetSteps,
        overallStatus: 'IN_REVIEW',
        history: [...leave.history, historyLog],
        updatedAt: now,
      };

      targetLeaveToSave = updatedLeaveObj;
      return updatedLeaveObj;
    });

    setLeaves(updatedLeaves);
    storage.saveLeaves(updatedLeaves);
    if (targetLeaveToSave) {
      firebaseService.saveLeave(targetLeaveToSave);
    }
  };

  // Adjust Substitute Teacher (without resetting overall approval status)
  const changeSubstituteTeacher = (leaveId: string, newSubstituteTeacherId: string) => {
    if (!currentUser) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const newSubUser = users.find(u => u.id === newSubstituteTeacherId);
    if (!newSubUser) return;

    const currentLeave = leaves.find(l => l.id === leaveId);
    if (currentLeave) {
      const conflict = getTeacherLeaveConflict(
        newSubstituteTeacherId,
        currentLeave.startDate,
        currentLeave.endDate,
        currentLeave.session,
        currentLeave.id
      );
      if (conflict.hasConflict) {
        throw new Error(`Không thể phân công ${newSubUser.fullName} làm giáo viên dạy thay vì giáo viên này đã có đơn xin nghỉ phép từ ${conflict.conflictDetail?.startDate} đến ${conflict.conflictDetail?.endDate}.`);
      }
    }

    let targetLeaveToSave: LeaveRequest | null = null;

    const updatedLeaves = leaves.map(leave => {
      if (leave.id !== leaveId) return leave;

      const oldSubName = leave.substituteTeacherName || 'Chưa phân công';

      const historyLog = {
        id: `HIST_${Date.now()}`,
        action: 'THAY ĐỔI GIÁO VIÊN DẠY THAY',
        actorName: currentUser.fullName,
        actorRole: ROLE_LABELS[activeRole] || 'Tổ trưởng chuyên môn',
        timestamp: now,
        note: `Điều chỉnh phân công dạy thay từ [${oldSubName}] sang [${newSubUser.fullName}]. (${leave.overallStatus === 'APPROVED' ? 'Đơn đã duyệt BGH - Giữ nguyên kết quả phê duyệt' : 'Đơn đang duyệt'})`,
      };

      const updatedLeaveObj: LeaveRequest = {
        ...leave,
        substituteTeacherId: newSubUser.id,
        substituteTeacherName: newSubUser.fullName,
        history: [...leave.history, historyLog],
        updatedAt: now,
      };

      targetLeaveToSave = updatedLeaveObj;
      return updatedLeaveObj;
    });

    setLeaves(updatedLeaves);
    storage.saveLeaves(updatedLeaves);
    if (targetLeaveToSave) {
      firebaseService.saveLeave(targetLeaveToSave);
    }

    // Create Notification for new substitute teacher
    const targetLeave = leaves.find(l => l.id === leaveId);
    const notif: AppNotification = {
      id: `NOTIF_${Date.now()}`,
      recipientUserId: newSubUser.id,
      title: 'Được phân công dạy thay mới',
      message: `${currentUser.fullName} đã điều chỉnh phân công bạn dạy thay cho đơn xin nghỉ của ${targetLeave?.applicantName || 'đồng nghiệp'}.`,
      type: 'LEAVE_REQUEST',
      isRead: false,
      createdAt: now,
    };
    storage.addNotification(notif);
    firebaseService.saveNotification(notif);
  };

  // Process Leave Step (Approve / Reject / Request Edit)
  const processLeaveStep = (
    leaveId: string, 
    decision: ApprovalStatus, 
    comment?: string,
    assignedSubstituteTeacherId?: string
  ) => {
    if (!currentUser) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    let targetLeaveToSave: LeaveRequest | null = null;

    const updatedLeaves = leaves.map(leave => {
      if (leave.id !== leaveId) return leave;

      const steps = [...leave.steps];
      const currIdx = leave.currentStepIndex;
      // Security Enforcement: Verify approver authority for current step
      const targetStep = steps[currIdx];
      const isStepGroupLeader = targetStep.level === 'GROUP_LEADER' || targetStep.level === 'HEAD_OF_DEPT';
      const isStepBGH = targetStep.level === 'VICE_PRINCIPAL' || targetStep.level === 'PRINCIPAL';

      const isAdmin = activeRole === 'ADMIN' || currentUser.roles?.includes('ADMIN');

      if (!isAdmin) {
        if (isStepBGH && activeRole !== 'PRINCIPAL' && activeRole !== 'VICE_PRINCIPAL') {
          throw new Error('Từ chối: Tổ trưởng không có quyền phê duyệt đơn ở cấp Ban Giám Hiệu.');
        }
        if (isStepGroupLeader) {
          if ((activeRole !== 'GROUP_LEADER' && activeRole !== 'HEAD_OF_DEPT') || currentUser.departmentId !== leave.departmentId) {
            throw new Error('Từ chối: Bạn không có quyền phê duyệt đơn xin nghỉ phép của tổ khác.');
          }
        }
      }

      let subId = leave.substituteTeacherId;
      let subName = leave.substituteTeacherName;

      // Mandatory Substitute Teacher check for Group Leader / Dept Head approval step (Step 0)
      if (decision === 'APPROVED' && currIdx === 0) {
        if (assignedSubstituteTeacherId) {
          subId = assignedSubstituteTeacherId;
          const matchedUser = users.find(u => u.id === assignedSubstituteTeacherId);
          subName = matchedUser?.fullName || 'Giáo viên dạy thay';
        }
        if (!subId) {
          throw new Error('Vui lòng phân công Giáo viên dạy thay trước khi phê duyệt đơn.');
        }

        // Check if candidate substitute teacher is already on leave
        const conflict = getTeacherLeaveConflict(
          subId,
          leave.startDate,
          leave.endDate,
          leave.session,
          leave.id
        );
        if (conflict.hasConflict) {
          throw new Error(`Không thể phân công ${subName} làm giáo viên dạy thay vì giáo viên này đã có đơn xin nghỉ phép từ ${conflict.conflictDetail?.startDate} đến ${conflict.conflictDetail?.endDate}.`);
        }
      }

      steps[currIdx] = {
        ...steps[currIdx],
        approverId: currentUser.id,
        approverName: currentUser.fullName,
        status: decision,
        comment,
        updatedAt: now,
      };

      let newOverall = leave.overallStatus;
      let nextStepIdx = currIdx;

      if (decision === 'REJECTED') {
        newOverall = 'REJECTED';
      } else if (decision === 'REQUEST_EDIT') {
        newOverall = 'REQUEST_EDIT';
      } else if (decision === 'APPROVED') {
        // Step 1 or BGH approval completes the workflow immediately!
        if (currIdx >= steps.length - 1 || steps[currIdx].level === 'VICE_PRINCIPAL' || steps[currIdx].level === 'PRINCIPAL') {
          newOverall = 'APPROVED';
        } else {
          nextStepIdx = currIdx + 1;
        }
      }

      const actionText = decision === 'APPROVED' 
        ? `PHÊ DUYỆT BƯỚC ${currIdx + 1} (${steps[currIdx].levelLabel})`
        : decision === 'REJECTED' ? 'TỪ CHỐI ĐƠN' : 'YÊU CẦU CHỈNH SỬA';

      const historyLog = {
        id: `HIST_${Date.now()}`,
        action: actionText,
        actorName: currentUser.fullName,
        actorRole: ROLE_LABELS[activeRole] || 'Người duyệt',
        timestamp: now,
        note: comment || (decision === 'APPROVED' ? 'Đã thông qua' : ''),
      };

      const updatedLeaveObj = {
        ...leave,
        substituteTeacherId: subId,
        substituteTeacherName: subName,
        substituteStatus: subId ? ('CONFIRMED' as const) : leave.substituteStatus,
        steps,
        currentStepIndex: nextStepIdx,
        overallStatus: newOverall,
        history: [...leave.history, historyLog],
        updatedAt: now,
      };

      targetLeaveToSave = updatedLeaveObj;
      return updatedLeaveObj;
    });

    setLeaves(updatedLeaves);
    storage.saveLeaves(updatedLeaves);
    if (targetLeaveToSave) {
      firebaseService.saveLeave(targetLeaveToSave);
    }
  };

  // Create Task
  const createTask = (data: {
    title: string;
    description: string;
    assigneeType: 'INDIVIDUAL' | 'MULTIPLE' | 'DEPARTMENT';
    targetUserIds?: string[];
    targetDepartmentId?: string;
    deadline: string;
    priority: TaskPriority;
    isConfidential?: boolean;
  }): Task => {
    if (!currentUser) throw new Error('User not logged in');

    let assigneesList: any[] = [];
    let deptName = undefined;

    if (data.assigneeType === 'DEPARTMENT' && data.targetDepartmentId) {
      const deptUsers = users.filter(u => u.departmentId === data.targetDepartmentId);
      deptName = deptUsers[0]?.departmentName || 'Tổ chuyên môn';
      assigneesList = deptUsers.map(u => ({
        userId: u.id,
        userName: u.fullName,
        departmentName: u.departmentName,
        status: 'ASSIGNED' as TaskStatus,
      }));
    } else if (data.targetUserIds && data.targetUserIds.length > 0) {
      assigneesList = data.targetUserIds.map(id => {
        const u = users.find(x => x.id === id);
        return {
          userId: id,
          userName: u?.fullName || 'Giáo viên',
          departmentName: u?.departmentName || '',
          status: 'ASSIGNED' as TaskStatus,
        };
      });
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const newCode = `CV-2026-00${tasks.length + 1}`;

    const newTask: Task = {
      id: `TSK_2026_${Date.now()}`,
      code: newCode,
      title: data.title,
      description: data.description,
      assignerId: currentUser.id,
      assignerName: currentUser.fullName,
      assignerRole: ROLE_LABELS[activeRole],
      assigneeType: data.assigneeType,
      targetDepartmentId: data.targetDepartmentId,
      targetDepartmentName: deptName,
      assignees: assigneesList,
      attachments: [],
      deadline: data.deadline,
      startDate: now,
      priority: data.priority,
      status: 'ASSIGNED',
      isConfidential: !!data.isConfidential,
      extensionRequests: [],
      activities: [
        {
          id: `ACT_${Date.now()}`,
          taskId: `TSK_2026_${Date.now()}`,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: ROLE_LABELS[activeRole],
          action: 'CREATE',
          content: 'Khởi tạo và phát hành chỉ đạo công việc.',
          timestamp: now,
        }
      ],
      createdAt: now,
      updatedAt: now,
    };

    const updatedTasks = [newTask, ...tasks];
    setTasks(updatedTasks);
    storage.saveTasks(updatedTasks);
    firebaseService.saveTask(newTask);

    // Notify Assignees
    assigneesList.forEach(assignee => {
      const notif: AppNotification = {
        id: `NOTIF_${Date.now()}_${assignee.userId}`,
        recipientUserId: assignee.userId,
        title: 'Công việc mới được giao',
        message: `${currentUser.fullName} đã giao công việc: "${data.title}" (Hạn: ${data.deadline}).`,
        type: 'TASK_ASSIGNED',
        isRead: false,
        createdAt: now,
      };
      storage.addNotification(notif);
      firebaseService.saveNotification(notif);
    });

    return newTask;
  };

  // Update Task Progress by Assignee
  const updateTaskProgress = (
    taskId: string, 
    newStatus: TaskStatus, 
    reportNotes?: string
  ) => {
    if (!currentUser) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    let targetTaskToSave: Task | null = null;

    const updatedTasks = tasks.map(task => {
      if (task.id !== taskId) return task;

      const updatedAssignees = task.assignees.map(a => {
        if (a.userId === currentUser.id) {
          return {
            ...a,
            status: newStatus,
            viewedAt: a.viewedAt || now,
            completedAt: newStatus === 'COMPLETED' ? now : a.completedAt,
            reportNotes: reportNotes || a.reportNotes,
          };
        }
        return a;
      });

      const activity = {
        id: `ACT_${Date.now()}`,
        taskId: task.id,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: ROLE_LABELS[activeRole],
        action: newStatus === 'PENDING_APPROVAL' ? ('SUBMIT_REPORT' as const) : ('PROGRESS_UPDATE' as const),
        content: reportNotes ? `Cập nhật trạng thái [${newStatus}]: ${reportNotes}` : `Cập nhật trạng thái thành ${newStatus}`,
        timestamp: now,
      };

      const updatedTaskObj = {
        ...task,
        status: newStatus,
        assignees: updatedAssignees,
        activities: [...task.activities, activity],
        updatedAt: now,
      };

      targetTaskToSave = updatedTaskObj;
      return updatedTaskObj;
    });

    setTasks(updatedTasks);
    storage.saveTasks(updatedTasks);
    if (targetTaskToSave) {
      firebaseService.saveTask(targetTaskToSave);
    }
  };

  // Request Extension
  const requestExtension = (taskId: string, requestedDeadline: string, reason: string) => {
    if (!currentUser) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    let targetTaskToSave: Task | null = null;

    const updatedTasks = tasks.map(task => {
      if (task.id !== taskId) return task;

      const extReq = {
        id: `EXT_${Date.now()}`,
        requestedByUserId: currentUser.id,
        requestedByUserName: currentUser.fullName,
        currentDeadline: task.deadline,
        requestedDeadline,
        reason,
        status: 'PENDING' as const,
        createdAt: now,
      };

      const activity = {
        id: `ACT_${Date.now()}`,
        taskId: task.id,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: ROLE_LABELS[activeRole],
        action: 'REQUEST_EXTENSION' as const,
        content: `Gửi yêu cầu xin gia hạn đến ${requestedDeadline}. Lý do: ${reason}`,
        timestamp: now,
      };

      const updatedTaskObj = {
        ...task,
        extensionRequests: [...task.extensionRequests, extReq],
        activities: [...task.activities, activity],
        updatedAt: now,
      };

      targetTaskToSave = updatedTaskObj;
      return updatedTaskObj;
    });

    setTasks(updatedTasks);
    storage.saveTasks(updatedTasks);
    if (targetTaskToSave) {
      firebaseService.saveTask(targetTaskToSave);
    }
  };

  // Review Extension
  const reviewExtension = (
    taskId: string, 
    extensionId: string, 
    decision: 'APPROVED' | 'DECLINED', 
    comment?: string
  ) => {
    if (!currentUser) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    let targetTaskToSave: Task | null = null;

    const updatedTasks = tasks.map(task => {
      if (task.id !== taskId) return task;

      let newDeadline = task.deadline;
      const exts = task.extensionRequests.map(ext => {
        if (ext.id === extensionId) {
          if (decision === 'APPROVED') {
            newDeadline = ext.requestedDeadline;
          }
          return { ...ext, status: decision, reviewComment: comment };
        }
        return ext;
      });

      const activity = {
        id: `ACT_${Date.now()}`,
        taskId: task.id,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: ROLE_LABELS[activeRole],
        action: decision === 'APPROVED' ? ('APPROVE_EXTENSION' as const) : ('REJECT_EXTENSION' as const),
        content: decision === 'APPROVED' 
          ? `Chấp thuận gia hạn thời hạn mới: ${newDeadline}. Ghi chú: ${comment || 'Đồng ý'}`
          : `Từ chối gia hạn. Ghi chú: ${comment || 'Giữ nguyên thời hạn cũ'}`,
        timestamp: now,
      };

      const updatedTaskObj = {
        ...task,
        deadline: newDeadline,
        extensionRequests: exts,
        activities: [...task.activities, activity],
        updatedAt: now,
      };

      targetTaskToSave = updatedTaskObj;
      return updatedTaskObj;
    });

    setTasks(updatedTasks);
    storage.saveTasks(updatedTasks);
    if (targetTaskToSave) {
      firebaseService.saveTask(targetTaskToSave);
    }
  };

  // Approve Task Completion by Assigner
  const approveTaskCompletion = (
    taskId: string, 
    decision: 'APPROVE' | 'REVISE', 
    feedback?: string
  ) => {
    if (!currentUser) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    let targetTaskToSave: Task | null = null;

    const updatedTasks = tasks.map(task => {
      if (task.id !== taskId) return task;

      const finalStatus: TaskStatus = decision === 'APPROVE' ? 'COMPLETED' : 'IN_PROGRESS';

      const activity = {
        id: `ACT_${Date.now()}`,
        taskId: task.id,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: ROLE_LABELS[activeRole],
        action: decision === 'APPROVE' ? ('APPROVE_TASK' as const) : ('REJECT_TASK' as const),
        content: decision === 'APPROVE' 
          ? `Đã nghiệm thu và xác nhận HOÀN THÀNH công việc. ${feedback ? 'Nhận xét: ' + feedback : ''}`
          : `Yêu cầu làm lại / bổ sung. ${feedback ? 'Lý do: ' + feedback : ''}`,
        timestamp: now,
      };

      const updatedTaskObj = {
        ...task,
        status: finalStatus,
        activities: [...task.activities, activity],
        updatedAt: now,
      };

      targetTaskToSave = updatedTaskObj;
      return updatedTaskObj;
    });

    setTasks(updatedTasks);
    storage.saveTasks(updatedTasks);
    if (targetTaskToSave) {
      firebaseService.saveTask(targetTaskToSave);
    }
  };

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
