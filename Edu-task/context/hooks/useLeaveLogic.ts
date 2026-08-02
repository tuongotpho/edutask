import { LeaveRequest, LeaveType, LeaveSession, ApprovalStatus, LeaveHistoryLog } from '@/Edu-task/types/leave';
import { User, RoleType, ROLE_LABELS } from '@/Edu-task/types/user';
import { AppNotification } from '@/Edu-task/types/notification';
import { storage } from '@/Edu-task/lib/storage';
import { firebaseService } from '@/Edu-task/services/firebaseService';

interface LeaveLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  users: User[];
  leaves: LeaveRequest[];
  setLeaves: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
}

export function useLeaveLogic({ currentUser, activeRole, users, leaves, setLeaves, setNotifications }: LeaveLogicProps) {
  
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
      const dateOverlap = startDate <= leave.endDate && endDate >= leave.startDate;
      if (dateOverlap) {
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

    const groupLeaders = users.filter(u => u.departmentId === currentUser.departmentId && (u.roles.includes('GROUP_LEADER') || u.roles.includes('HEAD_OF_DEPT')));
    for (const gl of groupLeaders) {
      if (gl.id !== currentUser.id) {
        const notif: AppNotification = {
          id: `NOTIF_${Date.now()}_${Math.random()}`,
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

  const deleteLeaveRequest = (leaveId: string) => {
    const updatedLeaves = leaves.filter(l => l.id !== leaveId);
    setLeaves(updatedLeaves);
    storage.saveLeaves(updatedLeaves);
  };

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
