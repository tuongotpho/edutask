'use client';

import React from 'react';
import { X } from 'lucide-react';
import { GiftedLesson } from '@/Edu-task/types/gifted';
import { User } from '@/Edu-task/types/user';

const inputClass =
  'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200';

interface GiftedLessonModalProps {
  isOpen: boolean;
  editingLesson: GiftedLesson | null;
  lessonForm: {
    title: string;
    teacherId: string;
    scheduledDate: string;
    durationPeriods: number;
    roomName: string;
    description: string;
  };
  users: User[];
  onClose: () => void;
  onChangeForm: (form: GiftedLessonModalProps['lessonForm']) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function GiftedLessonModal({
  isOpen,
  editingLesson,
  lessonForm,
  users,
  onClose,
  onChangeForm,
  onSubmit,
}: GiftedLessonModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-[5px] max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-900">
            {editingLesson ? 'Sửa Tiết / Chuyên Đề' : 'Thêm Tiết / Chuyên Đề Mới'}
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
            <label className="block text-xs font-bold text-slate-700 mb-1">Tên Tiết / Chuyên Đề *</label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Chuyên đề Bất đẳng thức Cauchy và ứng dụng"
              value={lessonForm.title}
              onChange={e => onChangeForm({ ...lessonForm, title: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Giáo Viên Phụ Trách Dạy *</label>
            <select
              value={lessonForm.teacherId}
              onChange={e => onChangeForm({ ...lessonForm, teacherId: e.target.value })}
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày Học Dự Kiến</label>
              <input
                type="date"
                value={lessonForm.scheduledDate}
                onChange={e => onChangeForm({ ...lessonForm, scheduledDate: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số Tiết Dạy</label>
              <input
                type="number"
                min={1}
                max={10}
                value={lessonForm.durationPeriods}
                onChange={e => onChangeForm({ ...lessonForm, durationPeriods: parseInt(e.target.value) || 1 })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phòng / Địa Điểm Học</label>
            <input
              type="text"
              placeholder="Ví dụ: Phòng Chuyên đề 1 / Phòng Máy 2"
              value={lessonForm.roomName}
              onChange={e => onChangeForm({ ...lessonForm, roomName: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Mô Tả Nội Dung Chi Tiết</label>
            <textarea
              rows={2}
              placeholder="Ghi chú nội dung trọng tâm bài giảng, bài tập đính kèm..."
              value={lessonForm.description}
              onChange={e => onChangeForm({ ...lessonForm, description: e.target.value })}
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
              {editingLesson ? 'Cập Nhật' : 'Thêm Tiết Học'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
