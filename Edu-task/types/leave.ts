import { RoleType } from './user';

export type LeaveType = 'PAID' | 'SICK' | 'PERSONAL' | 'BUSINESS' | 'OTHER';

export const LEAVE_TYPE_LABELS: Record<LeaveType, { label: string; color: string; bg: string }> = {
  PAID: { label: 'Nghỉ phép năm', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  SICK: { label: 'Nghỉ ốm / Bản thân & Con', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  PERSONAL: { label: 'Nghỉ việc riêng (Kết hôn, Tang...)', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  BUSINESS: { label: 'Nghỉ công tác / Tập huấn', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  OTHER: { label: 'Nghỉ khác', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
};

export type LeaveSession = 'FULL_DAY' | 'MORNING' | 'AFTERNOON';

export const LEAVE_SESSION_LABELS: Record<LeaveSession, string> = {
  FULL_DAY: 'Cả ngày',
  MORNING: 'Buổi sáng',
  AFTERNOON: 'Buổi chiều',
};

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUEST_EDIT';

export interface ApprovalStep {
  level: RoleType; // e.g. HEAD_OF_DEPT | VICE_PRINCIPAL | PRINCIPAL
  levelLabel: string;
  approverId?: string;
  approverName?: string;
  status: ApprovalStatus;
  comment?: string;
  updatedAt?: string;
}

export interface LeaveHistoryLog {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  note?: string;
}

export interface AttachmentFile {
  id: string;
  name: string;
  size: string;
  url: string;
  type: string;
  /**
   * Full object path inside the storage bucket (e.g. `leaves/LV_1/abc.pdf`).
   * The download URL carries a token and cannot be turned back into a path, so
   * without this the object could never be deleted.
   */
  storagePath?: string;
  uploadedById?: string;
  uploadedByName?: string;
  uploadedAt?: string;
}

export interface LeaveRequest {
  id: string;
  code: string; // e.g., ĐXN-2026-001
  applicantId: string;
  applicantName: string;
  applicantRole: string;
  departmentId: string;
  departmentName: string;
  
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalDays: number;
  session: LeaveSession;
  
  reason: string;
  notes?: string;
  
  substituteTeacherId?: string;
  substituteTeacherName?: string;
  substituteStatus?: 'CONFIRMED' | 'PENDING' | 'DECLINED';
  
  proofFiles: AttachmentFile[];
  
  currentStepIndex: number; // 0: Dept, 1: Vice Principal, 2: Principal
  steps: ApprovalStep[];
  overallStatus: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'REQUEST_EDIT' | 'CANCELLED';
  
  history: LeaveHistoryLog[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRule {
  id: string;
  leaveType: LeaveType;
  maxDaysAutoApproveByDept: number; // e.g., if leave <= 1 day, only HOD approval required
  requiredSteps: RoleType[];
}
