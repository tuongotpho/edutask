'use client';

import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { LeaveRequest, LEAVE_TYPE_LABELS, LEAVE_SESSION_LABELS, LeaveType } from '@/Edu-task/types/leave';
import { 
  FileText, 
  Search, 
  Filter, 
  PlusCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  AlertCircle,
  Building2
} from 'lucide-react';

interface LeaveTabProps {
  onRequestNewLeave: () => void;
  onSelectLeave: (leaveId: string) => void;
  searchTerm?: string;
}

export function LeaveTab({ onRequestNewLeave, onSelectLeave, searchTerm = '' }: LeaveTabProps) {
  const { leaves, currentUser, activeRole } = useApp();

  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Filter logic
  const filteredLeaves = leaves.filter(leave => {
    const term = localSearch.toLowerCase();
    const matchesSearch = 
      leave.applicantName.toLowerCase().includes(term) ||
      leave.reason.toLowerCase().includes(term) ||
      leave.code.toLowerCase().includes(term);

    const matchesDept = selectedDept === 'ALL' || leave.departmentId === selectedDept;
    const matchesType = selectedType === 'ALL' || leave.leaveType === selectedType;
    const matchesStatus = selectedStatus === 'ALL' || leave.overallStatus === selectedStatus;

    return matchesSearch && matchesDept && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">

      {/* Header & Filter Controls */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Quản Lý Đơn Xin Nghỉ Phép & Công Tác
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Quy trình phê duyệt tự động 3 cấp: Tổ trưởng → Hiệu phó → Hiệu trưởng
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
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 font-medium"
          >
            <option value="ALL">-- Tất cả Tổ chuyên môn --</option>
            <option value="DEPT_TOAN_TIN">Tổ Toán - Tin</option>
            <option value="DEPT_VAN_SU">Tổ Ngữ Văn - Lịch Sử</option>
            <option value="DEPT_ANH">Tổ Ngoại Ngữ</option>
            <option value="DEPT_LY_HOA_SINH">Tổ Lý - Hóa - Sinh</option>
            <option value="DEPT_HANH_CHINH">Tổ Hành Chính - Kế Toán</option>
          </select>

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
          </select>
        </div>
      </div>

      {/* Leave Requests Table Card List */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            Danh Sách Đơn Xin Nghỉ ({filteredLeaves.length} đơn)
          </span>
          <span className="text-[11px] text-slate-500">Nhấp vào dòng để xem chi tiết & phê duyệt</span>
        </div>

        {filteredLeaves.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-sm text-slate-700">Không tìm thấy đơn xin nghỉ nào</p>
            <p className="text-xs text-slate-400">Thử thay đổi bộ lọc hoặc tạo đơn mới</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {filteredLeaves.map((leave) => (
              <div
                key={leave.id}
                onClick={() => onSelectLeave(leave.id)}
                className="p-5 hover:bg-slate-50/80 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Applicant & Reason */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {leave.code}
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm">{leave.applicantName}</span>
                    <span className="text-[11px] text-slate-500">• {leave.departmentName}</span>
                  </div>

                  <p className="text-slate-700 font-medium line-clamp-2 max-w-2xl">
                    {leave.reason}
                  </p>

                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 pt-1">
                    <span>Thời gian: <strong className="text-slate-800">{leave.startDate} → {leave.endDate}</strong> ({leave.totalDays} ngày - {LEAVE_SESSION_LABELS[leave.session]})</span>
                    {leave.substituteTeacherName && (
                      <span className="text-indigo-600 font-semibold">• Dạy thay: {leave.substituteTeacherName}</span>
                    )}
                  </div>
                </div>

                {/* Right: Workflow Progress & Status */}
                <div className="flex flex-col md:items-end space-y-2 flex-shrink-0">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${LEAVE_TYPE_LABELS[leave.leaveType].bg}`}>
                    {LEAVE_TYPE_LABELS[leave.leaveType].label}
                  </div>

                  {/* Step status */}
                  <div className="flex items-center space-x-1 text-[11px]">
                    <span className="text-slate-400 font-semibold">Bước duyệt:</span>
                    <span className="font-bold text-slate-800">
                      {leave.overallStatus === 'APPROVED' ? 'Đã hoàn tất (3/3)' : `Bước ${leave.currentStepIndex + 1}/3 (${leave.steps[leave.currentStepIndex]?.levelLabel})`}
                    </span>
                  </div>

                  <span className={`text-[11px] font-bold ${
                    leave.overallStatus === 'APPROVED' ? 'text-emerald-600' :
                    leave.overallStatus === 'REJECTED' ? 'text-rose-600' :
                    leave.overallStatus === 'REQUEST_EDIT' ? 'text-amber-600' : 'text-indigo-600'
                  }`}>
                    ● Trạng thái: {leave.overallStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
