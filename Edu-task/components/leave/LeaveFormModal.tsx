'use client';

import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { LeaveType, LeaveSession, LEAVE_TYPE_LABELS, LEAVE_SESSION_LABELS } from '@/Edu-task/types/leave';
import { X, Calendar, AlertTriangle, UserCheck, FileText, Upload, Sparkles } from 'lucide-react';

export function LeaveFormModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { currentUser, users, createLeaveRequest, getTeacherLeaveConflict } = useApp();

  const [leaveType, setLeaveType] = useState<LeaveType>('PAID');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [session, setSession] = useState<LeaveSession>('FULL_DAY');
  const [reason, setReason] = useState('');
  const [substituteTeacherId, setSubstituteTeacherId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !currentUser) return null;

  // Filter available substitute teachers (same department preferably or teaching staff)
  const availableSubstitutes = users.filter(u => u.id !== currentUser.id && u.isTeachingStaff);

  // Check for conflicts
  const conflict = getTeacherLeaveConflict(currentUser.id, startDate, endDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Vui lòng điền lý do xin nghỉ');
      return;
    }

    setIsSubmitting(true);
    try {
      createLeaveRequest({
        leaveType,
        startDate,
        endDate,
        session,
        reason,
        substituteTeacherId: substituteTeacherId || undefined,
        notes: notes || undefined,
      });
      onClose();
    } catch (err) {
      alert('Có lỗi xảy ra khi tạo đơn xin nghỉ');
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
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Tạo Đơn Xin Nghỉ Mới</h3>
              <p className="text-xs text-slate-400">Gửi trình Ban Giám Hiệu & Tổ trưởng chuyên môn</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">

          {/* Applicant Info Banner */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Người xin nghỉ</span>
              <span className="font-bold text-slate-900 text-sm">{currentUser.fullName}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Tổ chuyên môn</span>
              <span className="font-semibold text-slate-700">{currentUser.departmentName}</span>
            </div>
          </div>

          {/* Conflict Warning if any */}
          {conflict.hasConflict && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Cảnh báo trùng lịch nghỉ:</strong> Bạn đã có đơn xin nghỉ trùng khoảng thời gian từ {conflict.conflictDetail?.startDate} đến {conflict.conflictDetail?.endDate}.
              </div>
            </div>
          )}

          {/* Leave Type Selector */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">Loại hình xin nghỉ <span className="text-rose-500">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setLeaveType(type)}
                  className={`p-2.5 rounded-xl border text-left font-semibold transition-all flex items-center space-x-2 ${
                    leaveType === type
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${LEAVE_TYPE_LABELS[type].bg}`} />
                  <span className="truncate">{LEAVE_TYPE_LABELS[type].label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dates & Session */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Từ ngày <span className="text-rose-500">*</span></label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Đến ngày <span className="text-rose-500">*</span></label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Buổi nghỉ</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value as LeaveSession)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-900"
              >
                {(Object.keys(LEAVE_SESSION_LABELS) as LeaveSession[]).map(s => (
                  <option key={s} value={s}>{LEAVE_SESSION_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Substitute Teacher */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">Người dạy thay / Bàn giao lịch (nếu có)</label>
            <div className="relative">
              <UserCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={substituteTeacherId}
                onChange={(e) => setSubstituteTeacherId(e.target.value)}
                className="w-full pl-9 pr-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800"
              >
                <option value="">-- Không cần chọn / Tự thu xếp --</option>
                {availableSubstitutes.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.fullName} ({sub.departmentName} - Môn: {sub.subject || 'Chuyên môn'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">Lý do nghỉ <span className="text-rose-500">*</span></label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ghi rõ lý do xin nghỉ (Ví dụ: Đi khám chữa bệnh theo chỉ định bác sĩ, Lý do công tác sở...)"
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-900"
            />
          </div>

          {/* Attachment upload box (Interactive UI simulation) */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">File minh chứng đính kèm (Giấy khám bệnh, Công văn...)</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
              <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
              <span className="text-slate-600 font-medium">Nhấp để chọn file hoặc kéo thả file vào đây</span>
              <span className="block text-[10px] text-slate-400 mt-0.5">Hỗ trợ PDF, PNG, JPG (Tối đa 10MB)</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm transition-all"
            >
              Gửi Đơn Xin Nghỉ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
