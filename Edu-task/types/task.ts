import { AttachmentFile } from './leave';

export type TaskPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

export const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; badgeBg: string }> = {
  URGENT: { label: 'Khẩn cấp', color: 'text-rose-700', badgeBg: 'bg-rose-100 text-rose-800 border-rose-300' },
  HIGH: { label: 'Ưu tiên cao', color: 'text-amber-700', badgeBg: 'bg-amber-100 text-amber-800 border-amber-300' },
  NORMAL: { label: 'Bình thường', color: 'text-blue-700', badgeBg: 'bg-blue-100 text-blue-800 border-blue-300' },
  LOW: { label: 'Thấp', color: 'text-slate-600', badgeBg: 'bg-slate-100 text-slate-700 border-slate-300' },
};

export type TaskStatus = 
  | 'ASSIGNED'          // Mới giao
  | 'VIEWED'            // Đã xem
  | 'IN_PROGRESS'       // Đang thực hiện
  | 'PENDING_APPROVAL'  // Chờ xác nhận
  | 'COMPLETED'         // Hoàn thành
  | 'OVERDUE';          // Quá hạn

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  ASSIGNED: { label: 'Mới giao', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
  VIEWED: { label: 'Đã xem', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  IN_PROGRESS: { label: 'Đang thực hiện', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  PENDING_APPROVAL: { label: 'Chờ duyệt hoàn thành', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  COMPLETED: { label: 'Hoàn thành', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  OVERDUE: { label: 'Quá hạn', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
};

export interface TaskAssigneeProgress {
  userId: string;
  userName: string;
  departmentName: string;
  avatarUrl?: string;
  status: TaskStatus;
  viewedAt?: string;
  completedAt?: string;
  reportNotes?: string;
  deliverableFiles?: AttachmentFile[];
}

export interface ExtensionRequest {
  id: string;
  requestedByUserId: string;
  requestedByUserName: string;
  currentDeadline: string;
  requestedDeadline: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  reviewComment?: string;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: 'CREATE' | 'VIEW' | 'PROGRESS_UPDATE' | 'SUBMIT_REPORT' | 'REQUEST_EXTENSION' | 'APPROVE_EXTENSION' | 'REJECT_EXTENSION' | 'APPROVE_TASK' | 'REJECT_TASK' | 'COMMENT';
  content: string;
  files?: AttachmentFile[];
  timestamp: string;
}

export interface Task {
  id: string;
  code: string; // e.g., CV-2026-089
  title: string;
  description: string;
  
  assignerId: string;
  assignerName: string;
  assignerRole: string;
  
  assigneeType: 'INDIVIDUAL' | 'MULTIPLE' | 'DEPARTMENT';
  targetDepartmentId?: string;
  targetDepartmentName?: string;
  
  assignees: TaskAssigneeProgress[];
  
  attachments: AttachmentFile[];
  deadline: string; // YYYY-MM-DD HH:mm
  startDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  
  isConfidential: boolean; // Công việc nội bộ BGH / Lãnh đạo
  
  extensionRequests: ExtensionRequest[];
  activities: TaskActivity[];
  
  createdAt: string;
  updatedAt: string;
}
