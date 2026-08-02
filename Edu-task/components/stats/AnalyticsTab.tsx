'use client';

import React from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { BarChart3 } from 'lucide-react';
import { canViewStats } from '@/Edu-task/lib/permissions';

export function AnalyticsTab() {
  const { leaves, tasks, departments, currentUser, activeRole } = useApp();

  if (!canViewStats(currentUser, activeRole)) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm my-6">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-bold text-xl">
          🚫
        </div>
        <h3 className="text-base font-bold text-slate-900">Truy Cập Báo Cáo Bị Từ Chối</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Tính năng Báo cáo & Thống kê toàn trường chỉ dành cho Ban Giám Hiệu, Tổ trưởng & Nhóm trưởng chuyên môn.
        </p>
      </div>
    );
  }

  const totalLeaves = leaves.length;
  const totalApprovedLeaves = leaves.filter(l => l.overallStatus === 'APPROVED').length;
  const totalLeaveDays = leaves.reduce((acc, curr) => acc + curr.totalDays, 0);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const pendingApprovalTasks = tasks.filter(t => t.status === 'PENDING_APPROVAL').length;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-2">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          Thống Kê Báo Cáo Hiệu Quả Quản Lý
        </h2>
        <p className="text-xs text-slate-500">
          Tổng hợp dữ liệu xin nghỉ và hoàn thành chỉ đạo công việc phục vụ báo cáo Sở GD&ĐT
        </p>
      </div>

      {/* High level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Đơn Xin Nghỉ</span>
          <div className="text-3xl font-extrabold text-slate-900">{totalLeaves} đơn</div>
          <div className="text-xs text-emerald-600 font-semibold">{totalApprovedLeaves} đơn đã duyệt ({totalLeaveDays} ngày nghỉ)</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tỷ Lệ Hoàn Thành Công Việc</span>
          <div className="text-3xl font-extrabold text-indigo-600">{completionRate}%</div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Công Việc Đang Chờ Nghiệm Thu</span>
          <div className="text-3xl font-extrabold text-amber-600">{pendingApprovalTasks}</div>
          <div className="text-xs text-amber-700">Cần BGH / Lãnh đạo đánh giá</div>
        </div>
      </div>

      {/* Department Breakdown Bar Visuals */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Thống Kê Khối Lượng Công Việc Theo Tổ Bộ Môn</h3>
        <div className="space-y-3 text-xs">
          {departments.map(dept => {
            const deptTasksCount = tasks.filter(t => t.targetDepartmentId === dept.id).length;
            const maxTasksCount = Math.max(...departments.map(d => tasks.filter(t => t.targetDepartmentId === d.id).length), 1);
            const percent = Math.round((deptTasksCount / maxTasksCount) * 100) || 10;
            return (
              <div key={dept.id} className="space-y-1">
                <div className="flex items-center justify-between font-semibold text-slate-800">
                  <span>{dept.name}</span>
                  <span>{deptTasksCount} nhiệm vụ</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
