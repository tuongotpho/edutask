/**
 * Module Bồi dưỡng Học sinh giỏi (HSG)
 */

export type GiftedProgramStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export const GIFTED_PROGRAM_STATUS_LABELS: Record<GiftedProgramStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Dự thảo', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
  IN_PROGRESS: { label: 'Đang triển khai', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
  COMPLETED: { label: 'Hoàn thành', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  ARCHIVED: { label: 'Lưu trữ', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
};

export type GiftedLessonStatus = 'PENDING' | 'COMPLETED';

export const GIFTED_LESSON_STATUS_LABELS: Record<GiftedLessonStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Chưa học', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  COMPLETED: { label: 'Đã hoàn thành', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
};

export interface GiftedLesson {
  id: string;
  order: number;
  title: string; // Tên tiết / chuyên đề
  teacherId: string; // Người dạy
  teacherName: string;
  scheduledDate?: string; // YYYY-MM-DD
  durationPeriods?: number; // Số tiết (mặc định 1 hoặc 2)
  roomName?: string; // Địa điểm / Phòng học
  description?: string;
  status: GiftedLessonStatus;
  completedAt?: string;
  completedByUserId?: string;
  completedByUserName?: string;
  note?: string; // Ghi chú / Đánh giá sau tiết học
}

export interface GiftedProgram {
  id: string;
  schoolId: string;
  code: string; // e.g. BD-2026-001
  title: string; // e.g. Bồi dưỡng HSG Toán 9 - Đội tuyển Trường
  subject: string; // Môn học (e.g. Toán, Vật lý, Ngữ văn)
  grade?: string; // Khối (e.g. Khối 9)
  description?: string;
  
  departmentId?: string;
  departmentName?: string;
  
  coordinatorId: string; // Người phụ trách / Chủ nhiệm đội tuyển
  coordinatorName: string;
  
  lessons: GiftedLesson[]; // Danh sách các tiết / chuyên đề
  
  status: GiftedProgramStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  
  createdAt: string;
  updatedAt: string;
}
