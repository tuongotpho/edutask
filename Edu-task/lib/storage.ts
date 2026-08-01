import { User, Department, RoleType } from '@/Edu-task/types/user';
import { LeaveRequest, WorkflowRule } from '@/Edu-task/types/leave';
import { Task } from '@/Edu-task/types/task';
import { AppNotification } from '@/Edu-task/types/notification';

export const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'DEPT_BGH', name: 'Ban Giám Hiệu', code: 'BGH', description: 'Ban Lãnh đạo Nhà trường' },
  { id: 'DEPT_TOAN_TIN', name: 'Tổ Toán - Tin', code: 'TOAN-TIN', description: 'Tổ Chuyên môn Toán học & Tin học' },
  { id: 'DEPT_VAN_SU', name: 'Tổ Ngữ Văn - Lịch Sử', code: 'VAN-SU', description: 'Tổ Chuyên môn Ngữ Văn & Lịch Sử' },
  { id: 'DEPT_ANH', name: 'Tổ Ngoại Ngữ', code: 'NGOAI-NGU', description: 'Tổ Chuyên môn Tiếng Anh & Tiếng Pháp' },
  { id: 'DEPT_LY_HOA_SINH', name: 'Tổ Lý - Hóa - Sinh', code: 'KHOA-HOC-TU-NHIEN', description: 'Tổ Chuyên môn Khoa học Tự nhiên' },
  { id: 'DEPT_HANH_CHINH', name: 'Tổ Hành Chính - Kế Toán', code: 'HANH-CHINH', description: 'Văn thư, Kế toán, Thủ quỹ' },
];

export const INITIAL_USERS: User[] = [
  {
    id: 'USR_ADMIN',
    fullName: 'Quản trị viên Hệ thống (Admin)',
    email: 'admin@gmail.com',
    phone: '0900 000 999',
    departmentId: 'DEPT_BGH',
    departmentName: 'Ban Giám Hiệu',
    roles: ['ADMIN', 'PRINCIPAL', 'TEACHER'],
    activeRole: 'ADMIN',
    isTeachingStaff: true,
    subject: 'Quản trị hệ thống',
    status: 'ACTIVE',
  }
];

export const INITIAL_LEAVES: LeaveRequest[] = [];

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [];

// LocalStorage Persistence Class
class StorageService {
  private STORAGE_KEY_PREFIX = 'edutask_school_app_v1_';

  private getItem<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const item = localStorage.getItem(this.STORAGE_KEY_PREFIX + key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  }

  private setItem<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage error:', e);
    }
  }

  // Users & Current User Session
  getUsers(): User[] {
    return this.getItem<User[]>('users', INITIAL_USERS);
  }

  saveUsers(users: User[]): void {
    this.setItem('users', users);
  }

  getCurrentUserId(): string {
    return this.getItem<string>('current_user_id', 'USR_003'); // Default to Thầy Nam (HOD)
  }

  setCurrentUserId(id: string): void {
    this.setItem('current_user_id', id);
  }

  // Leave Requests
  getLeaves(): LeaveRequest[] {
    return this.getItem<LeaveRequest[]>('leaves', INITIAL_LEAVES);
  }

  saveLeaves(leaves: LeaveRequest[]): void {
    this.setItem('leaves', leaves);
  }

  addLeave(leave: LeaveRequest): void {
    const leaves = this.getLeaves();
    leaves.unshift(leave);
    this.saveLeaves(leaves);
  }

  updateLeave(updated: LeaveRequest): void {
    const leaves = this.getLeaves().map(l => l.id === updated.id ? updated : l);
    this.saveLeaves(leaves);
  }

  // Tasks
  getTasks(): Task[] {
    return this.getItem<Task[]>('tasks', INITIAL_TASKS);
  }

  saveTasks(tasks: Task[]): void {
    this.setItem('tasks', tasks);
  }

  addTask(task: Task): void {
    const tasks = this.getTasks();
    tasks.unshift(task);
    this.saveTasks(tasks);
  }

  updateTask(updated: Task): void {
    const tasks = this.getTasks().map(t => t.id === updated.id ? updated : t);
    this.saveTasks(tasks);
  }

  // Notifications
  getNotifications(userId: string): AppNotification[] {
    const all = this.getItem<AppNotification[]>('notifications', INITIAL_NOTIFICATIONS);
    return all.filter(n => n.recipientUserId === userId);
  }

  addNotification(notif: AppNotification): void {
    const all = this.getItem<AppNotification[]>('notifications', INITIAL_NOTIFICATIONS);
    all.unshift(notif);
    this.setItem('notifications', all);
  }

  markNotificationRead(id: string): void {
    const all = this.getItem<AppNotification[]>('notifications', INITIAL_NOTIFICATIONS);
    const updated = all.map(n => n.id === id ? { ...n, isRead: true } : n);
    this.setItem('notifications', updated);
  }

  // School Name
  getSchoolName(): string {
    return this.getItem<string>('school_name', 'Trường THPT Chuyên EduTask');
  }

  saveSchoolName(name: string): void {
    this.setItem('school_name', name);
  }

  // Departments
  getDepartments(): Department[] {
    return this.getItem<Department[]>('departments', INITIAL_DEPARTMENTS);
  }

  saveDepartments(depts: Department[]): void {
    this.setItem('departments', depts);
  }

  // Reset to initial demo state
  resetAllData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'users');
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'leaves');
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'tasks');
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'notifications');
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'current_user_id');
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'school_name');
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'departments');
  }
}

export const storage = new StorageService();
