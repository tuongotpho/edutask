import React, { useMemo, useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { Invitation } from '@/Edu-task/types/invitation';
import { planLegacyMigration } from '@/Edu-task/lib/legacyProfileMigration';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ROLE_LABELS, RoleType, User } from '@/Edu-task/types/user';
import { isAdminEmail } from '@/Edu-task/lib/admin';
import { matchesSearch } from '@/Edu-task/lib/utils';
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
  ChevronRight,
  Search,
  Users,
  Building2,
  PlusCircle,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { ConfirmModal } from '@/Edu-task/components/common/ConfirmModal';
import { CollapsibleCard } from '@/Edu-task/components/common/CollapsibleCard';
import { WorkflowConfigCard, TelegramConfigCard } from '@/Edu-task/components/config/WorkflowConfigCard';
import {
  ClassCatalogCard,
  PeriodConfigCard,
  RoomCatalogCard,
} from '@/Edu-task/components/config/CatalogConfigCard';
import { EquipmentCatalogCard } from '@/Edu-task/components/config/EquipmentCatalogCard';
import { EditUserRolesModal } from './EditUserRolesModal';
import { PendingUserRow } from './PendingUserRow';
import { BulkUserImportModal } from './BulkUserImportModal';

/**
 * Leaders first, then Vietnamese alphabetical order.
 *
 * `localeCompare` with 'vi' is what makes "Đ" sort after "D" instead of after
 * "Z", which is where a plain code-point sort would put it.
 */
function compareMembers(a: User, b: User): number {
  const rank = (u: User) =>
    u.roles.includes('HEAD_OF_DEPT') ? 0 : u.roles.includes('GROUP_LEADER') ? 1 : 2;
  return rank(a) - rank(b) || a.fullName.localeCompare(b.fullName, 'vi');
}

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
    leaves,
    tasks,
    showToast
  } = useApp();

  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);

  const [editingSchoolName, setEditingSchoolName] = useState(schoolName);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptFormName, setDeptFormName] = useState('');
  const [deptFormCode, setDeptFormCode] = useState('');
  const [deptFormDesc, setDeptFormDesc] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'dept' | 'user' | null, id: string, name: string}>({type: null, id: '', name: ''});

  if (!canManageRbac(currentUser, activeRole)) {
    return (
      <div className="p-8 bg-white rounded-[5px] border border-slate-200 text-center space-y-3 shadow-sm my-6">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-bold text-xl">
          🚫
        </div>
        <h3 className="text-base font-bold text-slate-900">Truy Cập Khu Vực Quản Trị Bị Từ Chối</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Chỉ có Quản trị viên hệ thống (Admin) mới có quyền truy cập thẻ Quản trị RBAC và Phê duyệt tài khoản. Vai trò hiện tại của bạn: <strong>{ROLE_LABELS[activeRole] || activeRole}</strong>.
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
      <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-2">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          Cấu Hình Hệ Thống, Phân Quyền và Tổ Chuyên Môn
        </h2>
        <p className="text-xs text-slate-500">
          Thiết lập tên trường học, danh sách tổ chuyên môn linh hoạt, ma trận quyền hạn theo vai trò và quản lý người dùng.
        </p>
      </div>

      {/* 1. School Name Settings Card */}
      <CollapsibleCard
        title="Cấu Hình Thông Tin Trường Học"
        subtitle="Tên trường học hiển thị đồng bộ trên thanh điều hướng, tiêu đề ứng dụng, các đơn xin nghỉ phép và báo cáo thống kê."
        icon={Building2}
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={editingSchoolName}
            onChange={(e) => setEditingSchoolName(e.target.value)}
            placeholder="Nhập tên trường học (VD: Trường THPT Nguyễn Du)..."
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
      </CollapsibleCard>

      {/* 2. Department Management Card */}
      <CollapsibleCard
        title="Quản Lý Danh Sách Tổ Chuyên Môn / Phòng Ban"
        subtitle="Nhấp vào một tổ để xem danh sách giáo viên thuộc tổ đó. Hệ thống sẽ tự động cập nhật tên tổ trên hồ sơ giáo viên, đơn xin nghỉ & nhiệm vụ khi bạn đổi tên."
        icon={Building2}
        badge={<span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">{departments.length} tổ</span>}
        headerAction={
          <button
            type="button"
            onClick={() => {
              setEditingDeptId(null);
              setDeptFormName('');
              setDeptFormCode('');
              setDeptFormDesc('');
              setIsDeptModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center space-x-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thêm Tổ Mới</span>
          </button>
        }
      >
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
                const members = users.filter(u => u.departmentId === dept.id);
                const userCount = members.length;
                const isExpanded = expandedDeptId === dept.id;
                const toggle = () => setExpandedDeptId(isExpanded ? null : dept.id);

                // Mirrors the guards in `deleteDepartment`, in the same order,
                // so the button is dead before the click rather than after —
                // and says which record is holding the department.
                const leaveCount = leaves.filter(l => l.departmentId === dept.id).length;
                const taskCount = tasks.filter(t => t.targetDepartmentId === dept.id).length;
                const blockReason =
                  userCount > 0 ? `Còn ${userCount} thành viên thuộc tổ này`
                  : leaveCount > 0 ? `Còn ${leaveCount} đơn xin nghỉ thuộc tổ này`
                  : taskCount > 0 ? `Còn ${taskCount} nhiệm vụ được giao cho tổ này`
                  : null;

                return (
                  <React.Fragment key={dept.id}>
                    <tr
                      onClick={toggle}
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggle();
                        }
                      }}
                      className={`cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400/40 ${
                        isExpanded ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3 font-mono font-bold text-indigo-700">
                        <span className="flex items-center gap-1.5">
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                          {dept.code}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{dept.name}</td>
                      <td className="p-3 text-slate-500 hidden sm:table-cell">{dept.description || 'Chưa có mô tả'}</td>
                      <td className="p-3 text-center font-bold text-slate-700">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px]">
                          {userCount} thành viên
                        </span>
                      </td>
                      {/* The row itself toggles the member list, so the action
                          buttons have to keep their clicks to themselves. */}
                      <td className="p-3 text-right space-x-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
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
                        {/* A disabled button swallows hover events in some
                            browsers, so the tooltip lives on the wrapper. */}
                        <span
                          className="inline-block"
                          title={blockReason ? `Không thể xóa: ${blockReason}.` : `Xóa tổ ${dept.name}`}
                        >
                          <button
                            type="button"
                            disabled={!!blockReason}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ type: 'dept', id: dept.id, name: dept.name });
                            }}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                              blockReason
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                            }`}
                          >
                            Xóa
                          </button>
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={5} className="p-0">
                          <div className="px-4 py-3.5 border-t border-slate-200 space-y-2.5">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-indigo-600" />
                              Giáo viên thuộc {dept.name} ({userCount})
                            </div>

                            {/* A `title` tooltip is unreachable on a touch
                                screen, so the reason is spelled out here too. */}
                            {blockReason && (
                              <p className="text-[11px] text-slate-500">
                                Chưa xóa được tổ này: <strong className="text-slate-700">{blockReason.toLowerCase()}</strong>.
                              </p>
                            )}

                            {userCount === 0 ? (
                              <p className="text-xs text-slate-400 italic">
                                Chưa có giáo viên nào được gán vào tổ này. Gán tổ cho giáo viên ở mục &quot;Sửa Vai Trò&quot; bên dưới.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                {[...members].sort(compareMembers).map(m => (
                                  <div
                                    key={m.id}
                                    className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-start justify-between gap-2"
                                  >
                                    <div className="min-w-0 space-y-1">
                                      <div className="font-bold text-slate-900 text-[12px] truncate">{m.fullName}</div>
                                      <div className="text-[10px] text-slate-500 truncate">{m.email}</div>
                                      {m.subject && (
                                        <div className="text-[10px] text-slate-400 truncate">Môn: {m.subject}</div>
                                      )}
                                      <div className="flex flex-wrap gap-1 pt-0.5">
                                        {m.roles.map(r => (
                                          <span
                                            key={r}
                                            className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[9px] font-bold border border-indigo-100"
                                          >
                                            {ROLE_LABELS[r] || r}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    {/* The member count above includes accounts
                                        still awaiting approval, so say which
                                        ones they are rather than let the number
                                        look wrong. */}
                                    {m.status === 'PENDING_APPROVAL' && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-bold flex-shrink-0">
                                        Chờ duyệt
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      <WorkflowConfigCard />

      {/* Scheduling catalogs. These sit before the notification settings because
          nothing else in the app works until rooms, classes and periods exist. */}
      <PeriodConfigCard />

      <RoomCatalogCard />

      <ClassCatalogCard />

      <EquipmentCatalogCard />

      <TelegramConfigCard />

      {/* RBAC Matrix Table */}
      <CollapsibleCard
        title="Ma Trận Phân Quyền Theo Vai Trò (Role-Based Access Control)"
        subtitle="Bảng tham chiếu (chỉ đọc) sinh trực tiếp từ quy tắc phân quyền đang chạy trong hệ thống"
        icon={ShieldCheck}
        iconClassName="text-emerald-600"
      >
          <div className="overflow-x-auto">
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
      </CollapsibleCard>

      {/* Add / Edit Department Modal */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[5px] p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-200">
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
  const { users, departments, addUserProfile, approveUserProfile, rejectUserProfile, deleteUserProfile, showToast } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'user' | null, id: string, name: string}>({type: null, id: '', name: ''});

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || 'DEPT_TOAN_TIN');
  const [role, setRole] = useState<RoleType>('TEACHER');

  // A school of a few hundred staff makes an unfiltered table useless, so the
  // list is searched, filtered and paged rather than rendered whole.
  const [userSearch, setUserSearch] = useState('');
  const [filterDeptId, setFilterDeptId] = useState('ALL');
  const [filterRole, setFilterRole] = useState<'ALL' | RoleType>('ALL');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const pendingUsers = users.filter(u => u.status === 'PENDING_APPROVAL');
  const activeUsers = useMemo(() => users.filter(u => u.status !== 'PENDING_APPROVAL'), [users]);

  const filteredUsers = useMemo(() => activeUsers
    .filter(u =>
      matchesSearch(userSearch, u.fullName, u.email, u.departmentName) &&
      (filterDeptId === 'ALL' || u.departmentId === filterDeptId) &&
      (filterRole === 'ALL' || u.roles.includes(filterRole))
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')),
    [activeUsers, userSearch, filterDeptId, filterRole]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  // Clamping on read rather than resetting from an effect: narrowing a filter
  // can drop the page count below the current page, and this keeps the table
  // showing rows instead of blanking until a re-render catches up.
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetToFirstPage = () => setPage(1);

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

  /**
   * Dọn các hồ sơ do đợt nhập danh sách cũ để lại.
   *
   * Đợt nhập cũ tạo hồ sơ với mã tự chế `USR_BULK_...`, trong khi luật bảo mật
   * tra hồ sơ theo mã đăng nhập — nên những hồ sơ ấy không khớp với ai. Người
   * trong danh sách đăng nhập vào là bị coi như người lạ.
   *
   * Kế hoạch được tính trước và hiện ra để xem, vì việc này vừa xoá vừa ghi
   * lên hồ sơ nhân sự; bấm rồi mới biết mình vừa làm gì là quá muộn.
   */
  const legacyPlan = useMemo(
    () => planLegacyMigration(users, new Date().toISOString().replace('T', ' ').slice(0, 16)),
    [users]
  );
  const legacyCount = legacyPlan.toInvite.length + legacyPlan.toMerge.length + legacyPlan.needsReview.length;
  const [isMigrating, setIsMigrating] = useState(false);

  const handleLegacyMigration = async () => {
    setIsMigrating(true);
    let invited = 0, merged = 0, failed = 0;

    for (const item of legacyPlan.toMerge) {
      try {
        const real = users.find(u => u.id === item.realUserId);
        if (!real) { failed++; continue; }
        await firebaseService.saveUser({ ...real, ...item.patch } as typeof real);
        await firebaseService.deleteUser(item.deleteUserId);
        merged++;
      } catch (err) {
        failed++;
        console.error('[Dọn hồ sơ cũ] Không ghép được', item.deleteUserId, err);
      }
    }

    for (const item of legacyPlan.toInvite) {
      try {
        await firebaseService.saveInvitation(item.invitation);
        await firebaseService.deleteUser(item.deleteUserId);
        invited++;
      } catch (err) {
        failed++;
        console.error('[Dọn hồ sơ cũ] Không chuyển được thành thư mời', item.deleteUserId, err);
      }
    }

    setIsMigrating(false);
    if (failed > 0) {
      showToast('error', `Đã xử lý ${merged + invited} hồ sơ, còn ${failed} hồ sơ lỗi — xem Console để biết chi tiết.`);
    } else {
      showToast('success', `Xong: ${merged} tài khoản đã đăng nhập được khôi phục vai trò, ${invited} tài khoản chuyển thành thư mời.`);
    }
  };

  const handleBulkImportUsers = async (invitations: Invitation[]): Promise<number> => {
    let successCount = 0;
    for (const inv of invitations) {
      try {
        await firebaseService.saveInvitation(inv);
        successCount++;
      } catch (err) {
        console.error('[Thư mời] Không lưu được thư mời cho', inv.email, err);
      }
    }
    return successCount;
  };

  return (
    <div className="space-y-6">

      {/* Hồ sơ còn sót từ đợt nhập danh sách cũ */}
      {legacyCount > 0 && (
        <div className="bg-rose-50 rounded-[5px] border border-rose-200 p-6 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-rose-900">
            Cần dọn {legacyCount} hồ sơ từ đợt nhập danh sách cũ
          </h3>
          <p className="text-xs text-rose-800 leading-relaxed max-w-3xl">
            Những hồ sơ này mang mã tự sinh nên máy chủ không nhận ra chủ nhân của chúng.
            Người trong danh sách khi đăng nhập sẽ bị coi là tài khoản lạ, mất vai trò đã được phân,
            và mọi thao tác cần quyền đều bị từ chối.
          </p>
          <ul className="text-xs text-rose-800 space-y-1">
            <li>• <strong>{legacyPlan.toMerge.length}</strong> người đã đăng nhập — khôi phục vai trò vào hồ sơ thật của họ.</li>
            <li>• <strong>{legacyPlan.toInvite.length}</strong> người chưa đăng nhập — chuyển thành thư mời, vai trò cấp ngay khi họ vào lần đầu.</li>
            {legacyPlan.needsReview.length > 0 && (
              <li>• <strong>{legacyPlan.needsReview.length}</strong> hồ sơ thiếu email — không tự xử lý được, cần xem lại thủ công.</li>
            )}
          </ul>
          <button
            type="button"
            onClick={handleLegacyMigration}
            disabled={isMigrating}
            className="px-4 py-2 rounded-[5px] bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-rose-500/20 transition-colors"
          >
            {isMigrating ? 'Đang dọn…' : 'Dọn ngay'}
          </button>
        </div>
      )}

      {/* Pending User Approval Section */}
      <div className="bg-amber-50 rounded-[5px] border border-amber-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Tài Khoản Đăng Ký / Gmail Mới Chờ Admin Phê Duyệt ({pendingUsers.length})
            </h3>
            <p className="text-xs text-amber-700 mt-0.5">Phê duyệt và phân bổ Tổ chuyên môn và Vai trò cho giáo viên mới đăng nhập lần đầu</p>
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
      <CollapsibleCard
        title="Danh Sách Tài Khoản Đã Kích Hoạt"
        subtitle="Quản lý người dùng, gán nhiều vai trò (Multi-role) đồng bộ realtime với Firebase Firestore"
        icon={ShieldCheck}
        defaultOpen
        badge={<span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">{activeUsers.length} tài khoản</span>}
        headerAction={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Nhập Hàng Loạt (CSV)</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Thêm Thủ Công</span>
            </button>
          </div>
        }
      >
        {/* Search & filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); resetToFirstPage(); }}
              placeholder="Tìm tên, email, tổ..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <select
            value={filterDeptId}
            onChange={(e) => { setFilterDeptId(e.target.value); resetToFirstPage(); }}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 font-medium"
          >
            <option value="ALL">-- Tất cả tổ chuyên môn --</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={filterRole}
            onChange={(e) => { setFilterRole(e.target.value as 'ALL' | RoleType); resetToFirstPage(); }}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 font-medium"
          >
            <option value="ALL">-- Tất cả vai trò --</option>
            {ALL_ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
            Không tìm thấy tài khoản nào khớp bộ lọc.
          </div>
        ) : (
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
              {pagedUsers.map(u => (
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
        )}

        {/* Paging */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-500">
            {filteredUsers.length === 0
              ? 'Không có kết quả'
              : <>Hiển thị <strong className="text-slate-800">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredUsers.length)}</strong> trên tổng <strong className="text-slate-800">{filteredUsers.length}</strong> tài khoản</>}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                // Reconciles the stored page with the clamp before stepping, so
                // two clicks in one tick still move two pages and a page left
                // over from a wider filter cannot strand the stepper.
                onClick={() => setPage(p => Math.max(Math.min(p, totalPages) - 1, 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold text-slate-700 disabled:opacity-40 disabled:hover:bg-white"
              >
                Trước
              </button>
              <span className="px-2 font-bold text-slate-700">Trang {currentPage}/{totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(Math.min(p, totalPages) + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold text-slate-700 disabled:opacity-40 disabled:hover:bg-white"
              >
                Sau
              </button>
            </div>
          )}
        </div>
      </CollapsibleCard>

      {/* Create New User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[5px] p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
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

      {/* Bulk User Import CSV/Excel Modal */}
      <BulkUserImportModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        departments={departments}
        existingUsers={users}
        onImportUsers={handleBulkImportUsers}
        showToast={showToast}
      />

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
