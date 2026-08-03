import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { ROLE_LABELS, RoleType, User } from '@/Edu-task/types/user';
import { isAdminEmail } from '@/Edu-task/lib/admin';
import {
  ALL_ROLES,
  PERMISSION_LABELS,
  PermissionKey,
  ROLE_CAPABILITIES,
  canManageRbac,
} from '@/Edu-task/lib/permissions';
import { 
  Settings, 
  ShieldCheck, 
  Edit, 
  Trash2, 
  UserPlus, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Building2,
  PlusCircle,
  X
} from 'lucide-react';
import { ConfirmModal } from '@/Edu-task/components/common/ConfirmModal';
import { WorkflowConfigCard, TelegramConfigCard } from '@/Edu-task/components/config/WorkflowConfigCard';

export function RbacConfigTab() {
  const { 
    currentUser, 
    activeRole, 
    schoolName, 
    updateSchoolName, 
    departments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    users,
    showToast
  } = useApp();

  const [isMatrixExpanded, setIsMatrixExpanded] = useState(false);

  const [editingSchoolName, setEditingSchoolName] = useState(schoolName);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptFormName, setDeptFormName] = useState('');
  const [deptFormCode, setDeptFormCode] = useState('');
  const [deptFormDesc, setDeptFormDesc] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'dept' | 'user' | null, id: string, name: string}>({type: null, id: '', name: ''});

  if (!canManageRbac(currentUser, activeRole)) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm my-6">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-bold text-xl">
          🚫
        </div>
        <h3 className="text-base font-bold text-slate-900">Truy Cập Khu Vực Quản Trị Bị Từ Chối</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Chỉ có Quản trị viên hệ thống (Admin) mới có quyền truy cập thẻ Quản trị RBAC & Phê duyệt tài khoản. Vai trò hiện tại của bạn: <strong>{ROLE_LABELS[activeRole] || activeRole}</strong>.
        </p>
      </div>
    );
  }

  // The matrix is rendered straight from the capability table the app actually
  // enforces, so it can never drift out of date the way the old hardcoded copy did.
  const permissionKeys = Object.keys(ROLE_CAPABILITIES) as PermissionKey[];
  const roles = ALL_ROLES;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-2">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          Cấu Hình Hệ Thống, Phân Quyền & Tổ Chuyên Môn
        </h2>
        <p className="text-xs text-slate-500">
          Thiết lập tên trường học, danh sách tổ chuyên môn linh hoạt, ma trận quyền hạn theo vai trò và quản lý người dùng.
        </p>
      </div>

      {/* 1. School Name Settings Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Cấu Hình Thông Tin Trường Học</h3>
        </div>
        <p className="text-xs text-slate-500">
          Tên trường học hiển thị đồng bộ trên thanh điều hướng, tiêu đề ứng dụng, các đơn xin nghỉ phép và báo cáo thống kê.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          <input
            type="text"
            value={editingSchoolName}
            onChange={(e) => setEditingSchoolName(e.target.value)}
            placeholder="Nhập tên trường học (VD: Trường THPT Chuyên Nguyễn Trãi)..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            type="button"
            onClick={async () => {
              const name = editingSchoolName.trim();
              if (!name) return;
              if (await updateSchoolName(name)) {
                showToast('success', 'Đã cập nhật tên trường học.');
              }
            }}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-1.5 flex-shrink-0"
          >
            <Check className="w-4 h-4" />
            <span>Lưu Tên Trường</span>
          </button>
        </div>
      </div>

      {/* 2. Department Management Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              Quản Lý Danh Sách Tổ Chuyên Môn / Phòng Ban ({departments.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cho phép Admin thêm mới, chỉnh sửa tên các Tổ chuyên môn. Hệ thống sẽ tự động cập nhật tên tổ trên hồ sơ giáo viên & đơn xin nghỉ.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingDeptId(null);
              setDeptFormName('');
              setDeptFormCode('');
              setDeptFormDesc('');
              setIsDeptModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center space-x-1.5 transition-all flex-shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thêm Tổ Mới</span>
          </button>
        </div>

        {/* Department List Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Mã Tổ</th>
                <th className="p-3">Tên Tổ Chuyên Môn</th>
                <th className="p-3 hidden sm:table-cell">Mô Tả Chức Năng</th>
                <th className="p-3 text-center">Số Nhân Sự</th>
                <th className="p-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {departments.map((dept) => {
                const userCount = users.filter(u => u.departmentId === dept.id).length;
                return (
                  <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-indigo-700">{dept.code}</td>
                    <td className="p-3 font-bold text-slate-900">{dept.name}</td>
                    <td className="p-3 text-slate-500 hidden sm:table-cell">{dept.description || 'Chưa có mô tả'}</td>
                    <td className="p-3 text-center font-bold text-slate-700">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px]">
                        {userCount} thành viên
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDeptId(dept.id);
                          setDeptFormName(dept.name);
                          setDeptFormCode(dept.code);
                          setDeptFormDesc(dept.description || '');
                          setIsDeptModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px]"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (userCount > 0) {
                            showToast('error', `Không thể xóa tổ ${dept.name} vì đang có ${userCount} thành viên thuộc tổ này.`);
                            return;
                          }
                          setDeleteConfirm({ type: 'dept', id: dept.id, name: dept.name });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px]"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <WorkflowConfigCard />

      <TelegramConfigCard />

      {/* RBAC Matrix Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Ma Trận Phân Quyền Theo Vai Trò (Role-Based Access Control)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bảng tham chiếu (chỉ đọc) sinh trực tiếp từ quy tắc phân quyền đang chạy trong hệ thống
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsMatrixExpanded(!isMatrixExpanded)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
          >
            {isMatrixExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 text-slate-500" />
                <span>Thu Nhỏ Ma Trận</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-slate-500" />
                <span>Mở Rộng Xem Ma Trận</span>
              </>
            )}
          </button>
        </div>

        {isMatrixExpanded && (
          <div className="overflow-x-auto animate-in fade-in duration-200 pt-2 border-t border-slate-100">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="p-3 font-bold text-slate-700">Quyền Hạn / Tính Năng</th>
                  {roles.map(r => (
                    <th key={r} className="p-2 font-bold text-slate-800 text-center text-[10px] min-w-[90px]">{ROLE_LABELS[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {permissionKeys.map(permKey => (
                  <tr key={permKey} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">{PERMISSION_LABELS[permKey]}</td>
                    {roles.map(role => {
                      const hasPerm = ROLE_CAPABILITIES[permKey].includes(role);
                      return (
                        <td key={role} className="p-2 text-center">
                          {hasPerm ? (
                            <span className="w-4 h-4 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
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
        )}
      </div>

      {/* Add / Edit Department Modal */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                {editingDeptId ? 'Chỉnh Sửa Thông Tin Tổ Chuyên Môn' : 'Thêm Tổ Chuyên Môn Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDeptModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!deptFormName.trim() || !deptFormCode.trim()) {
                  showToast('error', 'Vui lòng nhập đầy đủ Tên Tổ và Mã Tổ.');
                  return;
                }
                const payload = {
                  name: deptFormName.trim(),
                  code: deptFormCode.trim(),
                  description: deptFormDesc.trim(),
                };
                const ok = editingDeptId
                  ? await updateDepartment(editingDeptId, payload)
                  : await addDepartment(payload);
                // Keep the form open on failure so the input is not thrown away.
                if (!ok) return;
                showToast('success', editingDeptId ? 'Đã cập nhật tổ chuyên môn.' : 'Đã thêm tổ chuyên môn mới.');
                setIsDeptModalOpen(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên Tổ Chuyên Môn / Phòng Ban (*)</label>
                <input
                  type="text"
                  required
                  value={deptFormName}
                  onChange={(e) => setDeptFormName(e.target.value)}
                  placeholder="VD: Tổ Giáo Dục Thể Chất"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mã Viết Tắt Tổ (*)</label>
                <input
                  type="text"
                  required
                  value={deptFormCode}
                  onChange={(e) => setDeptFormCode(e.target.value)}
                  placeholder="VD: GDTC"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô Tả Chức Năng (Tùy chọn)</label>
                <textarea
                  rows={2}
                  value={deptFormDesc}
                  onChange={(e) => setDeptFormDesc(e.target.value)}
                  placeholder="Mô tả phạm vi giảng dạy hoặc nhiệm vụ của tổ..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex space-x-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 font-bold shadow-md"
                >
                  {editingDeptId ? 'Lưu Cập Nhật' : 'Thêm Tổ Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Accounts Management (Firestore DB) */}
      <UserAccountManager />
      
      <ConfirmModal
        isOpen={deleteConfirm.type !== null}
        title={deleteConfirm.type === 'dept' ? 'Xóa tổ bộ môn' : 'Xóa tài khoản'}
        message={deleteConfirm.type === 'dept' 
          ? `Bạn có chắc chắn muốn xóa tổ ${deleteConfirm.name}?` 
          : `Bạn có chắc chắn muốn xóa tài khoản ${deleteConfirm.name}?`}
        confirmText="Xóa"
        onConfirm={() => {
          if (deleteConfirm.type === 'dept') {
            deleteDepartment(deleteConfirm.id);
          } else if (deleteConfirm.type === 'user') {
            // Note: user deletion logic is usually in UserAccountManager but just in case
          }
          setDeleteConfirm({ type: null, id: '', name: '' });
        }}
        onCancel={() => setDeleteConfirm({ type: null, id: '', name: '' })}
      />
    </div>
  );
}

function UserAccountManager() {
  const { users, departments, addUserProfile, approveUserProfile, rejectUserProfile, deleteUserProfile } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'user' | null, id: string, name: string}>({type: null, id: '', name: ''});

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || 'DEPT_TOAN_TIN');
  const [role, setRole] = useState<RoleType>('TEACHER');

  const pendingUsers = users.filter(u => u.status === 'PENDING_APPROVAL');
  const activeUsers = users.filter(u => u.status !== 'PENDING_APPROVAL');

  const deptMap: Record<string, string> = {};
  departments.forEach(d => { deptMap[d.id] = d.name; });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) return;

    const newUser: User = {
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
      status: 'ACTIVE',
    };

    if (!await addUserProfile(newUser)) return;
    setShowAddModal(false);
    setFullName('');
    setEmail('');
  };

  return (
    <div className="space-y-6">

      {/* Pending User Approval Section */}
      <div className="bg-amber-50 rounded-3xl border border-amber-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Tài Khoản Đăng Ký / Gmail Mới Chờ Admin Phê Duyệt ({pendingUsers.length})
            </h3>
            <p className="text-xs text-amber-700 mt-0.5">Phê duyệt và phân bổ Tổ chuyên môn & Vai trò cho giáo viên mới đăng nhập lần đầu</p>
          </div>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="p-4 bg-white/80 rounded-2xl text-center text-xs text-slate-500 font-medium">
            Không có tài khoản nào đang chờ phê duyệt.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map(pu => (
              <PendingUserRow 
                key={pu.id} 
                user={pu} 
                deptMap={deptMap}
                onApprove={approveUserProfile}
                onReject={rejectUserProfile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Active User Accounts List */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Danh Sách Tài Khoản Đã Kích Hoạt ({activeUsers.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Quản lý người dùng, gán nhiều vai trò (Multi-role) đồng bộ realtime với Firebase Firestore</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Thêm Tài Khoản Mới</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-3 font-bold text-slate-700">Họ và Tên</th>
                <th className="p-3 font-bold text-slate-700">Email</th>
                <th className="p-3 font-bold text-slate-700">Tổ Chuyên Môn</th>
                <th className="p-3 font-bold text-slate-700">Các Vai Trò Được Gán</th>
                <th className="p-3 font-bold text-slate-700 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeUsers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{u.fullName}</td>
                  <td className="p-3 text-slate-600">{u.email}</td>
                  <td className="p-3 text-slate-600">{u.departmentName}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles && u.roles.map(r => (
                        <span key={r} className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">
                          {ROLE_LABELS[r] || r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => setEditingUser(u)}
                      className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold inline-flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      <span>Sửa Vai Trò</span>
                    </button>
                    {u.id !== 'USR_ADMIN' && !isAdminEmail(u.email) && (
                      <button
                        onClick={() => {
                          setDeleteConfirm({ type: 'user', id: u.id, name: u.fullName });
                        }}
                        className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Xóa</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create New User Modal */}
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
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vai Trò Chính</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleType)}
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs font-semibold"
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

      {/* Edit User Multi-role Modal */}
      {editingUser && (
        <EditUserRolesModal 
          user={editingUser} 
          deptMap={deptMap} 
          onClose={() => setEditingUser(null)} 
          onSave={addUserProfile}
        />
      )}

      <ConfirmModal
        isOpen={deleteConfirm.type !== null}
        title="Xóa tài khoản"
        message={`Bạn có chắc chắn muốn xóa tài khoản ${deleteConfirm.name}?`}
        confirmText="Xóa"
        onConfirm={() => {
          if (deleteConfirm.type === 'user') {
            deleteUserProfile(deleteConfirm.id);
          }
          setDeleteConfirm({ type: null, id: '', name: '' });
        }}
        onCancel={() => setDeleteConfirm({ type: null, id: '', name: '' })}
      />
    </div>
  );
}

function PendingUserRow({ 
  user, 
  deptMap, 
  onApprove, 
  onReject 
}: { 
  user: any; 
  deptMap: Record<string, string>;
  onApprove: (id: string, role: RoleType, deptId: string, deptName: string) => Promise<boolean>;
  onReject: (id: string) => Promise<boolean>;
}) {
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
          onChange={(e) => setSelectedDept(e.target.value)}
          className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
        >
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as RoleType)}
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

function EditUserRolesModal({ 
  user, 
  deptMap, 
  onClose, 
  onSave 
}: { 
  user: User; 
  deptMap: Record<string, string>;
  onClose: () => void;
  onSave: (updatedUser: User) => Promise<boolean>;
}) {
  const { departments } = useApp();

  const ALL_ROLES: RoleType[] = [
    'TEACHER',
    'GROUP_LEADER',
    'HEAD_OF_DEPT',
    'VICE_PRINCIPAL',
    'PRINCIPAL',
    'SECRETARY',
    'ACCOUNTANT',
    'TRADE_UNION',
    'INSPECTOR',
    'ADMIN',
  ];

  const [fullName, setFullName] = useState(user.fullName);
  const [departmentId, setDepartmentId] = useState(user.departmentId);
  const [subject, setSubject] = useState(user.subject || '');
  const [selectedRoles, setSelectedRoles] = useState<RoleType[]>(user.roles && user.roles.length > 0 ? user.roles : [user.activeRole || 'TEACHER']);
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
      // Keep the modal open when the write is rejected so the edit is not lost.
      if (await onSave(updated)) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
        <div>
          <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Edit className="w-4 h-4 text-indigo-600" />
            Chỉnh Sửa Phân Quyền & Gán Nhiều Vai Trò (Multi-Role)
          </h4>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Họ và Tên</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tổ Chuyên Môn</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Môn Giảng Dạy</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
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
                    <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                      isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                    }`}>
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
