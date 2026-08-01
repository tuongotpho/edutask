'use client';

import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { LeaveRequest, LEAVE_TYPE_LABELS, LEAVE_SESSION_LABELS, ApprovalStatus } from '@/Edu-task/types/leave';
import { ROLE_LABELS } from '@/Edu-task/types/user';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  User, 
  Calendar, 
  FileText, 
  MessageSquare, 
  Send,
  History,
  FileCheck
} from 'lucide-react';

interface LeaveDetailModalProps {
  leave: LeaveRequest | null;
  onClose: () => void;
}

export function LeaveDetailModal({ leave, onClose }: LeaveDetailModalProps) {
  const { currentUser, activeRole, processLeaveStep } = useApp();
  const [comment, setComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!leave || !currentUser) return null;

  // Determine if active role can approve current pending step
  const currentPendingStep = leave.steps[leave.currentStepIndex];
  const canApprove = 
    leave.overallStatus === 'IN_REVIEW' &&
    currentPendingStep &&
    (
      activeRole === currentPendingStep.level ||
      activeRole === 'ADMIN' ||
      activeRole === 'PRINCIPAL'
    );

  const handleAction = (decision: ApprovalStatus) => {
    setIsProcessing(true);
    try {
      processLeaveStep(leave.id, decision, comment);
      setComment('');
    } catch (e) {
      alert('Có lỗi xảy ra khi xử lý đơn.');
    } finally {
      setIsProcessing(false);
    }
  };

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

          {/* Workflow Stepper */}
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-3">
              Luồng Duyệt Đa Cấp (Multi-stage Approval Workflow)
            </div>
            <div className="grid grid-cols-3 gap-2">
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
                <span className="text-slate-400 block text-[10px] font-semibold">Người dạy thay / Ghi chú</span>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 mt-1 text-slate-800 font-medium">
                  {leave.substituteTeacherName ? (
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{leave.substituteTeacherName} (Xác nhận dạy thay)</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">Không có thông tin dạy thay</span>
                  )}
                  {leave.notes && <p className="text-slate-500 text-[11px] mt-1 italic">{leave.notes}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Action Box for Authorized Approver */}
          {canApprove && (
            <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-indigo-600" />
                  Thao Tác Phê Duyệt (Vai trò hiện tại: {ROLE_LABELS[activeRole]})
                </span>
              </div>

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
