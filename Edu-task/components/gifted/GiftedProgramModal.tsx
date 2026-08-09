'use client';

import React from 'react';
import { X } from 'lucide-react';
import { GiftedProgram, GiftedProgramStatus } from '@/Edu-task/types/gifted';
import { User } from '@/Edu-task/types/user';

const inputClass =
  'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200';

interface GiftedProgramModalProps {
  isOpen: boolean;
  editingProgram: GiftedProgram | null;
  programForm: {
    title: string;
    subject: string;
    grade: string;
    description: string;
    coordinatorId: string;
    startDate: string;
    endDate: string;
    status: GiftedProgramStatus;
  };
  users: User[];
  onClose: () => void;
  onChangeForm: (form: GiftedProgramModalProps['programForm']) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function GiftedProgramModal({
  isOpen,
  editingProgram,
  programForm,
  users,
  onClose,
  onChangeForm,
  onSubmit,
}: GiftedProgramModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-[5px] max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-900">
            {editingProgram ? 'Sửa Chương Trình Bồi Dưỡng' : 'Tạo Chương Trình Bồi Dưỡng HSG Mới'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tên Chương Trình Bồi Dưỡng *</label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Bồi dưỡng Đội tuyển HSG Môn Toán 9 - Vòng Tỉnh"
              value={programForm.title}
              onChange={e => onChangeForm({ ...programForm, title: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Môn Bồi Dưỡng *</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Toán, Vật Lý, Tin Học..."
                value={programForm.subject}
                onChange={e => onChangeForm({ ...programForm, subject: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Khối Lớp</label>
              <input
                type="text"
                placeholder="Ví dụ: Khối 9, Khối 12..."
                value={programForm.grade}
                onChange={e => onChangeForm({ ...programForm, grade: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Giáo Viên Phụ Trách / Chủ Trì *</label>
            <select
              value={programForm.coordinatorId}
              onChange={e => onChangeForm({ ...programForm, coordinatorId: e.target.value })}
              className={inputClass}
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.departmentName})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày Bắt Đầu</label>
              <input
                type="date"
                value={programForm.startDate}
                onChange={e => onChangeForm({ ...programForm, startDate: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày Kết Thúc Dự Kiến</label>
              <input
                type="date"
                value={programForm.endDate}
                onChange={e => onChangeForm({ ...programForm, endDate: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Trạng Thái</label>
            <select
              value={programForm.status}
              onChange={e => onChangeForm({ ...programForm, status: e.target.value as GiftedProgramStatus })}
              className={inputClass}
            >
              <option value="IN_PROGRESS">Đang triển khai</option>
              <option value="DRAFT">Dự thảo</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="ARCHIVED">Lưu trữ</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Mô Tả / Ghi Chú Mục Tiêu</label>
            <textarea
              rows={2}
              placeholder="Ghi chú về nội dung cốt lõi, mục tiêu giải thưởng..."
              value={programForm.description}
              onChange={e => onChangeForm({ ...programForm, description: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-xs"
            >
              {editingProgram ? 'Cập Nhật' : 'Tạo Chương Trình'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
