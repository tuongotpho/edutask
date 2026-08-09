'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { LEAVE_TYPE_LABELS, LEAVE_SESSION_LABELS, LeaveType } from '@/Edu-task/types/leave';
import { canViewLeave, isSchoolLeadership } from '@/Edu-task/lib/permissions';
import { matchesSearch } from '@/Edu-task/lib/utils';
import {
  FileText,
  Search,
  PlusCircle
} from 'lucide-react';
import { StatusRow } from '@/Edu-task/components/common/StatusRow';
import { EmptyState } from '@/Edu-task/components/common/Card';
import { leaveTone } from '@/Edu-task/lib/statusTone';

/**
 * Wording for the status badge.
 *
 * Phrased as what it means to the reader, not as the enum: "Chờ duyệt" rather
 * than "IN_REVIEW". Kept beside the list that shows it so the two cannot drift.
 */
const LEAVE_STATUS_TEXT: Record<string, string> = {
  IN_REVIEW: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  REQUEST_EDIT: 'Yêu cầu sửa',
  CANCELLED: 'Đã hủy',
};

interface LeaveTabProps {
  onRequestNewLeave: () => void;
  onSelectLeave: (leaveId: string) => void;
}

export function LeaveTab({ onRequestNewLeave, onSelectLeave }: LeaveTabProps) {
  const { leaves, departments, currentUser, activeRole } = useApp();

  const [localSearch, setLocalSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const isSchoolLeadershipOrAdmin = isSchoolLeadership(currentUser, activeRole);

  // Filter leaves based on user role & department permission scope
  const visibleLeaves = leaves.filter(leave => canViewLeave(currentUser, activeRole, leave));

  // Filter logic. Diacritics-insensitive and matched against applicant,
  // reason, code, substitute teacher, and department so any of those fields
  // can be searched from this tab.
  const filteredLeaves = useMemo(() => visibleLeaves.filter(leave => {
    const isSearchMatch = matchesSearch(
      localSearch,
      leave.applicantName,
      leave.reason,
      leave.code,
      leave.substituteTeacherName,
      leave.departmentName
    );

    const matchesDept = selectedDept === 'ALL' || leave.departmentId === selectedDept;
    const matchesType = selectedType === 'ALL' || leave.leaveType === selectedType;
    const matchesStatus = selectedStatus === 'ALL' || leave.overallStatus === selectedStatus;

    return isSearchMatch && matchesDept && matchesType && matchesStatus;
  }), [visibleLeaves, localSearch, selectedDept, selectedType, selectedStatus]);

  return (
    <div className="space-y-6">

      {/* Header & Filter Controls */}
      <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Quản Lý Đơn Xin Nghỉ Phép &amp; Công Tác
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Quy trình phê duyệt 2 cấp: Nhóm/Tổ trưởng chuyên môn → Ban Giám Hiệu
            </p>
          </div>

          <button
            onClick={onRequestNewLeave}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center justify-center space-x-2 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tạo Đơn Xin Nghỉ</span>
          </button>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Tìm tên, lý do, mã đơn..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Department Filter */}
          {isSchoolLeadershipOrAdmin ? (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 font-medium"
            >
              <option value="ALL">-- Tất cả Tổ chuyên môn --</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          ) : (
            <div className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 font-semibold flex items-center justify-between">
              <span>{currentUser?.departmentName || 'Tổ Chuyên Môn'}</span>
              <span className="text-[10px] text-slate-400 font-normal">Tổ của tôi</span>
            </div>
          )}

          {/* Leave Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 font-medium"
          >
            <option value="ALL">-- Tất cả loại nghỉ --</option>
            {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map(t => (
              <option key={t} value={t}>{LEAVE_TYPE_LABELS[t].label}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 font-medium"
          >
            <option value="ALL">-- Tất cả trạng thái --</option>
            <option value="IN_REVIEW">Đang trình duyệt</option>
            <option value="APPROVED">Đã phê duyệt hoàn tất</option>
            <option value="REJECTED">Từ chối</option>
            <option value="REQUEST_EDIT">Yêu cầu sửa</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Leave list */}
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
          Danh Sách Đơn Xin Nghỉ ({filteredLeaves.length} đơn)
        </span>
        <span className="text-[11px] text-slate-500">Nhấp vào dòng để xem chi tiết &amp; phê duyệt</span>
      </div>

      {filteredLeaves.length === 0 ? (
        <EmptyState
          icon={FileText}
          message="Không tìm thấy đơn xin nghỉ nào"
          hint="Thử thay đổi bộ lọc hoặc tạo đơn mới"
        />
      ) : (
        <div className="space-y-2">
          {filteredLeaves.map(leave => (
            <StatusRow
              key={leave.id}
              tone={leaveTone(leave.overallStatus)}
              statusLabel={LEAVE_STATUS_TEXT[leave.overallStatus] ?? leave.overallStatus}
              personName={leave.applicantName}
              title={leave.applicantName}
              titleMeta={leave.departmentName}
              onClick={() => onSelectLeave(leave.id)}
              trailing={
                // Derived from the request's own steps: the count was hardcoded
                // to 3 while the workflow only ever creates 2, so a fully
                // approved request read "Bước 2/3".
                leave.overallStatus === 'APPROVED'
                  ? `Hoàn tất ${leave.steps.length}/${leave.steps.length}`
                  : `Bước ${leave.currentStepIndex + 1}/${leave.steps.length}`
              }
              detail={
                <>
                  <span className="font-semibold text-slate-700">
                    {LEAVE_TYPE_LABELS[leave.leaveType].label}
                  </span>
                  {' · '}
                  {leave.startDate} → {leave.endDate}
                  {' · '}
                  {leave.totalDays} ngày ({LEAVE_SESSION_LABELS[leave.session]})
                  {leave.substituteTeacherName && (
                    <span className="text-indigo-600 font-semibold">
                      {' · '}Dạy thay: {leave.substituteTeacherName}
                    </span>
                  )}
                  <span className="block text-slate-500 mt-0.5 line-clamp-1">{leave.reason}</span>
                </>
              }
            />
          ))}
        </div>
      )}

    </div>
  );
}
