import { Department, User } from '@/Edu-task/types/user';
import { LeaveRequest } from '@/Edu-task/types/leave';
import { storage } from '@/Edu-task/lib/storage';
import { genId } from '@/Edu-task/lib/utils';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

interface DepartmentLogicProps {
  schoolName: string;
  setSchoolName: React.Dispatch<React.SetStateAction<string>>;
  departments: Department[];
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  leaves: LeaveRequest[];
  setLeaves: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được thay đổi lên máy chủ. Thay đổi đã được hoàn tác.';

export function useDepartmentLogic({
  schoolName, setSchoolName,
  departments, setDepartments,
  users, setUsers,
  leaves, setLeaves,
  notify
}: DepartmentLogicProps) {

  const updateSchoolName = async (name: string): Promise<boolean> => {
    const previous = schoolName;
    setSchoolName(name);
    storage.saveSchoolName(name);
    try {
      await firebaseService.saveSchoolName(name);
      return true;
    } catch (err) {
      console.error('Failed to save school name:', err);
      setSchoolName(previous);
      storage.saveSchoolName(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const addDepartment = async (data: { name: string; code: string; description?: string }): Promise<boolean> => {
    const newDept: Department = {
      id: genId('DEPT'),
      name: data.name,
      code: data.code.toUpperCase().replace(/\s+/g, '-'),
      description: data.description || '',
    };

    const previous = departments;
    const updated = [...departments, newDept];
    setDepartments(updated);
    storage.saveDepartments(updated);

    try {
      await firebaseService.saveDepartment(newDept);
      return true;
    } catch (err) {
      console.error('Failed to add department:', err);
      setDepartments(previous);
      storage.saveDepartments(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const updateDepartment = async (
    id: string,
    data: { name: string; code: string; description?: string }
  ): Promise<boolean> => {
    const target = departments.find(d => d.id === id);
    if (!target) return false;

    const updatedDept: Department = {
      ...target,
      name: data.name,
      code: data.code.toUpperCase().replace(/\s+/g, '-'),
      description: data.description !== undefined ? data.description : target.description,
    };

    const prevDepartments = departments;
    const prevUsers = users;
    const prevLeaves = leaves;

    const updatedDepts = departments.map(d => (d.id === id ? updatedDept : d));
    // Denormalised department names live on users and leaves, so they have to be
    // rewritten in step with the department itself.
    const changedUsers = users.filter(u => u.departmentId === id).map(u => ({ ...u, departmentName: data.name }));
    const changedLeaves = leaves.filter(l => l.departmentId === id).map(l => ({ ...l, departmentName: data.name }));
    const updatedUsers = users.map(u => (u.departmentId === id ? { ...u, departmentName: data.name } : u));
    const updatedLeaves = leaves.map(l => (l.departmentId === id ? { ...l, departmentName: data.name } : l));

    setDepartments(updatedDepts);
    setUsers(updatedUsers);
    setLeaves(updatedLeaves);
    storage.saveDepartments(updatedDepts);
    storage.saveUsers(updatedUsers);
    storage.saveLeaves(updatedLeaves);

    try {
      await firebaseService.saveDepartment(updatedDept);
      await Promise.all([
        ...changedUsers.map(u => firebaseService.saveUser(u)),
        ...changedLeaves.map(l => firebaseService.saveLeave(l)),
      ]);
      return true;
    } catch (err) {
      console.error('Failed to update department:', err);
      setDepartments(prevDepartments);
      setUsers(prevUsers);
      setLeaves(prevLeaves);
      storage.saveDepartments(prevDepartments);
      storage.saveUsers(prevUsers);
      storage.saveLeaves(prevLeaves);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const deleteDepartment = async (id: string): Promise<boolean> => {
    // Guard against orphaning records that still point at this department.
    const memberCount = users.filter(u => u.departmentId === id).length;
    if (memberCount > 0) {
      notify('error', `Không thể xóa: vẫn còn ${memberCount} thành viên thuộc tổ này.`);
      return false;
    }
    const leaveCount = leaves.filter(l => l.departmentId === id).length;
    if (leaveCount > 0) {
      notify('error', `Không thể xóa: vẫn còn ${leaveCount} đơn xin nghỉ thuộc tổ này.`);
      return false;
    }

    const previous = departments;
    const updated = departments.filter(d => d.id !== id);
    setDepartments(updated);
    storage.saveDepartments(updated);

    try {
      await firebaseService.deleteDepartment(id);
      return true;
    } catch (err) {
      console.error('Failed to delete department:', err);
      setDepartments(previous);
      storage.saveDepartments(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  return {
    updateSchoolName,
    addDepartment,
    updateDepartment,
    deleteDepartment,
  };
}
