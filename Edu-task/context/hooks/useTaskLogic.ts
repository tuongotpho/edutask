import { Task, TaskPriority, TaskStatus } from '@/Edu-task/types/task';
import { User, RoleType, ROLE_LABELS } from '@/Edu-task/types/user';
import { AppNotification } from '@/Edu-task/types/notification';
import { storage } from '@/Edu-task/lib/storage';
import { firebaseService } from '@/Edu-task/services/firebaseService';

interface TaskLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  users: User[];
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

export function useTaskLogic({ currentUser, activeRole, users, tasks, setTasks }: TaskLogicProps) {
  
  const createTask = (data: {
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

    // Build ACL viewerIds
    let viewerIds: string[] = [currentUser.id]; // Assigner
    
    // Add Assignees
    assigneesList.forEach(a => viewerIds.push(a.userId));

    // Handle BGH View for Group Leaders
    if (data.visibilitySettings?.bghCanView) {
      const bghUsers = users.filter(u => u.roles.includes('PRINCIPAL') || u.roles.includes('VICE_PRINCIPAL'));
      bghUsers.forEach(u => viewerIds.push(u.id));
    }

    // Handle specific BGH ticked by Principal
    if (data.visibilitySettings?.specificVicePrincipalIds) {
      data.visibilitySettings.specificVicePrincipalIds.forEach(id => viewerIds.push(id));
    }

    // Handle Group Leaders of assignees
    if (data.visibilitySettings?.assigneeGroupLeadersCanView) {
      const assigneeDeptIds = Array.from(new Set(assigneesList.map(a => {
        const u = users.find(x => x.id === a.userId);
        return u?.departmentId;
      }).filter(Boolean)));

      const groupLeaders = users.filter(u => 
        (u.roles.includes('GROUP_LEADER') || u.roles.includes('HEAD_OF_DEPT')) && 
        assigneeDeptIds.includes(u.departmentId)
      );
      groupLeaders.forEach(u => viewerIds.push(u.id));
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
      viewerIds: Array.from(new Set(viewerIds)),
      visibilitySettings: data.visibilitySettings,
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

  return {
    createTask,
    updateTaskProgress,
    requestExtension,
    reviewExtension,
    approveTaskCompletion,
  };
}
