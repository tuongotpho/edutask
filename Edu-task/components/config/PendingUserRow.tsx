'use client';

import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { RoleType } from '@/Edu-task/types/user';

interface PendingUserRowProps {
  user: any;
  deptMap: Record<string, string>;
  onApprove: (id: string, role: RoleType, deptId: string, deptName: string) => Promise<boolean>;
  onReject: (id: string) => Promise<boolean>;
}

export function PendingUserRow({
  user,
  deptMap,
  onApprove,
  onReject,
}: PendingUserRowProps) {
  const { departments } = useApp();
  const [selectedDept, setSelectedDept] = useState(user.departmentId || departments[0]?.id || 'DEPT_TOAN_TIN');
  const [selectedRole, setSelectedRole] = useState<RoleType>(user.roles?.[0] || 'TEACHER');

  const handleApprove = () => {
    onApprove(user.id, selectedRole, selectedDept, deptMap[selectedDept] || 'Tổ chuyên môn');
  };

  return (
    <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
      <div>
        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <span>{user.fullName}</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-200">
            Chờ duyệt
          </span>
        </div>
        <div className="text-slate-500">{user.email}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        <select
          value={selectedDept}
          onChange={e => setSelectedDept(e.target.value)}
          className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
        >
          {departments.map(d => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={selectedRole}
          onChange={e => setSelectedRole(e.target.value as RoleType)}
          className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold"
        >
          <option value="TEACHER">Giáo viên (`TEACHER`)</option>
          <option value="GROUP_LEADER">Nhóm trưởng (`GROUP_LEADER`)</option>
          <option value="HEAD_OF_DEPT">Tổ trưởng (`HEAD_OF_DEPT`)</option>
          <option value="VICE_PRINCIPAL">Hiệu phó (`VICE_PRINCIPAL`)</option>
          <option value="PRINCIPAL">Hiệu trưởng (`PRINCIPAL`)</option>
          <option value="SECRETARY">Văn thư (`SECRETARY`)</option>
          <option value="ACCOUNTANT">Kế toán (`ACCOUNTANT`)</option>
          <option value="TRADE_UNION">Công đoàn (`TRADE_UNION`)</option>
          <option value="INSPECTOR">Thanh tra (`INSPECTOR`)</option>
          <option value="ADMIN">Quản trị viên (`ADMIN`)</option>
        </select>

        <button
          onClick={handleApprove}
          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs"
        >
          ✓ Phê Duyệt
        </button>

        <button
          onClick={() => onReject(user.id)}
          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors border border-rose-200"
        >
          Từ Chối
        </button>
      </div>
    </div>
  );
}
