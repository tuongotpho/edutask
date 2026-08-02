import { Department, User } from '@/Edu-task/types/user';
import { LeaveRequest } from '@/Edu-task/types/leave';
import { storage } from '@/Edu-task/lib/storage';
import { firebaseService } from '@/Edu-task/services/firebaseService';

interface DepartmentLogicProps {
  schoolName: string;
  setSchoolName: React.Dispatch<React.SetStateAction<string>>;
  departments: Department[];
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  leaves: LeaveRequest[];
  setLeaves: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
}

export function useDepartmentLogic({ 
  schoolName, setSchoolName, 
  departments, setDepartments, 
  users, setUsers, 
  leaves, setLeaves 
}: DepartmentLogicProps) {
  
  const updateSchoolName = (name: string) => {
    setSchoolName(name);
    storage.saveSchoolName(name);
  };

  const addDepartment = (data: { name: string; code: string; description?: string }) => {
    const newDept: Department = {
      id: `DEPT_${Date.now()}`,
      name: data.name,
      code: data.code.toUpperCase().replace(/\s+/g, '-'),
      description: data.description || '',
    };
    const updated = [...departments, newDept];
    setDepartments(updated);
    storage.saveDepartments(updated);
  };

  const updateDepartment = (id: string, data: { name: string; code: string; description?: string }) => {
    const updatedDepts = departments.map(d => {
      if (d.id !== id) return d;
      return {
        ...d,
        name: data.name,
        code: data.code.toUpperCase().replace(/\s+/g, '-'),
        description: data.description !== undefined ? data.description : d.description,
      };
    });
    setDepartments(updatedDepts);
    storage.saveDepartments(updatedDepts);

    // Sync departmentName across users
    const changedUsers = users.filter(u => u.departmentId === id).map(u => ({ ...u, departmentName: data.name }));
    const updatedUsers = users.map(u => u.departmentId === id ? { ...u, departmentName: data.name } : u);
    setUsers(updatedUsers);
    storage.saveUsers(updatedUsers);
    changedUsers.forEach(u => firebaseService.saveUser(u));

    // Sync departmentName across leaves
    const changedLeaves = leaves.filter(l => l.departmentId === id).map(l => ({ ...l, departmentName: data.name }));
    const updatedLeaves = leaves.map(l => l.departmentId === id ? { ...l, departmentName: data.name } : l);
    setLeaves(updatedLeaves);
    storage.saveLeaves(updatedLeaves);
    changedLeaves.forEach(l => firebaseService.saveLeave(l));
  };

  const deleteDepartment = (id: string) => {
    const updated = departments.filter(d => d.id !== id);
    setDepartments(updated);
    storage.saveDepartments(updated);
  };

  return {
    updateSchoolName,
    addDepartment,
    updateDepartment,
    deleteDepartment,
  };
}
