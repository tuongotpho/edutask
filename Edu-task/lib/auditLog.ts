import { LeaveRequest } from '@/Edu-task/types/leave';
import { Task } from '@/Edu-task/types/task';

export type AuditSource = 'LEAVE' | 'TASK';

export interface AuditEntry {
  id: string;
  source: AuditSource;
  /** Human-facing code of the record, e.g. `ĐXN-2026-000123`. */
  recordCode: string;
  recordId: string;
  recordTitle: string;
  action: string;
  actorName: string;
  actorRole: string;
  note?: string;
  timestamp: string;
  /** Epoch ms for sorting; 0 when the stored timestamp could not be parsed. */
  sortKey: number;
}

/** Timestamps are stored as `YYYY-MM-DD HH:mm`, which is not ISO. */
function toSortKey(timestamp: string): number {
  if (!timestamp) return 0;
  const parsed = new Date(timestamp.trim().replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

/**
 * Flattens the per-record histories the app already keeps into one
 * chronological trail.
 *
 * `LeaveHistoryLog` and `TaskActivity` were only ever readable inside the record
 * they belong to, so there was no way to answer "what happened in the school
 * this week" — which is exactly what an administrative audit needs.
 */
export function buildAuditLog(leaves: LeaveRequest[], tasks: Task[]): AuditEntry[] {
  const entries: AuditEntry[] = [];

  for (const leave of leaves) {
    for (const log of leave.history ?? []) {
      entries.push({
        id: `LEAVE_${leave.id}_${log.id}`,
        source: 'LEAVE',
        recordCode: leave.code,
        recordId: leave.id,
        recordTitle: `Đơn nghỉ của ${leave.applicantName}`,
        action: log.action,
        actorName: log.actorName,
        actorRole: log.actorRole,
        note: log.note,
        timestamp: log.timestamp,
        sortKey: toSortKey(log.timestamp),
      });
    }
  }

  for (const task of tasks) {
    for (const activity of task.activities ?? []) {
      entries.push({
        id: `TASK_${task.id}_${activity.id}`,
        source: 'TASK',
        recordCode: task.code,
        recordId: task.id,
        recordTitle: task.title,
        action: ACTION_LABELS[activity.action] ?? activity.action,
        actorName: activity.actorName,
        actorRole: activity.actorRole,
        note: activity.content,
        timestamp: activity.timestamp,
        sortKey: toSortKey(activity.timestamp),
      });
    }
  }

  return entries.sort((a, b) => b.sortKey - a.sortKey);
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'PHÁT HÀNH CÔNG VIỆC',
  VIEW: 'ĐÃ XEM',
  PROGRESS_UPDATE: 'CẬP NHẬT TIẾN ĐỘ',
  SUBMIT_REPORT: 'NỘP BÁO CÁO',
  REQUEST_EXTENSION: 'XIN GIA HẠN',
  APPROVE_EXTENSION: 'DUYỆT GIA HẠN',
  REJECT_EXTENSION: 'TỪ CHỐI GIA HẠN',
  APPROVE_TASK: 'NGHIỆM THU HOÀN THÀNH',
  REJECT_TASK: 'YÊU CẦU LÀM LẠI',
  COMMENT: 'BÌNH LUẬN',
};

export interface AuditFilters {
  source?: AuditSource | 'ALL';
  search?: string;
  /** `YYYY-MM-DD` inclusive bounds. */
  from?: string;
  to?: string;
}

export function filterAuditLog(entries: AuditEntry[], filters: AuditFilters): AuditEntry[] {
  const term = filters.search?.trim().toLowerCase() ?? '';

  return entries.filter(entry => {
    if (filters.source && filters.source !== 'ALL' && entry.source !== filters.source) return false;

    if (term) {
      // Role is searchable too: "everything the Hiệu trưởng signed" is a normal
      // question to ask of an audit trail.
      const haystack = [entry.actorName, entry.actorRole, entry.action, entry.recordCode, entry.recordTitle, entry.note]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    // Timestamps start with the date, so a string compare is enough and avoids
    // timezone surprises.
    const date = entry.timestamp.slice(0, 10);
    if (filters.from && date < filters.from) return false;
    if (filters.to && date > filters.to) return false;

    return true;
  });
}

/** CSV for the office to archive; Excel-friendly with a BOM. */
export function auditLogToCsv(entries: AuditEntry[]): string {
  const escape = (value: string) => `"${(value ?? '').replace(/"/g, '""')}"`;
  const header = ['Thời gian', 'Loại', 'Mã hồ sơ', 'Hồ sơ', 'Hành động', 'Người thực hiện', 'Vai trò', 'Ghi chú'];
  const rows = entries.map(e => [
    e.timestamp,
    e.source === 'LEAVE' ? 'Đơn nghỉ' : 'Công việc',
    e.recordCode,
    e.recordTitle,
    e.action,
    e.actorName,
    e.actorRole,
    e.note ?? '',
  ].map(escape).join(','));

  return '﻿' + [header.map(escape).join(','), ...rows].join('\r\n');
}
