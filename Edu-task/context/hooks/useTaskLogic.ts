import { Task, TaskPriority, TaskStatus } from '@/Edu-task/types/task';
import { User, RoleType, ROLE_LABELS } from '@/Edu-task/types/user';
import { AppNotification } from '@/Edu-task/types/notification';
import { storage } from '@/Edu-task/lib/storage';
import { genId } from '@/Edu-task/lib/utils';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

interface TaskLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  users: User[];
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được lên máy chủ. Thay đổi đã được hoàn tác — vui lòng thử lại.';

export function useTaskLogic({ currentUser, activeRole, users, tasks, setTasks, notify }: TaskLogicProps) {

  /**
   * Applies an optimistic update, then persists it. If the write is rejected
   * (offline, or blocked by security rules) the local state is restored and the
   * user is told — otherwise the UI would keep showing data the server discarded.
   */
  const commit = async (nextTasks: Task[], taskToSave: Task): Promise<boolean> => {
    const previousTasks = tasks;
    setTasks(nextTasks);
    storage.saveTasks(nextTasks);
    try {
      await firebaseService.saveTask(taskToSave);
      return true;
    } catch (err) {
      console.error('Failed to save task:', err);
      setTasks(previousTasks);
      storage.saveTasks(previousTasks);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const createTask = async (data: {
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
  }): Promise<Task | null> => {
    if (!currentUser) throw new Error('User not logged in');

    let assigneesList: Task['assignees'] = [];
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
    const viewerIds: string[] = [currentUser.id]; // Assigner

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
    const nowMs = Date.now();
    // `genId` appends random entropy so document ids are unique even when two
    // tasks are created in the same millisecond (a bare timestamp is not).
    const taskId = genId('TSK_2026');
    const newCode = `CV-2026-${nowMs.toString().slice(-6)}`;

    const newTask: Task = {
      id: taskId,
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
          id: genId('ACT'),
          taskId: taskId,
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

    const ok = await commit([newTask, ...tasks], newTask);
    if (!ok) return null;

    // Notify Assignees. These are secondary: a failed notification must not undo
    // the task itself, so they are reported but not rolled back.
    await Promise.all(assigneesList.map(async assignee => {
      const notif: AppNotification = {
        id: genId('NOTIF'),
        recipientUserId: assignee.userId,
        title: 'Công việc mới được giao',
        message: `${currentUser.fullName} đã giao công việc: "${data.title}" (Hạn: ${data.deadline}).`,
        type: 'TASK_ASSIGNED',
        isRead: false,
        createdAt: now,
      };
      storage.addNotification(notif);
      try {
        await firebaseService.saveNotification(notif);
      } catch (err) {
        console.error('Failed to send task notification:', err);
      }
    }));

    notify('success', 'Đã phát hành công việc thành công.');
    return newTask;
  };

  const updateTaskProgress = async (
    taskId: string,
    newStatus: TaskStatus,
    reportNotes?: string
  ): Promise<boolean> => {
    if (!currentUser) return false;
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
        id: genId('ACT'),
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

    if (!targetTaskToSave) return false;
    return commit(updatedTasks, targetTaskToSave);
  };

  const requestExtension = async (taskId: string, requestedDeadline: string, reason: string): Promise<boolean> => {
    if (!currentUser) return false;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    let targetTaskToSave: Task | null = null;

    const updatedTasks = tasks.map(task => {
      if (task.id !== taskId) return task;

      const extReq = {
        id: genId('EXT'),
        requestedByUserId: currentUser.id,
        requestedByUserName: currentUser.fullName,
        currentDeadline: task.deadline,
        requestedDeadline,
        reason,
        status: 'PENDING' as const,
        createdAt: now,
      };

      const activity = {
        id: genId('ACT'),
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

    if (!targetTaskToSave) return false;
    return commit(updatedTasks, targetTaskToSave);
  };

  const reviewExtension = async (
    taskId: string,
    extensionId: string,
    decision: 'APPROVED' | 'DECLINED',
    comment?: string
  ): Promise<boolean> => {
    if (!currentUser) return false;
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
        id: genId('ACT'),
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

    if (!targetTaskToSave) return false;
    return commit(updatedTasks, targetTaskToSave);
  };

  const approveTaskCompletion = async (
    taskId: string,
    decision: 'APPROVE' | 'REVISE',
    feedback?: string
  ): Promise<boolean> => {
    if (!currentUser) return false;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    let targetTaskToSave: Task | null = null;

    const updatedTasks = tasks.map(task => {
      if (task.id !== taskId) return task;

      const finalStatus: TaskStatus = decision === 'APPROVE' ? 'COMPLETED' : 'IN_PROGRESS';

      const activity = {
        id: genId('ACT'),
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

    if (!targetTaskToSave) return false;
    return commit(updatedTasks, targetTaskToSave);
  };

  const deleteTask = async (taskId: string): Promise<boolean> => {
    const previousTasks = tasks;
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    setTasks(updatedTasks);
    storage.saveTasks(updatedTasks);

    try {
      await firebaseService.deleteTask(taskId);
      return true;
    } catch (err) {
      console.error('Failed to delete task:', err);
      setTasks(previousTasks);
      storage.saveTasks(previousTasks);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  return {
    createTask,
    updateTaskProgress,
    requestExtension,
    reviewExtension,
    approveTaskCompletion,
    deleteTask,
  };
}
