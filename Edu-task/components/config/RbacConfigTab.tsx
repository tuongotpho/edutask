'use client';

import React, { useState } from 'react';
import { ROLE_LABELS, RoleType } from '@/Edu-task/types/user';
import { Settings, ShieldCheck, GitBranch, Check, Save } from 'lucide-react';

export function RbacConfigTab() {
  const [autoApprove1Day, setAutoApprove1Day] = useState(true);
  const [allowSecretaryViewAll, setAllowSecretaryViewAll] = useState(true);

  const permissionsList = [
    { key: 'leave:create', label: 'Tạo đơn xin nghỉ phép' },
    { key: 'leave:approve_dept', label: 'Phê duyệt đơn ở cấp Tổ chuyên môn' },
    { key: 'leave:approve_exec', label: 'Phê duyệt đơn ở cấp BGH / Hiệu trưởng' },
    { key: 'task:create', label: 'Phát hành & Giao việc' },
    { key: 'task:view_all', label: 'Xem tiến độ công việc toàn trường' },
    { key: 'config:rbac', label: 'Quản trị phân quyền hệ thống' },
  ];

  const roles: RoleType[] = [
    'TEACHER',
    'HEAD_OF_DEPT',
    'VICE_PRINCIPAL',
    'PRINCIPAL',
    'SECRETARY',
    'ACCOUNTANT',
    'ADMIN',
  ];

  // Default permission matrix mock mapping
  const matrix: Record<string, RoleType[]> = {
    'leave:create': ['TEACHER', 'HEAD_OF_DEPT', 'VICE_PRINCIPAL', 'PRINCIPAL', 'SECRETARY', 'ACCOUNTANT', 'ADMIN'],
    'leave:approve_dept': ['HEAD_OF_DEPT', 'PRINCIPAL', 'ADMIN'],
    'leave:approve_exec': ['VICE_PRINCIPAL', 'PRINCIPAL', 'ADMIN'],
    'task:create': ['HEAD_OF_DEPT', 'VICE_PRINCIPAL', 'PRINCIPAL', 'ADMIN'],
    'task:view_all': ['VICE_PRINCIPAL', 'PRINCIPAL', 'SECRETARY', 'INSPECTOR', 'ADMIN'],
    'config:rbac': ['ADMIN'],
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-2">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          Cấu Hình Phân Quyền RBAC & Luồng Duyệt Đơn Từ
        </h2>
        <p className="text-xs text-slate-500">
          Thiết lập linh hoạt ma trận quyền hạn theo vai trò và cấu hình bỏ qua các bước không cần thiết
        </p>
      </div>

      {/* Workflow Customization Rules */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-600" />
          Cấu Hình Luồng Duyệt Linh Hoạt (Workflow Rules)
        </h3>

        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 block">Rút ngắn quy trình đơn nghỉ ngắn hạn (≤ 1 ngày)</span>
              <span className="text-slate-500 text-[11px]">Đơn nghỉ 1 ngày chỉ cần Tổ trưởng phê duyệt, không cần trình BGH Hiệu trưởng.</span>
            </div>
            <input
              type="checkbox"
              checked={autoApprove1Day}
              onChange={(e) => setAutoApprove1Day(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 block">Cấp quyền Văn thư xem toàn bộ hồ sơ đơn nghỉ để lưu trữ</span>
              <span className="text-slate-500 text-[11px]">Văn thư trường có thể xem và xuất file PDF lưu trữ sổ sách hành chính.</span>
            </div>
            <input
              type="checkbox"
              checked={allowSecretaryViewAll}
              onChange={(e) => setAllowSecretaryViewAll(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* RBAC Matrix Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Ma Trận Phân Quyền Theo Vai Trò (Role-Based Access Control)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-3 font-bold text-slate-700">Quyền Hạn / Tính Năng</th>
                {roles.map(r => (
                  <th key={r} className="p-3 font-bold text-slate-800 text-center">{ROLE_LABELS[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissionsList.map(perm => (
                <tr key={perm.key} className="hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-800">{perm.label}</td>
                  {roles.map(role => {
                    const hasPerm = matrix[perm.key]?.includes(role);
                    return (
                      <td key={role} className="p-3 text-center">
                        {hasPerm ? (
                          <span className="w-5 h-5 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-300">•</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
