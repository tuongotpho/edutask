'use client';

import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { LeaveRequest, LEAVE_TYPE_LABELS, ApprovalStatus } from '@/Edu-task/types/leave';
import { ROLE_LABELS } from '@/Edu-task/types/user';
import { ConfirmModal } from '@/Edu-task/components/common/ConfirmModal';
import { canApproveLeaveStep, canViewLeave, isDeptLeader, isSchoolLeadership } from '@/Edu-task/lib/permissions';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  History,
  FileCheck,
  UserCheck,
  Edit
} from 'lucide-react';

interface LeaveDetailModalProps {
  leave: LeaveRequest | null;
  onClose: () => void;
  onEditLeave?: (leave: LeaveRequest) => void;
}

export function LeaveDetailModal({ leave, onClose, onEditLeave }: LeaveDetailModalProps) {
  const { currentUser, activeRole, processLeaveStep, changeSubstituteTeacher, cancelLeaveRequest, deleteLeaveRequest, getTeacherLeaveConflict, users, showToast } = useApp();
  // Seeded once per mount. The caller keys this modal by leave id, so opening a
  // different request remounts with fresh values. Re-syncing on every `leave`
  // change (as before) also fired on each Firestore snapshot, which silently
  // discarded a substitute the approver had just picked.
  const [comment, setComment] = useState('');
  const [selectedSubId, setSelectedSubId] = useState(leave?.substituteTeacherId || '');
  const [newSubId, setNewSubId] = useState(leave?.substituteTeacherId || '');
  const [isChangingSub, setIsChangingSub] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  if (!leave || !currentUser) return null;

  const isSchoolLeadershipOrAdmin = isSchoolLeadership(currentUser, activeRole);
  const isDeptHeader = isDeptLeader(currentUser, activeRole);

  if (!canViewLeave(currentUser, activeRole, leave)) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center space-y-3 shadow-2xl border border-slate-200 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center font-bold text-xl mx-auto">
            🚫
          </div>
          <h3 className="font-bold text-slate-900 text-base">Truy Cập Bị Từ Chối</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tài khoản Giáo viên không có quyền xem đơn xin nghỉ phép của giáo viên thuộc tổ khác hoặc đơn không thuộc quyền quản lý.
          </p>
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors">
            Đóng Cửa Sổ
          </button>
        </div>
      </div>
    );
  }

  const isDeptLeaderOrAdmin = 
    isSchoolLeadershipOrAdmin || 
    (isDeptHeader && leave.departmentId === currentUser?.departmentId);

  // Determine if active role can approve current pending step. Uses the same
  // helper as `processLeaveStep`, so the button can never appear for an action
  // the handler will reject.
  const currentPendingStep = leave.steps[leave.currentStepIndex];

  const canApprove =
    leave.overallStatus === 'IN_REVIEW' &&
    !!currentPendingStep &&
    currentPendingStep.status === 'PENDING' &&
    canApproveLeaveStep({
      user: currentUser,
      activeRole,
      stepLevel: currentPendingStep.level,
      leaveDepartmentId: leave.departmentId,
    });

  const isStepGroupLeader = leave.currentStepIndex === 0;

  const handleAction = async (decision: ApprovalStatus) => {
    if (decision === 'APPROVED' && isStepGroupLeader) {
      if (!selectedSubId && !leave.substituteTeacherId) {
        showToast('error', 'Vui lòng chọn Giáo viên dạy thay trước khi phê duyệt đơn!');
        return;
      }
    }

    setIsProcessing(true);
    try {
      // Validation problems throw; a rejected write resolves false and has
      // already told the user, so in both cases the modal stays open.
      if (await processLeaveStep(leave.id, decision, comment, selectedSubId)) {
        setComment('');
        onClose();
      }
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Có lỗi xảy ra khi xử lý đơn.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isCanceledAndCanBeDeleted = (leave.applicantId === currentUser.id || activeRole === 'ADMIN' || currentUser.roles?.includes('ADMIN')) && leave.overallStatus === 'CANCELLED';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono text-xs font-bold border border-indigo-500/30">
              {leave.code}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Chi Tiết Đơn Xin Nghỉ Phép</h3>
              <p className="text-xs text-slate-400">Trình trạng: {leave.overallStatus}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-xs max-h-[80vh] overflow-y-auto">

          {/* Cancelled Banner */}
          {leave.overallStatus === 'CANCELLED' && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 font-semibold space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-rose-700">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>ĐƠN XIN NGHỈ PHÉP ĐÃ BỊ HỦY</span>
              </div>
              <p className="text-xs text-rose-700 font-normal">
                Giáo viên đã chủ động hủy đơn nghỉ phép này. Lịch dạy thay và thời gian của giáo viên đã được giải phóng hoàn toàn khỏi hệ thống.
              </p>
            </div>
          )}

          {/* Workflow Stepper */}
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-3">
              Luồng Duyệt Đa Cấp (Nhóm trưởng / Tổ trưởng → Ban Giám Hiệu)
            </div>
            <div className="grid grid-cols-2 gap-3">
              {leave.steps.map((step, idx) => {
                const isCurrent = leave.currentStepIndex === idx && leave.overallStatus === 'IN_REVIEW';
                const isPassed = idx < leave.currentStepIndex || leave.overallStatus === 'APPROVED';
                const isRejected = step.status === 'REJECTED';

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20'
                        : isPassed
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : isRejected
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-500">Bước {idx + 1}</span>
                      {step.status === 'APPROVED' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      {step.status === 'REJECTED' && <XCircle className="w-4 h-4 text-rose-600" />}
                      {step.status === 'PENDING' && isCurrent && <Clock className="w-4 h-4 text-amber-600 animate-pulse" />}
                    </div>
                    <div className="font-bold text-slate-900 leading-tight mb-1">{step.levelLabel}</div>
                    <div className="text-[10px] text-slate-500">
                      {step.approverName ? step.approverName : (isCurrent ? 'Đang chờ duyệt...' : 'Chưa xử lý')}
                    </div>
                    {step.comment && (
                      <div className="mt-2 text-[10px] bg-white/80 p-1.5 rounded-lg text-slate-700 italic border border-slate-200/50">
                        &quot;{step.comment}&quot;
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Applicant & Leave Summary */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Người xin nghỉ</span>
                <span className="font-bold text-slate-900">{leave.applicantName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Tổ môn</span>
                <span className="font-bold text-slate-800">{leave.departmentName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Loại nghỉ</span>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${LEAVE_TYPE_LABELS[leave.leaveType].bg}`}>
                  {LEAVE_TYPE_LABELS[leave.leaveType].label}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Thời gian nghỉ</span>
                <span className="font-bold text-slate-900">{leave.startDate} → {leave.endDate} ({leave.totalDays} ngày)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Lý do xin nghỉ</span>
                <p className="text-slate-800 font-medium leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200/80 mt-1">
                  {leave.reason}
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 block text-[10px] font-semibold">Người dạy thay</span>
                  {isDeptLeaderOrAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsChangingSub(!isChangingSub)}
                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      <span>{isChangingSub ? 'Đóng' : 'Đổi người dạy thay'}</span>
                    </button>
                  )}
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 mt-1 text-slate-800 font-medium">
                  {leave.substituteTeacherName ? (
                    <div className="flex items-center space-x-1.5 text-emerald-700">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{leave.substituteTeacherName} (Đã phân công)</span>
                    </div>
                  ) : (
                    <span className="text-amber-600 font-bold">⚠️ Chưa phân công dạy thay</span>
                  )}
                  {leave.notes && <p className="text-slate-500 text-[11px] mt-1 italic">{leave.notes}</p>}
                </div>

                {/* Inline Substitute Adjustment Box for Dept Leader / Admin */}
                {isChangingSub && (
                  <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2 text-xs">
                    <label className="block font-bold text-amber-900 text-[11px]">Chọn giáo viên dạy thay mới:</label>
                    <select
                      value={newSubId}
                      onChange={(e) => setNewSubId(e.target.value)}
                      className="w-full p-2 bg-white rounded-lg border border-amber-300 font-semibold text-slate-800 focus:outline-none text-xs"
                    >
                      <option value="">-- Chọn giáo viên dạy thay --</option>
                      {users
                        .filter(u => u.id !== leave.applicantId)
                        .map(u => {
                          const conflict = getTeacherLeaveConflict(u.id, leave.startDate, leave.endDate, leave.session, leave.id);
                          return (
                            <option key={u.id} value={u.id} disabled={conflict.hasConflict}>
                              {conflict.hasConflict
                                ? `🚫 ${u.fullName} (${u.departmentName}) - Đang xin nghỉ phép (${conflict.conflictDetail?.startDate} → ${conflict.conflictDetail?.endDate})`
                                : `${u.fullName} (${u.departmentName} - ${u.subject || 'Chuyên môn'})`}
                            </option>
                          );
                        })}
                    </select>
                    <button
                      type="button"
                      disabled={!newSubId}
                      onClick={async () => {
                        if (!newSubId) return;
                        try {
                          if (await changeSubstituteTeacher(leave.id, newSubId)) {
                            setIsChangingSub(false);
                          }
                        } catch (err: unknown) {
                          showToast('error', err instanceof Error ? err.message : 'Không thể đổi người dạy thay.');
                        }
                      }}
                      className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition-colors"
                    >
                      Lưu Điều Chỉnh Dạy Thay (Ghi Log)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Applicant Edit Option (If status is REQUEST_EDIT or IN_REVIEW) */}
          {leave.applicantId === currentUser.id && (leave.overallStatus === 'REQUEST_EDIT' || leave.overallStatus === 'IN_REVIEW') && (
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-amber-900 text-xs">
                  {leave.overallStatus === 'REQUEST_EDIT' 
                    ? '⚠️ Đơn xin nghỉ được yêu cầu chỉnh sửa thông tin' 
                    : 'Đơn đang trong luồng duyệt (Bạn có thể chỉnh sửa lại thông tin)'}
                </div>
                <div className="text-amber-800 text-[11px] mt-0.5">Bấm vào nút bên phải để cập nhật thời gian nghỉ, lý do và gửi lại cho Tổ trưởng.</div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  if (onEditLeave) onEditLeave(leave);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors flex-shrink-0"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Chỉnh Sửa Đơn Xin Nghỉ</span>
              </button>
            </div>
          )}

          {/* Cancel Action Bar for Applicant */}
          {leave.applicantId === currentUser.id && leave.overallStatus !== 'CANCELLED' && (
            <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-rose-900 block text-xs">Hủy Đơn & Giải Phóng Lịch Dạy Thay</span>
                <span className="text-[11px] text-rose-700">Giáo viên có thể chủ động hủy đơn xin nghỉ phép. Hệ thống sẽ giải phóng lịch nghỉ và thông báo đến các bên.</span>
              </div>

              {!showCancelPrompt ? (
                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all flex-shrink-0"
                >
                  🚫 Hủy Đơn Xin Nghỉ Phép
                </button>
              ) : (
                <div className="w-full space-y-2 pt-1 border-t border-rose-200">
                  <input
                    type="text"
                    value={cancelReasonInput}
                    onChange={(e) => setCancelReasonInput(e.target.value)}
                    placeholder="Nhập lý do hủy đơn (VD: Thay đổi kế hoạch cá nhân)..."
                    className="w-full p-2 rounded-xl border border-rose-300 bg-white text-xs text-slate-800 font-medium focus:outline-none"
                  />
                  <div className="flex space-x-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCancelPrompt(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs"
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (await cancelLeaveRequest(leave.id, cancelReasonInput)) {
                          setShowCancelPrompt(false);
                          onClose();
                        }
                      }}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm"
                    >
                      Xác Nhận Hủy Đơn
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delete Action Bar for Cancelled / Draft Leaves */}
          {isCanceledAndCanBeDeleted && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-slate-200 transition-all"
              >
                🗑️ Xóa Đơn Khỏi Danh Sách
              </button>
            </div>
          )}

          <ConfirmModal
            isOpen={isDeleteModalOpen}
            title="Xóa đơn nghỉ phép"
            message="Bạn có chắc chắn muốn XÓA vĩnh viễn đơn nghỉ phép này khỏi danh sách?"
            confirmText="Xóa vĩnh viễn"
            onConfirm={async () => {
              setIsDeleteModalOpen(false);
              if (await deleteLeaveRequest(leave.id)) onClose();
            }}
            onCancel={() => setIsDeleteModalOpen(false)}
          />

          {/* Action Box for Authorized Approver */}
          {canApprove && (
            <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-indigo-600" />
                  Thao Tác Phê Duyệt (Vai trò: {ROLE_LABELS[activeRole]})
                </span>
              </div>

              {/* Mandatory Substitute Teacher Selection for Group Leader / Dept Head */}
              {isStepGroupLeader && (
                <div className="bg-amber-100/90 p-3 rounded-xl border border-amber-300 space-y-1.5">
                  <label className="block font-bold text-amber-900 text-xs flex items-center gap-1">
                    <UserCheck className="w-4 h-4 text-amber-700" />
                    <span>Phân công Giáo viên dạy thay (BẮT BUỘC):</span>
                  </label>
                  <select
                    value={selectedSubId}
                    onChange={(e) => setSelectedSubId(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-amber-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Bấm chọn giáo viên dạy thay --</option>
                    {users
                      .filter(u => u.id !== leave.applicantId)
                      .map(u => {
                        const conflict = getTeacherLeaveConflict(u.id, leave.startDate, leave.endDate, leave.session, leave.id);
                        return (
                          <option key={u.id} value={u.id} disabled={conflict.hasConflict}>
                            {conflict.hasConflict
                              ? `🚫 ${u.fullName} (${u.departmentName}) - Đang xin nghỉ phép (${conflict.conflictDetail?.startDate} → ${conflict.conflictDetail?.endDate})`
                              : `${u.fullName} (${u.departmentName} - ${u.subject || 'Chuyên môn'})`}
                          </option>
                        );
                      })
                    }
                  </select>
                </div>
              )}

              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Nhập ý kiến / ghi chú phê duyệt (nếu có)..."
                className="w-full p-2.5 rounded-xl border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-xs"
              />

              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => handleAction('REQUEST_EDIT')}
                  disabled={isProcessing}
                  className="px-3.5 py-1.5 rounded-xl border border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold"
                >
                  Yêu Cầu Chỉnh Sửa
                </button>
                <button
                  onClick={() => handleAction('REJECTED')}
                  disabled={isProcessing}
                  className="px-3.5 py-1.5 rounded-xl border border-rose-300 bg-rose-100 hover:bg-rose-200 text-rose-900 font-semibold"
                >
                  Từ Chối
                </button>
                <button
                  onClick={() => handleAction('APPROVED')}
                  disabled={isProcessing}
                  className="px-5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm"
                >
                  Đồng Ý Phê Duyệt
                </button>
              </div>
            </div>
          )}

          {/* Audit History Timeline */}
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2.5 flex items-center space-x-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Lịch Sử & Nhật Ký Duyệt (Audit Log)</span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {leave.history.map((log) => (
                <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between">
                  <div>
                    <div className="font-bold text-slate-800">{log.action}</div>
                    <div className="text-[10px] text-slate-500">Bởi: {log.actorName} ({log.actorRole})</div>
                    {log.note && <div className="text-[11px] text-slate-600 mt-0.5 italic">&quot;{log.note}&quot;</div>}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
