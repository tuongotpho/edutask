'use client';

import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { TaskPriority, TASK_PRIORITY_CONFIG } from '@/Edu-task/types/task';
import { X, CheckSquare, AlertTriangle, Shield } from 'lucide-react';
import { isSchoolLeadership } from '@/Edu-task/lib/permissions';
import { genId } from '@/Edu-task/lib/utils';
import { useAttachmentDraft } from '@/Edu-task/hooks/useAttachmentDraft';
import { FileAttachments } from '@/Edu-task/components/common/FileAttachments';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';

export function TaskFormModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { currentUser, activeRole, users, departments, createTask, getTeacherLeaveConflict, showToast } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeType, setAssigneeType] = useState<'INDIVIDUAL' | 'MULTIPLE' | 'DEPARTMENT'>('INDIVIDUAL');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [deadline, setDeadline] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(17, 0, 0, 0);
    return d;
  });
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [bghCanView, setBghCanView] = useState(true);
  const [assigneeGroupLeadersCanView, setAssigneeGroupLeadersCanView] = useState(true);
  const [specificVicePrincipalIds, setSpecificVicePrincipalIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mint the id up front so briefing files can be uploaded under it before the
  // task document exists.
  const [draftTaskId] = useState(() => genId('TSK_2026'));

  const attachments = useAttachmentDraft({
    scope: 'tasks',
    recordId: draftTaskId,
    uploader: { id: currentUser?.id ?? '', name: currentUser?.fullName ?? '' },
  });

  const handleClose = async () => {
    await attachments.discard();
    onClose();
  };

  if (!isOpen || !currentUser) return null;

  const isSchoolLeadershipOrAdmin = isSchoolLeadership(currentUser, activeRole);

  const availableDepartments = isSchoolLeadershipOrAdmin 
    ? departments 
    : departments.filter(d => d.id === currentUser.departmentId);

  const availableUsers = isSchoolLeadershipOrAdmin
    ? users
    : users.filter(u => u.departmentId === currentUser.departmentId);

  // Smart Leave Conflicts check for selected assignees
  const targetCheckUsers = assigneeType === 'DEPARTMENT' 
    ? availableUsers.filter(u => u.departmentId === selectedDeptId)
    : availableUsers.filter(u => selectedUserIds.includes(u.id));

  const deadlineDateStr = format(deadline, 'yyyy-MM-dd');
  const detectedConflicts = targetCheckUsers
    .map(u => ({ user: u, conflict: getTeacherLeaveConflict(u.id, deadlineDateStr, deadlineDateStr) }))
    .filter(item => item.conflict.hasConflict);

  const toggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('error', 'Vui lòng nhập tiêu đề công việc.');
      return;
    }

    if (assigneeType === 'DEPARTMENT' && !selectedDeptId) {
      showToast('error', 'Vui lòng chọn tổ môn nhận việc.');
      return;
    }

    if (assigneeType !== 'DEPARTMENT' && selectedUserIds.length === 0) {
      showToast('error', 'Vui lòng chọn người nhận việc.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createTask({
        title,
        description,
        assigneeType,
        // A department-wide task derives its assignees from the department, so
        // any individually ticked users are irrelevant and must not leak in.
        targetUserIds: assigneeType === 'DEPARTMENT' ? undefined : selectedUserIds,
        targetDepartmentId: assigneeType === 'DEPARTMENT' ? selectedDeptId : undefined,
        deadline: format(deadline, 'yyyy-MM-dd HH:mm'),
        priority,
        id: draftTaskId,
        attachments: attachments.files,
        visibilitySettings: {
          bghCanView,
          assigneeGroupLeadersCanView,
          specificVicePrincipalIds,
        }
      });
      // Keep the form open when the write is rejected; a toast already explained.
      if (created) {
        await attachments.commit();
        onClose();
      }
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Có lỗi xảy ra khi giao việc.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Phát Hành Chỉ Đạo & Giao Việc</h3>
              <p className="text-xs text-slate-400">Giao cho Cá nhân, Nhiều người hoặc Toàn tổ chuyên môn</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">

          {/* Smart Leave Conflict Warning Box */}
          {detectedConflicts.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1">
              <div className="flex items-center space-x-2 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Cảnh Báo Thông Minh: Người Nhận Đang Có Đơn Xin Nghỉ!</span>
              </div>
              <ul className="pl-6 list-disc space-y-0.5 text-[11px]">
                {detectedConflicts.map(({ user, conflict }) => (
                  <li key={user.id}>
                    <strong>{user.fullName}</strong> có lịch nghỉ ({conflict.conflictDetail?.startDate} → {conflict.conflictDetail?.endDate}). Lý do: {conflict.conflictDetail?.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">Tiêu đề công việc <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên nhiệm vụ / chỉ đạo..."
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-900"
            />
          </div>

          {/* Assignee Type Selector */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">Đối tượng nhận việc</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAssigneeType('INDIVIDUAL')}
                className={`p-2 rounded-xl border text-center font-bold transition-all ${
                  assigneeType === 'INDIVIDUAL'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                1 Cá nhân
              </button>
              <button
                type="button"
                onClick={() => setAssigneeType('MULTIPLE')}
                className={`p-2 rounded-xl border text-center font-bold transition-all ${
                  assigneeType === 'MULTIPLE'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                Nhiều người
              </button>
              <button
                type="button"
                onClick={() => setAssigneeType('DEPARTMENT')}
                className={`p-2 rounded-xl border text-center font-bold transition-all ${
                  assigneeType === 'DEPARTMENT'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                Cả Tổ môn
              </button>
            </div>
          </div>

          {/* Target Department Selection */}
          {assigneeType === 'DEPARTMENT' && (
            <div>
              <label className="block font-bold text-slate-800 mb-1">Chọn Tổ môn nhận chỉ đạo</label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-medium text-slate-900"
              >
                <option value="">-- Chọn Tổ chuyên môn --</option>
                {availableDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Target Users Selection */}
          {assigneeType !== 'DEPARTMENT' && (
            <div>
              <label className="block font-bold text-slate-800 mb-1">Chọn nhân sự thực hiện</label>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 p-1 bg-slate-50">
                {availableUsers.map(u => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUserSelection(u.id)}
                      className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-white text-slate-700'
                      }`}
                    >
                      <div>
                        <span>{u.fullName}</span>
                        <span className="text-[10px] text-slate-400 block">{u.departmentName}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Deadline & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Hạn hoàn thành (Deadline) <span className="text-rose-500">*</span></label>
              <DatePicker
                selected={deadline}
                onChange={(date: Date | null) => date && setDeadline(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                timeCaption="Giờ"
                dateFormat="dd/MM/yyyy h:mm aa"
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Mức độ ưu tiên</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-semibold text-slate-900"
              >
                {(Object.keys(TASK_PRIORITY_CONFIG) as TaskPriority[]).map(p => (
                  <option key={p} value={p}>{TASK_PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Detailed Instructions */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">Nội dung / Chỉ đạo chi tiết</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả cụ thể yêu cầu công việc, các tiêu chí nghiệm thu..."
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-medium text-slate-900"
            />
          </div>

          {/* Visibility & Security Settings */}
          {(activeRole === 'PRINCIPAL' || activeRole === 'VICE_PRINCIPAL' || activeRole === 'ADMIN') ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center space-x-2 text-indigo-700 font-bold mb-2">
                <Shield className="w-4 h-4" />
                <span>Quyền Theo Dõi (Ban Giám Hiệu)</span>
              </div>
              
              <div className="flex items-start justify-between space-x-4">
                <div>
                  <span className="font-bold text-slate-800 block">Cho phép Tổ/Nhóm trưởng theo dõi</span>
                  <span className="text-[10px] text-slate-500 block">Tổ trưởng của người nhận việc sẽ xem được tiến độ.</span>
                </div>
                <input
                  type="checkbox"
                  checked={assigneeGroupLeadersCanView}
                  onChange={(e) => setAssigneeGroupLeadersCanView(e.target.checked)}
                  className="w-4 h-4 mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-800 block mb-2">Chia sẻ với Phó Hiệu trưởng khác:</span>
                <div className="space-y-1">
                  {users.filter(u => u.roles.includes('VICE_PRINCIPAL') && u.id !== currentUser.id).map(vp => (
                    <label key={vp.id} className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-white rounded-lg transition-colors">
                      <input 
                        type="checkbox" 
                        checked={specificVicePrincipalIds.includes(vp.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSpecificVicePrincipalIds([...specificVicePrincipalIds, vp.id]);
                          else setSpecificVicePrincipalIds(specificVicePrincipalIds.filter(id => id !== vp.id));
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700">{vp.fullName}</span>
                    </label>
                  ))}
                  {users.filter(u => u.roles.includes('VICE_PRINCIPAL') && u.id !== currentUser.id).length === 0 && (
                    <span className="text-xs text-slate-500">Không có Phó Hiệu trưởng nào khác.</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="font-bold text-slate-800 block">Cho phép BGH theo dõi</span>
                  <span className="text-[10px] text-slate-500">Ban Giám Hiệu sẽ nhìn thấy công việc này (Nên bỏ chọn với việc lặt vặt nội bộ tổ).</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={bghCanView}
                onChange={(e) => setBghCanView(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          )}

          <FileAttachments
            label="Tài liệu đính kèm (công văn, biểu mẫu, hướng dẫn...)"
            hint="Người nhận việc sẽ tải được các file này"
            files={attachments.files}
            onUpload={attachments.upload}
            onRemove={attachments.remove}
            onError={message => showToast('error', message)}
            disabled={isSubmitting}
          />

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm transition-all"
            >
              Phát Hành Công Việc
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
