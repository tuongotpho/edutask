import { User, RoleType } from '@/Edu-task/types/user';
import { storage } from '@/Edu-task/lib/storage';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

interface UserLogicProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User | null;
  setActiveRole: React.Dispatch<React.SetStateAction<RoleType>>;
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được lên máy chủ. Vui lòng kiểm tra quyền truy cập và thử lại.';

export function useUserLogic({ users, setUsers, currentUser, setActiveRole, notify }: UserLogicProps) {

  // These writes are admin-only and land on a single document, so there is no
  // optimistic local mutation to roll back: the realtime snapshot is the source
  // of truth. We only need to surface a rejection instead of failing silently.
  const saveProfile = async (user: User, successText?: string): Promise<boolean> => {
    try {
      await firebaseService.saveUser(user);
      if (successText) notify('success', successText);
      return true;
    } catch (err) {
      console.error('Failed to save user profile:', err);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const addUserProfile = async (user: User): Promise<boolean> =>
    saveProfile(user, 'Đã lưu thông tin tài khoản.');

  const approveUserProfile = async (userId: string, role: RoleType, deptId: string, deptName: string): Promise<boolean> => {
    const target = users.find(u => u.id === userId);
    if (!target) return false;
    const updated: User = {
      ...target,
      departmentId: deptId,
      departmentName: deptName,
      roles: [role],
      activeRole: role,
      status: 'ACTIVE',
    };
    return saveProfile(updated, `Đã phê duyệt tài khoản ${target.fullName}.`);
  };

  const rejectUserProfile = async (userId: string): Promise<boolean> => {
    const target = users.find(u => u.id === userId);
    if (!target) return false;
    return saveProfile({ ...target, status: 'REJECTED' }, `Đã từ chối tài khoản ${target.fullName}.`);
  };

  const deleteUserProfile = async (userId: string): Promise<boolean> => {
    const previousUsers = users;
    const updatedUsers = users.filter(u => u.id !== userId);
    setUsers(updatedUsers);
    storage.saveUsers(updatedUsers);

    try {
      await firebaseService.deleteUser(userId);
      notify('success', 'Đã xóa tài khoản.');
      return true;
    } catch (err) {
      console.error('Failed to delete user:', err);
      setUsers(previousUsers);
      storage.saveUsers(previousUsers);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  // activeRole is a client-side view preference. Security rules deliberately
  // block users from writing it to their own profile, so it stays local.
  const switchActiveRole = (role: RoleType) => {
    if (!currentUser) return;
    setActiveRole(role);
    const updatedUsers = users.map(u =>
      u.id === currentUser.id ? { ...u, activeRole: role } : u
    );
    setUsers(updatedUsers);
    storage.saveUsers(updatedUsers);
  };

  return {
    addUserProfile,
    approveUserProfile,
    rejectUserProfile,
    deleteUserProfile,
    switchActiveRole,
  };
}
