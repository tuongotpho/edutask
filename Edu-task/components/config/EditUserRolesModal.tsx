'use client';

import React, { useState } from 'react';
import { Edit } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import { ROLE_LABELS, RoleType, User } from '@/Edu-task/types/user';
import { ALL_ROLES } from '@/Edu-task/lib/permissions';

interface EditUserRolesModalProps {
  user: User;
  deptMap: Record<string, string>;
  onClose: () => void;
  onSave: (updatedUser: User) => Promise<boolean>;
}

export function EditUserRolesModal({
  user,
  deptMap,
  onClose,
  onSave,
}: EditUserRolesModalProps) {
  const { departments } = useApp();

  const [fullName, setFullName] = useState(user.fullName);
  const [departmentId, setDepartmentId] = useState(user.departmentId);
  const [subject, setSubject] = useState(user.subject || '');
  const [selectedRoles, setSelectedRoles] = useState<RoleType[]>(
    user.roles && user.roles.length > 0 ? user.roles : [user.activeRole || 'TEACHER']
  );
  const [isSaving, setIsSaving] = useState(false);

  const toggleRole = (r: RoleType) => {
    if (selectedRoles.includes(r)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter(item => item !== r));
      }
    } else {
      setSelectedRoles([...selectedRoles, r]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated: User = {
        ...user,
        fullName,
        departmentId,
        departmentName: deptMap[departmentId] || user.departmentName,
        subject,
        roles: selectedRoles,
        activeRole: selectedRoles.includes(user.activeRole) ? user.activeRole : selectedRoles[0],
      };
      if (await onSave(updated)) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[5px] p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
        <div>
          <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Edit className="w-4 h-4 text-indigo-600" />
            Chỉnh Sửa Phân Quyền và Gán Nhiều Vai Trò (Multi-Role)
          </h4>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Họ và Tên</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tổ Chuyên Môn</label>
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Môn Giảng Dạy</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="VD: Toán Đại số"
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Gán Các Vai Trò (Tích chọn một hoặc nhiều vai trò):
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto">
              {ALL_ROLES.map(r => {
                const isChecked = selectedRoles.includes(r);
                return (
                  <label
                    key={r}
                    onClick={() => toggleRole(r)}
                    className={`flex items-center space-x-2 p-2 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                        isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {isChecked && '✓'}
                    </div>
                    <span className="text-xs">{ROLE_LABELS[r]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex space-x-2 pt-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs font-bold"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 text-xs font-bold shadow-md disabled:opacity-50"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi Vai Trò'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
