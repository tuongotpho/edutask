'use client';

import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { Task, TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG, TaskStatus } from '@/Edu-task/types/task';
import { ROLE_LABELS } from '@/Edu-task/types/user';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User, 
  Calendar, 
  FileText, 
  MessageSquare, 
  Send,
  History,
  Shield,
  FileCheck,
  CheckSquare,
  Sparkles
} from 'lucide-react';

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const { 
    currentUser, 
    activeRole, 
    users,
    updateTaskProgress, 
    requestExtension, 
    reviewExtension, 
    approveTaskCompletion 
  } = useApp();

  const [reportNote, setReportNote] = useState('');
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [extDeadline, setExtDeadline] = useState('2026-08-10 17:00');
  const [extReason, setExtReason] = useState('');
  const [feedback, setFeedback] = useState('');

  if (!task || !currentUser) return null;

  const isSchoolLeadershipOrAdmin = 
    activeRole === 'ADMIN' || 
    activeRole === 'PRINCIPAL' || 
    activeRole === 'VICE_PRINCIPAL' || 
    activeRole === 'SECRETARY' || 
    activeRole === 'INSPECTOR' ||
    currentUser?.roles?.some(r => ['ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'SECRETARY', 'INSPECTOR'].includes(r));

  const isDeptHeader = 
    activeRole === 'HEAD_OF_DEPT' || 
    activeRole === 'GROUP_LEADER' || 
    currentUser?.roles?.some(r => ['HEAD_OF_DEPT', 'GROUP_LEADER'].includes(r));

  const isAssigneeUserInDept = task.assignees.some(a => {
    const u = users.find(usr => usr.id === a.userId);
    return u?.departmentId === currentUser.departmentId;
  });

  const canViewTask = 
    isSchoolLeadershipOrAdmin || 
    (isDeptHeader && (task.assignerId === currentUser.id || isAssigneeUserInDept)) || 
    task.assignerId === currentUser.id || 
    task.assignees.some(a => a.userId === currentUser.id);

  if (!canViewTask) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center space-y-3 shadow-2xl border border-slate-200 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center font-bold text-xl mx-auto">
            🚫
          </div>
          <h3 className="font-bold text-slate-900 text-base">Truy Cập Bị Từ Chối</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tài khoản Giáo viên không có quyền xem chi tiết công việc giao cho giáo viên khác.
          </p>
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors">
            Đóng Cửa Sổ
          </button>
        </div>
      </div>
    );
  }

  // Permissions check
  const isAssigner = task.assignerId === currentUser.id || activeRole === 'PRINCIPAL' || activeRole === 'VICE_PRINCIPAL';
  const isAssignee = task.assignees.some(a => a.userId === currentUser.id);
  const myAssigneeProgress = task.assignees.find(a => a.userId === currentUser.id);

  // Handle Mark as Viewed
  const handleMarkViewed = () => {
    updateTaskProgress(task.id, 'IN_PROGRESS', 'Đã xem chỉ đạo và đang triển khai.');
  };

  // Handle Report Progress
  const handleSubmitReport = () => {
    if (!reportNote.trim()) {
      alert('Vui lòng nhập nội dung báo cáo tiến độ.');
      return;
    }
    updateTaskProgress(task.id, 'PENDING_APPROVAL', reportNote);
    setReportNote('');
  };

  // Handle Extension Request
  const handleSendExtension = () => {
    if (!extReason.trim()) {
      alert('Vui lòng nhập lý do xin gia hạn.');
      return;
    }
    requestExtension(task.id, extDeadline, extReason);
    setShowExtensionForm(false);
    setExtReason('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/30">
              {task.code}
            </div>
            <div>
              <h3 className="text-base font-bold text-white max-w-md truncate">{task.title}</h3>
              <p className="text-xs text-slate-400">Người giao: {task.assignerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">

          {/* Status & Priority Badge Header */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${TASK_PRIORITY_CONFIG[task.priority].badgeBg}`}>
                {TASK_PRIORITY_CONFIG[task.priority].label}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${TASK_STATUS_CONFIG[task.status].bg} ${TASK_STATUS_CONFIG[task.status].color}`}>
                {TASK_STATUS_CONFIG[task.status].label}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Hạn hoàn thành</span>
              <span className="font-bold text-rose-600 text-xs">{task.deadline}</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <span className="font-bold text-slate-800 block text-xs">Nội dung / Chỉ đạo chi tiết:</span>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 font-medium leading-relaxed">
              {task.description}
            </div>
          </div>

          {/* Assignees Progress Table */}
          <div>
            <span className="font-bold text-slate-800 block text-xs mb-2">Danh sách nhân sự & Tiến độ thực hiện:</span>
            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {task.assignees.map((a, idx) => (
                <div key={idx} className="p-3 bg-white flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{a.userName}</div>
                    <div className="text-[10px] text-slate-500">{a.departmentName}</div>
                    {a.reportNotes && (
                      <div className="mt-1 text-[11px] text-slate-700 italic bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                        &quot;{a.reportNotes}&quot;
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${TASK_STATUS_CONFIG[a.status].bg} ${TASK_STATUS_CONFIG[a.status].color}`}>
                      {TASK_STATUS_CONFIG[a.status].label}
                    </span>
                    {a.viewedAt && <div className="text-[10px] text-slate-400 mt-0.5">Đã xem: {a.viewedAt}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assignee Actions Panel */}
          {isAssignee && task.status !== 'COMPLETED' && (
            <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-3">
              <div className="font-bold text-indigo-950 text-xs flex items-center justify-between">
                <span>Thao tác dành cho người nhận việc</span>
                <span className="text-[10px] text-indigo-700">Trạng thái của bạn: {myAssigneeProgress?.status}</span>
              </div>

              {myAssigneeProgress?.status === 'ASSIGNED' && (
                <button
                  onClick={handleMarkViewed}
                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm transition-all"
                >
                  Xác Nhận Đã Xem & Triển Khai Thực Hiện
                </button>
              )}

              {myAssigneeProgress?.status !== 'ASSIGNED' && (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    placeholder="Mô tả kết quả thực hiện / đính kèm link báo cáo..."
                    className="w-full p-2.5 rounded-xl border border-indigo-200 bg-white text-xs"
                  />

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowExtensionForm(!showExtensionForm)}
                      className="text-indigo-700 font-semibold hover:underline text-xs"
                    >
                      {showExtensionForm ? 'Đóng form gia hạn' : 'Xin gia hạn deadline'}
                    </button>

                    <button
                      onClick={handleSubmitReport}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                    >
                      Nộp Báo Cáo & Trình Duyệt
                    </button>
                  </div>
                </div>
              )}

              {/* Extension Form inside modal */}
              {showExtensionForm && (
                <div className="p-3 bg-white rounded-xl border border-indigo-200 space-y-2 mt-2">
                  <div className="font-bold text-slate-800 text-xs">Đơn xin gia hạn thời hạn</div>
                  <input
                    type="text"
                    value={extDeadline}
                    onChange={(e) => setExtDeadline(e.target.value)}
                    placeholder="Hạn mới (ví dụ: 2026-08-10 17:00)"
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  />
                  <textarea
                    rows={2}
                    value={extReason}
                    onChange={(e) => setExtReason(e.target.value)}
                    placeholder="Lý do xin gia hạn..."
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  />
                  <button
                    onClick={handleSendExtension}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
                  >
                    Gửi Yêu Cầu Gia Hạn
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Assigner / Leader Actions Panel */}
          {isAssigner && (
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-3">
              <div className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Dành cho Lãnh Đạo / Người Giao Việc (Nghiệm Thu)
              </div>

              {/* Extension Requests Review */}
              {task.extensionRequests.filter(e => e.status === 'PENDING').map(ext => (
                <div key={ext.id} className="p-3 bg-white rounded-xl border border-amber-300 space-y-2">
                  <div className="font-bold text-amber-900 text-xs">
                    Yêu cầu gia hạn từ {ext.requestedByUserName}: Đến {ext.requestedDeadline}
                  </div>
                  <p className="text-slate-600 italic text-[11px]">&quot;{ext.reason}&quot;</p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => reviewExtension(task.id, ext.id, 'APPROVED', 'Chấp thuận gia hạn')}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                    >
                      Duyệt Gia Hạn
                    </button>
                    <button
                      onClick={() => reviewExtension(task.id, ext.id, 'DECLINED', 'Không đồng ý gia hạn')}
                      className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs"
                    >
                      Từ Chối Gia Hạn
                    </button>
                  </div>
                </div>
              ))}

              <textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Nhận xét / Đánh giá chất lượng thực hiện..."
                className="w-full p-2.5 rounded-xl border border-emerald-200 bg-white text-xs"
              />

              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => approveTaskCompletion(task.id, 'REVISE', feedback)}
                  className="px-3.5 py-1.5 rounded-xl border border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold"
                >
                  Yêu Cầu Làm Lại
                </button>
                <button
                  onClick={() => approveTaskCompletion(task.id, 'APPROVE', feedback)}
                  className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                >
                  Xác Nhận Hoàn Thành Công Việc
                </button>
              </div>
            </div>
          )}

          {/* Activity Logs Feed */}
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2 flex items-center space-x-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Nhật Ký & Quá Trình Trao Đổi</span>
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {task.activities.map((act) => (
                <div key={act.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between">
                  <div>
                    <div className="font-bold text-slate-800">{act.content}</div>
                    <div className="text-[10px] text-slate-500">Bởi: {act.actorName} ({act.actorRole})</div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{act.timestamp}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
