import { User, RoleType } from '@/Edu-task/types/user';
import { AppNotification } from '@/Edu-task/types/notification';
import { storage } from '@/Edu-task/lib/storage';
import { firebaseService } from '@/Edu-task/services/firebaseService';

interface UserLogicProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  setActiveRole: React.Dispatch<React.SetStateAction<RoleType>>;
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
}

export function useUserLogic({ users, setUsers, currentUser, setCurrentUser, setActiveRole, setNotifications }: UserLogicProps) {
  
  const addUserProfile = async (user: User) => {
    await firebaseService.saveUser(user);
  };

  const approveUserProfile = async (userId: string, role: RoleType, deptId: string, deptName: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const updated: User = {
      ...target,
      departmentId: deptId,
      departmentName: deptName,
      roles: [role],
      activeRole: role,
      status: 'ACTIVE',
    };
    await firebaseService.saveUser(updated);
  };

  const rejectUserProfile = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const updated: User = {
      ...target,
      status: 'REJECTED',
    };
    await firebaseService.saveUser(updated);
  };

  const deleteUserProfile = async (userId: string) => {
    await firebaseService.deleteUser(userId);
  };

  const switchUser = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    
    storage.setCurrentUserId(userId);
    setCurrentUser(target);
    setActiveRole(target.roles[0]);
    setNotifications(storage.getNotifications(userId));
  };

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
    switchUser,
    switchActiveRole,
  };
}
