export type RoleType = 
  | 'TEACHER'           // Giáo viên
  | 'GROUP_LEADER'      // Nhóm trưởng chuyên môn
  | 'HEAD_OF_DEPT'      // Tổ trưởng
  | 'VICE_PRINCIPAL'    // Hiệu phó
  | 'PRINCIPAL'         // Hiệu trưởng
  | 'SECRETARY'         // Văn thư
  | 'ACCOUNTANT'        // Kế toán
  | 'TRADE_UNION'       // Công đoàn
  | 'INSPECTOR'         // Thanh tra
  | 'SUPERVISOR'        // Giám thị
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
  status?: 'ACTIVE' | 'PENDING_APPROVAL' | 'REJECTED'; // Account approval status
}

export const ROLE_LABELS: Record<RoleType, string> = {
  TEACHER: 'Giáo viên',
  GROUP_LEADER: 'Nhóm trưởng chuyên môn',
  HEAD_OF_DEPT: 'Tổ trưởng chuyên môn',
  VICE_PRINCIPAL: 'Hiệu phó',
  PRINCIPAL: 'Hiệu trưởng',
  SECRETARY: 'Văn thư / Hành chính',
  ACCOUNTANT: 'Kế toán',
  TRADE_UNION: 'Công đoàn',
  INSPECTOR: 'Thanh tra trường học',
  SUPERVISOR: 'Giám thị',
  ADMIN: 'Quản trị hệ thống',
};

// Permission keys and the role capability table now live in
// `Edu-task/lib/permissions.ts`, which is what the app actually enforces.
