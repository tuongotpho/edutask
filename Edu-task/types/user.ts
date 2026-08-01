export type RoleType = 
  | 'TEACHER'           // Giáo viên
  | 'HEAD_OF_DEPT'      // Tổ trưởng
  | 'VICE_PRINCIPAL'    // Hiệu phó
  | 'PRINCIPAL'         // Hiệu trưởng
  | 'SECRETARY'         // Văn thư
  | 'ACCOUNTANT'        // Kế toán
  | 'TRADE_UNION'       // Công đoàn
  | 'INSPECTOR'         // Thanh tra
  | 'ADMIN';            // Quản trị hệ thống

export interface UserRole {
  role: RoleType;
  departmentId?: string; // If role is specific to a department (e.g. HOD of Toán)
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  headUserId?: string;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
  departmentId: string;
  departmentName: string;
  subject?: string; // Môn giảng dạy
  roles: RoleType[]; // Multi-role support
  activeRole: RoleType; // Currently selected active context role
  isTeachingStaff: boolean;
}

export const ROLE_LABELS: Record<RoleType, string> = {
  TEACHER: 'Giáo viên',
  HEAD_OF_DEPT: 'Tổ trưởng chuyên môn',
  VICE_PRINCIPAL: 'Hiệu phó',
  PRINCIPAL: 'Hiệu trưởng',
  SECRETARY: 'Văn thư / Hành chính',
  ACCOUNTANT: 'Kế toán',
  TRADE_UNION: 'Công đoàn',
  INSPECTOR: 'Thanh tra trường học',
  ADMIN: 'Quản trị hệ thống',
};

export const PERMISSIONS = {
  LEAVE_CREATE: 'leave:create',
  LEAVE_APPROVE_DEPT: 'leave:approve_dept',
  LEAVE_APPROVE_EXEC: 'leave:approve_exec',
  LEAVE_VIEW_ALL: 'leave:view_all',
  
  TASK_CREATE: 'task:create',
  TASK_ASSIGN_DEPT: 'task:assign_dept',
  TASK_ASSIGN_ALL: 'task:assign_all',
  TASK_VIEW_ALL: 'task:view_all',
  
  CONFIG_WORKFLOW: 'config:workflow',
  MANAGE_USERS: 'config:users',
} as const;
