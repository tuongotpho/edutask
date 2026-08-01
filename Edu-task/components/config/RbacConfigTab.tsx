'use client';

import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
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

      {/* User Accounts Management (Firestore DB) */}
      <UserAccountManager />
    </div>
  );
}

function UserAccountManager() {
  const { users, addUserProfile, deleteUserProfile } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('DEPT_TOAN_TIN');
  const [role, setRole] = useState<RoleType>('TEACHER');

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) return;

    const deptMap: Record<string, string> = {
      'DEPT_BGH': 'Ban Giám Hiệu',
      'DEPT_TOAN_TIN': 'Tổ Toán - Tin',
      'DEPT_VAN_SU': 'Tổ Ngữ Văn - Lịch Sử',
      'DEPT_ANH': 'Tổ Ngoại Ngữ',
      'DEPT_LY_HOA_SINH': 'Tổ Lý - Hóa - Sinh',
      'DEPT_HANH_CHINH': 'Tổ Hành Chính - Kế Toán',
    };

    const newUser = {
      id: `USR_${Date.now()}`,
      fullName,
      email,
      phone: '0900 123 456',
      departmentId,
      departmentName: deptMap[departmentId] || 'Tổ chuyên môn',
      roles: [role],
      activeRole: role,
      isTeachingStaff: true,
      subject: 'Bộ môn chuyên',
    };

    await addUserProfile(newUser);
    setShowAddModal(false);
    setFullName('');
    setEmail('');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Danh Sách Tài Khoản Người Dùng & Vai Trò (Firestore DB)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Quản lý người dùng, phân quyền vai trò được đồng bộ realtime với Firebase Firestore</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs"
        >
          + Thêm Tài Khoản Mới
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="p-3 font-bold text-slate-700">Họ và Tên</th>
              <th className="p-3 font-bold text-slate-700">Email</th>
              <th className="p-3 font-bold text-slate-700">Tổ Chuyên Môn</th>
              <th className="p-3 font-bold text-slate-700">Vai Trò</th>
              <th className="p-3 font-bold text-slate-700 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-900">{u.fullName}</td>
                <td className="p-3 text-slate-600">{u.email}</td>
                <td className="p-3 text-slate-600">{u.departmentName}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">
                    {ROLE_LABELS[u.roles[0]] || u.roles[0]}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {u.id !== 'USR_ADMIN' && (
                    <button
                      onClick={() => {
                        if (confirm(`Bạn có chắc muốn xóa tài khoản ${u.fullName}?`)) {
                          deleteUserProfile(u.id);
                        }
                      }}
                      className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold"
                    >
                      Xóa
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h4 className="font-bold text-slate-900 text-base">Thêm Tài Khoản Giáo Viên Mới</h4>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Họ và Tên</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Cô Lê Thị Lan"
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="lethilan@truong.edu.vn"
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tổ Chuyên Môn</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs"
                >
                  <option value="DEPT_BGH">Ban Giám Hiệu</option>
                  <option value="DEPT_TOAN_TIN">Tổ Toán - Tin</option>
                  <option value="DEPT_VAN_SU">Tổ Ngữ Văn - Lịch Sử</option>
                  <option value="DEPT_ANH">Tổ Ngoại Ngữ</option>
                  <option value="DEPT_LY_HOA_SINH">Tổ Lý - Hóa - Sinh</option>
                  <option value="DEPT_HANH_CHINH">Tổ Hành Chính - Kế Toán</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vai Trò Chính</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleType)}
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs"
                >
                  <option value="TEACHER">Giáo viên (`TEACHER`)</option>
                  <option value="HEAD_OF_DEPT">Tổ trưởng (`HEAD_OF_DEPT`)</option>
                  <option value="VICE_PRINCIPAL">Hiệu phó (`VICE_PRINCIPAL`)</option>
                  <option value="PRINCIPAL">Hiệu trưởng (`PRINCIPAL`)</option>
                  <option value="SECRETARY">Văn thư / Thư ký (`SECRETARY`)</option>
                  <option value="ACCOUNTANT">Kế toán (`ACCOUNTANT`)</option>
                </select>
              </div>

              <div className="flex space-x-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 text-xs font-bold"
                >
                  Lưu vào Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

