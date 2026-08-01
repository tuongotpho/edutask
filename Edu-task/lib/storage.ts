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
  },
  {
    id: 'USR_001',
    fullName: 'TS. Nguyễn Văn An',
    email: 'nguyenvanan@truong.edu.vn',
    phone: '0912 345 678',
    departmentId: 'DEPT_BGH',
    departmentName: 'Ban Giám Hiệu',
    roles: ['PRINCIPAL', 'TEACHER', 'ADMIN'],
    activeRole: 'PRINCIPAL',
    isTeachingStaff: true,
    subject: 'Toán cao cấp',
  },
  {
    id: 'USR_002',
    fullName: 'ThS. Trần Thị Bích',
    email: 'tranthibich@truong.edu.vn',
    phone: '0988 765 432',
    departmentId: 'DEPT_BGH',
    departmentName: 'Ban Giám Hiệu',
    roles: ['VICE_PRINCIPAL', 'TEACHER'],
    activeRole: 'VICE_PRINCIPAL',
    isTeachingStaff: true,
    subject: 'Ngữ văn',
  },
  {
    id: 'USR_003',
    fullName: 'Thầy Lê Hoàng Nam',
    email: 'lehoangnam@truong.edu.vn',
    phone: '0903 111 222',
    departmentId: 'DEPT_TOAN_TIN',
    departmentName: 'Tổ Toán - Tin',
    roles: ['HEAD_OF_DEPT', 'TEACHER', 'INSPECTOR'],
    activeRole: 'HEAD_OF_DEPT',
    isTeachingStaff: true,
    subject: 'Tin học & CNTT',
  },
  {
    id: 'USR_004',
    fullName: 'Cô Phạm Thị Thu',
    email: 'phamthithu@truong.edu.vn',
    phone: '0977 333 444',
    departmentId: 'DEPT_TOAN_TIN',
    departmentName: 'Tổ Toán - Tin',
    roles: ['TEACHER', 'TRADE_UNION'],
    activeRole: 'TEACHER',
    isTeachingStaff: true,
    subject: 'Toán Đại số',
  },
  {
    id: 'USR_005',
    fullName: 'Thầy Đỗ Minh Tuấn',
    email: 'dominhtuan@truong.edu.vn',
    phone: '0966 555 666',
    departmentId: 'DEPT_TOAN_TIN',
    departmentName: 'Tổ Toán - Tin',
    roles: ['TEACHER'],
    activeRole: 'TEACHER',
    isTeachingStaff: true,
    subject: 'Tin học ứng dụng',
  },
  {
    id: 'USR_006',
    fullName: 'Cô Nguyễn Hoàng Mai',
    email: 'nguyenhoangmai@truong.edu.vn',
    phone: '0918 888 999',
    departmentId: 'DEPT_VAN_SU',
    departmentName: 'Tổ Ngữ Văn - Lịch Sử',
    roles: ['HEAD_OF_DEPT', 'TEACHER'],
    activeRole: 'HEAD_OF_DEPT',
    isTeachingStaff: true,
    subject: 'Ngữ văn 12',
  },
  {
    id: 'USR_007',
    fullName: 'Cô Hoàng Anh Đức',
    email: 'hoanganhduc@truong.edu.vn',
    phone: '0944 222 333',
    departmentId: 'DEPT_HANH_CHINH',
    departmentName: 'Tổ Hành Chính - Kế Toán',
    roles: ['SECRETARY'],
    activeRole: 'SECRETARY',
    isTeachingStaff: false,
  },
  {
    id: 'USR_008',
    fullName: 'Bà Trịnh Kim Oanh',
    email: 'trinhkimoanh@truong.edu.vn',
    phone: '0933 777 888',
    departmentId: 'DEPT_HANH_CHINH',
    departmentName: 'Tổ Hành Chính - Kế Toán',
    roles: ['ACCOUNTANT'],
    activeRole: 'ACCOUNTANT',
    isTeachingStaff: false,
  },
];

export const INITIAL_LEAVES: LeaveRequest[] = [
  {
    id: 'LV_2026_001',
    code: 'ĐXN-2026-001',
    applicantId: 'USR_004',
    applicantName: 'Cô Phạm Thị Thu',
    applicantRole: 'Giáo viên',
    departmentId: 'DEPT_TOAN_TIN',
    departmentName: 'Tổ Toán - Tin',
    leaveType: 'SICK',
    startDate: '2026-08-03',
    endDate: '2026-08-04',
    totalDays: 2,
    session: 'FULL_DAY',
    reason: 'Đi kiểm tra sức khỏe tổng quát và điều trị ngoại trú tại Bệnh viện Đại học Y',
    notes: 'Đã bàn giao giáo án tuần 1 cho thầy Đỗ Minh Tuấn dạy thay.',
    substituteTeacherId: 'USR_005',
    substituteTeacherName: 'Thầy Đỗ Minh Tuấn',
    substituteStatus: 'CONFIRMED',
    proofFiles: [
      {
        id: 'FL_001',
        name: 'Giay_hen_kham_benh_BV_Y.pdf',
        size: '1.2 MB',
        url: '#',
        type: 'application/pdf',
      }
    ],
    currentStepIndex: 0,
    steps: [
      {
        level: 'HEAD_OF_DEPT',
        levelLabel: 'Tổ trưởng chuyên môn',
        status: 'PENDING',
      },
      {
        level: 'VICE_PRINCIPAL',
        levelLabel: 'Hiệu phó BGH',
        status: 'PENDING',
      },
      {
        level: 'PRINCIPAL',
        levelLabel: 'Hiệu trưởng',
        status: 'PENDING',
      }
    ],
    overallStatus: 'IN_REVIEW',
    history: [
      {
        id: 'HIST_01',
        action: 'TẠO ĐƠN XIN NGHỈ',
        actorName: 'Cô Phạm Thị Thu',
        actorRole: 'Giáo viên',
        timestamp: '2026-07-30 08:30',
        note: 'Gửi đơn xin nghỉ ốm 2 ngày.',
      }
    ],
    createdAt: '2026-07-30 08:30',
    updatedAt: '2026-07-30 08:30',
  },
  {
    id: 'LV_2026_002',
    code: 'ĐXN-2026-002',
    applicantId: 'USR_005',
    applicantName: 'Thầy Đỗ Minh Tuấn',
    applicantRole: 'Giáo viên',
    departmentId: 'DEPT_TOAN_TIN',
    departmentName: 'Tổ Toán - Tin',
    leaveType: 'BUSINESS',
    startDate: '2026-08-05',
    endDate: '2026-08-05',
    totalDays: 1,
    session: 'FULL_DAY',
    reason: 'Tham gia Lớp Tập huấn Chuyển đổi số & Ứng dụng AI trong Giảng dạy do Sở GD&ĐT tổ chức',
    notes: 'Học cả ngày tại Hội trường Sở GD&ĐT',
    proofFiles: [
      {
        id: 'FL_002',
        name: 'Cong_van_Tap_huan_So_GD.pdf',
        size: '850 KB',
        url: '#',
        type: 'application/pdf',
      }
    ],
    currentStepIndex: 2,
    steps: [
      {
        level: 'HEAD_OF_DEPT',
        levelLabel: 'Tổ trưởng chuyên môn',
        approverId: 'USR_003',
        approverName: 'Thầy Lê Hoàng Nam',
        status: 'APPROVED',
        comment: 'Đồng ý. Đã xác nhận thầy Tuấn đi công tác theo công văn Sở.',
        updatedAt: '2026-07-31 09:15',
      },
      {
        level: 'VICE_PRINCIPAL',
        levelLabel: 'Hiệu phó BGH',
        approverId: 'USR_002',
        approverName: 'ThS. Trần Thị Bích',
        status: 'APPROVED',
        comment: 'Kính trình Hiệu trưởng phê duyệt cử đi tập huấn.',
        updatedAt: '2026-07-31 10:20',
      },
      {
        level: 'PRINCIPAL',
        levelLabel: 'Hiệu trưởng',
        approverId: 'USR_001',
        approverName: 'TS. Nguyễn Văn An',
        status: 'APPROVED',
        comment: 'Duyệt công tác. Yêu cầu thầy Tuấn viết báo cáo hoạch định sau tập huấn.',
        updatedAt: '2026-07-31 14:00',
      }
    ],
    overallStatus: 'APPROVED',
    history: [
      {
        id: 'HIST_02_1',
        action: 'TẠO ĐƠN XIN NGHỈ',
        actorName: 'Thầy Đỗ Minh Tuấn',
        actorRole: 'Giáo viên',
        timestamp: '2026-07-31 08:00',
      },
      {
        id: 'HIST_02_2',
        action: 'TỔ TRƯỞNG DUYỆT',
        actorName: 'Thầy Lê Hoàng Nam',
        actorRole: 'Tổ trưởng chuyên môn',
        timestamp: '2026-07-31 09:15',
        note: 'Đồng ý cử đi tập huấn',
      },
      {
        id: 'HIST_02_3',
        action: 'HIỆU PHÓ DUYỆT',
        actorName: 'ThS. Trần Thị Bích',
        actorRole: 'Hiệu phó',
        timestamp: '2026-07-31 10:20',
      },
      {
        id: 'HIST_02_4',
        action: 'HIỆU TRƯỞNG PHÊ DUYỆT HOÀN TẤT',
        actorName: 'TS. Nguyễn Văn An',
        actorRole: 'Hiệu trưởng',
        timestamp: '2026-07-31 14:00',
        note: 'Đã thông qua',
      }
    ],
    createdAt: '2026-07-31 08:00',
    updatedAt: '2026-07-31 14:00',
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'TSK_2026_001',
    code: 'CV-2026-001',
    title: 'Rà soát & Hoàn thiện Kế hoạch Khai giảng & Bồi dưỡng Học sinh giỏi 2026-2027',
    description: 'Yêu cầu các Tổ trưởng lập danh sách học sinh tiêu biểu, phân công giáo viên phụ trách đội tuyển chuyên và gửi khung chương trình ôn tập về Ban BGH trước hạn.',
    assignerId: 'USR_001',
    assignerName: 'TS. Nguyễn Văn An (Hiệu trưởng)',
    assignerRole: 'Hiệu trưởng',
    assigneeType: 'DEPARTMENT',
    targetDepartmentId: 'DEPT_TOAN_TIN',
    targetDepartmentName: 'Tổ Toán - Tin',
    assignees: [
      {
        userId: 'USR_003',
        userName: 'Thầy Lê Hoàng Nam',
        departmentName: 'Tổ Toán - Tin',
        status: 'IN_PROGRESS',
        viewedAt: '2026-07-31 09:00',
      },
      {
        userId: 'USR_004',
        userName: 'Cô Phạm Thị Thu',
        departmentName: 'Tổ Toán - Tin',
        status: 'VIEWED',
        viewedAt: '2026-07-31 10:15',
      },
      {
        userId: 'USR_005',
        userName: 'Thầy Đỗ Minh Tuấn',
        departmentName: 'Tổ Toán - Tin',
        status: 'ASSIGNED',
      }
    ],
    attachments: [
      {
        id: 'ATT_1',
        name: 'Khung_Ke_Hoach_HSG_2026.docx',
        size: '2.4 MB',
        url: '#',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
    ],
    deadline: '2026-08-08 17:00',
    startDate: '2026-07-31 08:00',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    isConfidential: false,
    extensionRequests: [],
    activities: [
      {
        id: 'ACT_01',
        taskId: 'TSK_2026_001',
        actorId: 'USR_001',
        actorName: 'TS. Nguyễn Văn An',
        actorRole: 'Hiệu trưởng',
        action: 'CREATE',
        content: 'Phát hành chỉ đạo giao việc cho Tổ Toán - Tin.',
        timestamp: '2026-07-31 08:00',
      }
    ],
    createdAt: '2026-07-31 08:00',
    updatedAt: '2026-07-31 09:00',
  },
  {
    id: 'TSK_2026_002',
    code: 'CV-2026-002',
    title: 'Lập Báo cáo Dự toán Kinh phí Thiết bị Công nghệ cho Năm học Mới',
    description: 'Thực hiện kiểm kê máy tính phòng tin học, đề xuất bảo trì và lập kế hoạch mua sắm linh kiện thay thế trình BGH phê duyệt.',
    assignerId: 'USR_002',
    assignerName: 'ThS. Trần Thị Bích (Hiệu phó)',
    assignerRole: 'Hiệu phó',
    assigneeType: 'INDIVIDUAL',
    assignees: [
      {
        userId: 'USR_005',
        userName: 'Thầy Đỗ Minh Tuấn',
        departmentName: 'Tổ Toán - Tin',
        status: 'IN_PROGRESS',
        viewedAt: '2026-07-31 11:30',
        reportNotes: 'Đã hoàn thành kiểm kê 45 máy phòng LAB 1. Đang lập file excel kiểm kê LAB 2.',
        deliverableFiles: [],
      }
    ],
    attachments: [],
    deadline: '2026-08-04 16:00',
    startDate: '2026-07-31 10:00',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    isConfidential: false,
    extensionRequests: [],
    activities: [
      {
        id: 'ACT_02',
        taskId: 'TSK_2026_002',
        actorId: 'USR_002',
        actorName: 'ThS. Trần Thị Bích',
        actorRole: 'Hiệu phó',
        action: 'CREATE',
        content: 'Giao việc trực tiếp cho thầy Đỗ Minh Tuấn.',
        timestamp: '2026-07-31 10:00',
      }
    ],
    createdAt: '2026-07-31 10:00',
    updatedAt: '2026-07-31 11:30',
  },
  {
    id: 'TSK_2026_003',
    code: 'CV-2026-003',
    title: 'Tổng hợp Dự toán Thu Chi Phủ Kế hoạch Tài chính Đầu năm',
    description: 'Tổng hợp đề xuất ngân sách từ các tổ bộ môn và lập bảng tổng hợp dự toán tài chính gửi Hiệu trưởng.',
    assignerId: 'USR_001',
    assignerName: 'TS. Nguyễn Văn An',
    assignerRole: 'Hiệu trưởng',
    assigneeType: 'INDIVIDUAL',
    assignees: [
      {
        userId: 'USR_008',
        userName: 'Bà Trịnh Kim Oanh',
        departmentName: 'Tổ Hành Chính - Kế Toán',
        status: 'VIEWED',
        viewedAt: '2026-07-31 14:20',
        deliverableFiles: [],
      }
    ],
    attachments: [],
    deadline: '2026-08-10 17:00',
    startDate: '2026-07-31 14:00',
    priority: 'URGENT',
    status: 'VIEWED',
    isConfidential: true,
    extensionRequests: [],
    activities: [
      {
        id: 'ACT_03',
        taskId: 'TSK_2026_003',
        actorId: 'USR_001',
        actorName: 'TS. Nguyễn Văn An',
        actorRole: 'Hiệu trưởng',
        action: 'CREATE',
        content: 'Giao việc kế toán tài chính (Nội bộ Lãnh đạo/BGH).',
        timestamp: '2026-07-31 14:00',
      }
    ],
    createdAt: '2026-07-31 14:00',
    updatedAt: '2026-07-31 14:20',
  }
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'NOTIF_01',
    recipientUserId: 'USR_003',
    title: 'Đơn xin nghỉ phép mới',
    message: 'Cô Phạm Thị Thu đã gửi đơn xin nghỉ ốm 2 ngày (03/08 - 04/08). Cần Tổ trưởng duyệt.',
    type: 'LEAVE_REQUEST',
    isRead: false,
    createdAt: '2026-07-30 08:30',
  },
  {
    id: 'NOTIF_02',
    recipientUserId: 'USR_005',
    title: 'Công việc mới được giao',
    message: 'ThS. Trần Thị Bích đã giao công việc: "Lập Báo cáo Dự toán Kinh phí Thiết bị".',
    type: 'TASK_ASSIGNED',
    isRead: false,
    createdAt: '2026-07-31 10:00',
  }
];

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

  // Reset to initial demo state
  resetAllData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'users');
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'leaves');
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'tasks');
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'notifications');
    localStorage.removeItem(this.STORAGE_KEY_PREFIX + 'current_user_id');
  }
}

export const storage = new StorageService();
