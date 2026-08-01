'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleType, ROLE_LABELS } from '@/Edu-task/types/user';
import { LeaveRequest, LeaveType, LeaveSession, ApprovalStatus } from '@/Edu-task/types/leave';
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
  
  // Auth & Account Management
  loginWithFirebase: (email: string, pass: string) => Promise<void>;
  registerWithFirebase: (email: string, pass: string, fullName: string, deptId: string, deptName: string) => Promise<void>;
  loginAsDemoUser: (email: string) => void;
  logout: () => Promise<void>;
  
  // User Management
  addUserProfile: (user: User) => Promise<void>;
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
  
  processLeaveStep: (
    leaveId: string, 
    decision: ApprovalStatus, 
    comment?: string
  ) => void;
  
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
  
  // Conflict Checker
  getTeacherLeaveConflict: (teacherId: string, startDate: string, endDate: string) => {
    hasConflict: boolean;
    conflictDetail?: LeaveRequest;
  };
  
  // Data Reset
  resetSystemData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(() => storage.getUsers());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<RoleType>('ADMIN');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const [leaves, setLeaves] = useState<LeaveRequest[]>(() => storage.getLeaves());
  const [tasks, setTasks] = useState<Task[]>(() => storage.getTasks());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = firebaseAuthService.onAuthChange(async (fbUser) => {
      if (fbUser) {
        setIsAuthenticated(true);
        // Find matching profile in users list or by email
        const userEmail = fbUser.email?.toLowerCase();
        let match = users.find(u => u.email.toLowerCase() === userEmail || u.id === fbUser.uid);
        if (!match && userEmail === 'admin@gmail.com') {
          match = users.find(u => u.id === 'USR_ADMIN') || await firebaseAuthService.seedAdminUserProfile();
        }
        if (match) {
          setCurrentUser(match);
          setActiveRole(match.activeRole || match.roles[0] || 'ADMIN');
          storage.setCurrentUserId(match.id);
        }
      }
    });
    return () => unsubscribe();
  }, [users]);

  // Seed & Subscribe to Firebase Firestore Realtime Database
  useEffect(() => {
    firebaseService.seedInitialDataIfEmpty();

    const unsubUsers = firebaseService.subscribeUsers((fbUsers) => {
      setUsers(fbUsers);
      storage.saveUsers(fbUsers);
    });

    const unsubLeaves = firebaseService.subscribeLeaves((fbLeaves) => {
      setLeaves(fbLeaves);
      storage.saveLeaves(fbLeaves);
    });

    const unsubTasks = firebaseService.subscribeTasks((fbTasks) => {
      setTasks(fbTasks);
      storage.saveTasks(fbTasks);
    });

    const unsubNotifs = firebaseService.subscribeNotifications((fbNotifs) => {
      if (currentUser) {
        const userNotifs = fbNotifs.filter(n => n.recipientUserId === currentUser.id);
        setNotifications(userNotifs);
      }
    });

    return () => {
      unsubUsers();
      unsubLeaves();
      unsubTasks();
      unsubNotifs();
    };
  }, [currentUser?.id]);

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
  const getTeacherLeaveConflict = (teacherId: string, startDate: string, endDate: string) => {
    const approvedOrPendingLeaves = leaves.filter(l => 
      l.applicantId === teacherId &&
      (l.overallStatus === 'APPROVED' || l.overallStatus === 'IN_REVIEW')
    );

    const targetStart = new Date(startDate).getTime();
    const targetEnd = new Date(endDate).getTime();

    for (const leave of approvedOrPendingLeaves) {
      const lStart = new Date(leave.startDate).getTime();
      const lEnd = new Date(leave.endDate).getTime();

      if (targetStart <= lEnd && targetEnd >= lStart) {
        return { hasConflict: true, conflictDetail: leave };
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
        level: 'HEAD_OF_DEPT' as RoleType,
        levelLabel: 'Tổ trưởng chuyên môn',
        status: 'PENDING' as ApprovalStatus,
      },
      {
        level: 'VICE_PRINCIPAL' as RoleType,
        levelLabel: 'Hiệu phó BGH',
        status: 'PENDING' as ApprovalStatus,
      },
      {
        level: 'PRINCIPAL' as RoleType,
        levelLabel: 'Hiệu trưởng',
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

    // Create Notification for Department Head
    const hod = users.find(u => u.departmentId === currentUser.departmentId && u.roles.includes('HEAD_OF_DEPT'));
    if (hod && hod.id !== currentUser.id) {
      const notif: AppNotification = {
        id: `NOTIF_${Date.now()}`,
        recipientUserId: hod.id,
        title: 'Đơn xin nghỉ phép mới cần duyệt',
        message: `${currentUser.fullName} vừa gửi đơn xin nghỉ ${totalDays} ngày (${data.startDate}).`,
        type: 'LEAVE_REQUEST',
        isRead: false,
        createdAt: now,
      };
      storage.addNotification(notif);
      firebaseService.saveNotification(notif);
    }

    return newLeave;
  };

  // Process Leave Step (Approve / Reject / Request Edit)
  const processLeaveStep = (
    leaveId: string, 
    decision: ApprovalStatus, 
    comment?: string
  ) => {
    if (!currentUser) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    let targetLeaveToSave: LeaveRequest | null = null;

    const updatedLeaves = leaves.map(leave => {
      if (leave.id !== leaveId) return leave;

      const steps = [...leave.steps];
      const currIdx = leave.currentStepIndex;
      if (currIdx >= steps.length) return leave;

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
        if (currIdx === steps.length - 1) {
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
        actorRole: ROLE_LABELS[activeRole],
        timestamp: now,
        note: comment || (decision === 'APPROVED' ? 'Đã thông qua' : ''),
      };

      const updatedLeaveObj = {
        ...leave,
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
        loginWithFirebase,
        registerWithFirebase,
        loginAsDemoUser,
        logout,
        addUserProfile,
        deleteUserProfile,
        switchUser,
        switchActiveRole,
        createLeaveRequest,
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
