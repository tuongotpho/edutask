import { LeaveRequest, LeaveType, LeaveSession, ApprovalStatus, LeaveHistoryLog, AttachmentFile } from '@/Edu-task/types/leave';
import { User, RoleType, ROLE_LABELS } from '@/Edu-task/types/user';
import { AppNotification } from '@/Edu-task/types/notification';
import { storage } from '@/Edu-task/lib/storage';
import { genId } from '@/Edu-task/lib/utils';
import { findLeaveConflict, LeaveConflictResult } from '@/Edu-task/lib/leaveConflict';
import { canApproveLeaveStep } from '@/Edu-task/lib/permissions';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';
import { buildApprovalSteps } from '@/Edu-task/lib/workflow';
import { WorkflowConfig, TelegramConfig } from '@/Edu-task/types/settings';
import { telegramService, telegramMessages } from '@/Edu-task/services/telegramService';
import { LEAVE_TYPE_LABELS } from '@/Edu-task/types/leave';

interface LeaveLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  users: User[];
  leaves: LeaveRequest[];
  setLeaves: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  notify: (kind: ToastKind, text: string) => void;
  workflowConfig: WorkflowConfig;
  telegramConfig: TelegramConfig;
}

const SAVE_FAILED = 'Không lưu được lên máy chủ. Thay đổi đã được hoàn tác — vui lòng thử lại.';

export function useLeaveLogic({ currentUser, activeRole, users, leaves, setLeaves, setNotifications, notify, workflowConfig, telegramConfig }: LeaveLogicProps) {

  /**
   * Applies an optimistic update, then persists it. On rejection (offline, or
   * blocked by security rules) the previous state is restored and the user is
   * told, so the UI never claims a save that the server refused.
   */
  const commit = async (nextLeaves: LeaveRequest[], leaveToSave: LeaveRequest): Promise<boolean> => {
    const previousLeaves = leaves;
    setLeaves(nextLeaves);
    storage.saveLeaves(nextLeaves);
    try {
      await firebaseService.saveLeave(leaveToSave);
      return true;
    } catch (err) {
      console.error('Failed to save leave request:', err);
      setLeaves(previousLeaves);
      storage.saveLeaves(previousLeaves);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  // Notifications are secondary to the record they announce: a delivery failure
  // is logged but never rolls back the leave request itself.
  const pushNotification = async (notif: AppNotification) => {
    storage.addNotification(notif);
    try {
      await firebaseService.saveNotification(notif);
    } catch (err) {
      console.error('Failed to save notification:', err);
    }
  };

  const getTeacherLeaveConflict = (
    teacherId: string,
    startDate: string,
    endDate: string,
    session: LeaveSession = 'FULL_DAY',
    excludeLeaveId?: string
  ): LeaveConflictResult =>
    findLeaveConflict(leaves, teacherId, startDate, endDate, session, excludeLeaveId);

  const createLeaveRequest = async (data: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    session: LeaveSession;
    reason: string;
    substituteTeacherId?: string;
    notes?: string;
    /** Pre-generated so attachments can be uploaded under this id before saving. */
    id?: string;
    proofFiles?: AttachmentFile[];
  }): Promise<LeaveRequest | null> => {
    if (!currentUser) throw new Error('User not logged in');

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

    // Length and leave type decide whether Ban Giám Hiệu is involved; the school
    // configures the threshold in the RBAC screen.
    const steps = buildApprovalSteps(workflowConfig, data.leaveType, totalDays);

    const nowMs = Date.now();
    // `genId` guarantees a unique document id even for same-millisecond creates;
    // the human-facing code stays time-based for readability.
    const newCode = `ĐXN-2026-${nowMs.toString().slice(-6)}`;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const newLeave: LeaveRequest = {
      id: data.id ?? genId('LV_2026'),
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
      proofFiles: data.proofFiles ?? [],
      currentStepIndex: 0,
      steps,
      overallStatus: 'IN_REVIEW',
      history: [
        {
          id: genId('HIST'),
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

    const ok = await commit([newLeave, ...leaves], newLeave);
    if (!ok) return null;

    const groupLeaders = users.filter(u => u.departmentId === currentUser.departmentId && (u.roles.includes('GROUP_LEADER') || u.roles.includes('HEAD_OF_DEPT')));
    await Promise.all(groupLeaders
      .filter(gl => gl.id !== currentUser.id)
      .map(gl => pushNotification({
        id: genId('NOTIF'),
        recipientUserId: gl.id,
        title: 'Đơn xin nghỉ phép mới cần duyệt',
        message: `${currentUser.fullName} vừa gửi đơn xin nghỉ ${totalDays} ngày (${data.startDate}). Cần phân công dạy thay & duyệt.`,
        type: 'LEAVE_REQUEST',
        isRead: false,
        createdAt: now,
      })));

    // Group announcement. Fire-and-forget by design: a Telegram outage must not
    // affect a request that is already saved.
    void telegramService.notify(telegramConfig, 'LEAVE_CREATED', telegramMessages.leaveCreated({
      applicantName: currentUser.fullName,
      departmentName: currentUser.departmentName,
      leaveTypeLabel: LEAVE_TYPE_LABELS[data.leaveType].label,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays,
      reason: data.reason,
    }));

    notify('success', 'Đã gửi đơn xin nghỉ phép thành công.');
    return newLeave;
  };

  const cancelLeaveRequest = async (leaveId: string, cancelReason?: string): Promise<boolean> => {
    const leave = leaves.find(l => l.id === leaveId);
    if (!leave) return false;

    const actorName = currentUser?.fullName || 'Người dùng';
    const actorRole = ROLE_LABELS[activeRole] || activeRole;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const historyLog: LeaveHistoryLog = {
      id: genId('HIST'),
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

    const ok = await commit(leaves.map(l => (l.id === leaveId ? updatedLeave : l)), updatedLeave);
    if (!ok) return false;

    if (leave.substituteTeacherId && leave.substituteTeacherId !== currentUser?.id) {
      await pushNotification({
        id: genId('NOTIF'),
        recipientUserId: leave.substituteTeacherId,
        title: '❌ Thông báo HỦY lịch dạy thay',
        message: `Giáo viên ${leave.applicantName} đã HỦY đơn xin nghỉ phép (${leave.startDate} → ${leave.endDate}). Bạn KHÔNG cần dạy thay trong khoảng thời gian này nữa.`,
        type: 'LEAVE_REQUEST',
        createdAt: now,
        isRead: false,
      });
    }

    const deptLeaders = users.filter(u =>
      u.departmentId === leave.departmentId &&
      u.roles.some(r => r === 'HEAD_OF_DEPT' || r === 'GROUP_LEADER') &&
      u.id !== currentUser?.id
    );
    await Promise.all(deptLeaders.map(leader => pushNotification({
      id: genId('NOTIF'),
      recipientUserId: leader.id,
      title: '🚫 Thông báo HỦY đơn nghỉ phép tổ chuyên môn',
      message: `Giáo viên ${leave.applicantName} (${leave.departmentName}) đã HỦY đơn xin nghỉ phép từ ${leave.startDate} đến ${leave.endDate}.`,
      type: 'LEAVE_REQUEST',
      createdAt: now,
      isRead: false,
    })));

    const bghUsers = users.filter(u =>
      u.roles.some(r => r === 'PRINCIPAL' || r === 'VICE_PRINCIPAL' || r === 'ADMIN') &&
      u.id !== currentUser?.id &&
      !deptLeaders.some(dl => dl.id === u.id)
    );
    await Promise.all(bghUsers.map(bgh => pushNotification({
      id: genId('NOTIF'),
      recipientUserId: bgh.id,
      title: '📢 [BGH] Thông báo HỦY lịch nghỉ phép',
      message: `Giáo viên ${leave.applicantName} (${leave.departmentName}) đã HỦY đơn xin nghỉ phép (${leave.startDate} → ${leave.endDate}). Lịch dạy thay và thời gian giảng dạy đã được giải phóng.`,
      type: 'LEAVE_REQUEST',
      createdAt: now,
      isRead: false,
    })));

    if (currentUser) {
      setNotifications(storage.getNotifications(currentUser.id));
    }

    notify('success', 'Đã hủy đơn xin nghỉ phép. Lịch dạy thay đã được giải phóng.');
    return true;
  };

  const deleteLeaveRequest = async (leaveId: string): Promise<boolean> => {
    const previousLeaves = leaves;
    const updatedLeaves = leaves.filter(l => l.id !== leaveId);
    setLeaves(updatedLeaves);
    storage.saveLeaves(updatedLeaves);

    try {
      await firebaseService.deleteLeave(leaveId);
      return true;
    } catch (err) {
      console.error('Failed to delete leave request:', err);
      setLeaves(previousLeaves);
      storage.saveLeaves(previousLeaves);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const updateLeaveRequest = async (
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
  ): Promise<boolean> => {
    if (!currentUser) return false;
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
        id: genId('HIST'),
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
        proofFiles: data.proofFiles ?? leave.proofFiles,
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

    if (!targetLeaveToSave) return false;
    return commit(updatedLeaves, targetLeaveToSave);
  };

  const changeSubstituteTeacher = async (leaveId: string, newSubstituteTeacherId: string): Promise<boolean> => {
    if (!currentUser) return false;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const newSubUser = users.find(u => u.id === newSubstituteTeacherId);
    if (!newSubUser) return false;

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
        id: genId('HIST'),
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

    if (!targetLeaveToSave) return false;
    const ok = await commit(updatedLeaves, targetLeaveToSave);
    if (!ok) return false;

    const targetLeave = leaves.find(l => l.id === leaveId);
    await pushNotification({
      id: genId('NOTIF'),
      recipientUserId: newSubUser.id,
      title: 'Được phân công dạy thay mới',
      message: `${currentUser.fullName} đã điều chỉnh phân công bạn dạy thay cho đơn xin nghỉ của ${targetLeave?.applicantName || 'đồng nghiệp'}.`,
      type: 'LEAVE_REQUEST',
      isRead: false,
      createdAt: now,
    });

    notify('success', `Đã phân công ${newSubUser.fullName} dạy thay.`);
    return true;
  };

  const processLeaveStep = async (
    leaveId: string,
    decision: ApprovalStatus,
    comment?: string,
    assignedSubstituteTeacherId?: string
  ): Promise<boolean> => {
    if (!currentUser) return false;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    let targetLeaveToSave: LeaveRequest | null = null;
    // Captured before the update advances the pointer, so the announcement names
    // the step that was actually signed rather than the next one.
    let currentStepIndexAtDecision = 0;

    const updatedLeaves = leaves.map(leave => {
      if (leave.id !== leaveId) return leave;

      const steps = [...leave.steps];
      const currIdx = leave.currentStepIndex;
      currentStepIndexAtDecision = currIdx;
      const targetStep = steps[currIdx];

      if (!canApproveLeaveStep({
        user: currentUser,
        activeRole,
        stepLevel: targetStep.level,
        leaveDepartmentId: leave.departmentId,
      })) {
        const isExecutiveStep = targetStep.level === 'VICE_PRINCIPAL' || targetStep.level === 'PRINCIPAL';
        throw new Error(isExecutiveStep
          ? 'Từ chối: Tổ trưởng không có quyền phê duyệt đơn ở cấp Ban Giám Hiệu.'
          : 'Từ chối: Bạn không có quyền phê duyệt đơn xin nghỉ phép của tổ khác.');
      }

      let subId = leave.substituteTeacherId;
      let subName = leave.substituteTeacherName;

      if (decision === 'APPROVED' && currIdx === 0) {
        if (assignedSubstituteTeacherId) {
          subId = assignedSubstituteTeacherId;
          const matchedUser = users.find(u => u.id === assignedSubstituteTeacherId);
          subName = matchedUser?.fullName || 'Giáo viên dạy thay';
        }
        if (!subId) {
          throw new Error('Vui lòng phân công Giáo viên dạy thay trước khi phê duyệt đơn.');
        }

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
        id: genId('HIST'),
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

    if (!targetLeaveToSave) return false;
    const saved = await commit(updatedLeaves, targetLeaveToSave);
    if (!saved) return false;

    const decided = targetLeaveToSave as LeaveRequest;
    const decisionLabel =
      decision === 'APPROVED'
        ? (decided.overallStatus === 'APPROVED' ? 'ĐÃ DUYỆT HOÀN TẤT' : 'đã qua một cấp duyệt')
        : decision === 'REJECTED' ? 'BỊ TỪ CHỐI' : 'YÊU CẦU CHỈNH SỬA';

    void telegramService.notify(telegramConfig, 'LEAVE_DECIDED', telegramMessages.leaveDecided({
      applicantName: decided.applicantName,
      decisionLabel,
      stepLabel: decided.steps[Math.min(currentStepIndexAtDecision, decided.steps.length - 1)]?.levelLabel ?? 'Người duyệt',
      approverName: currentUser.fullName,
      comment,
    }));

    return true;
  };

  return {
    getTeacherLeaveConflict,
    createLeaveRequest,
    cancelLeaveRequest,
    deleteLeaveRequest,
    updateLeaveRequest,
    changeSubstituteTeacher,
    processLeaveStep,
  };
}
