'use client';

import React from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { BarChart3, PieChart, TrendingUp, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export function AnalyticsTab() {
  const { leaves, tasks, users } = useApp();

  const totalLeaves = leaves.length;
  const totalApprovedLeaves = leaves.filter(l => l.overallStatus === 'APPROVED').length;
  const totalLeaveDays = leaves.reduce((acc, curr) => acc + curr.totalDays, 0);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'VIEWED' || t.status === 'ASSIGNED').length;
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
          {[
            { name: 'Tổ Toán - Tin', count: 4, percent: 80 },
            { name: 'Tổ Ngữ Văn - Lịch Sử', count: 2, percent: 50 },
            { name: 'Tổ Hành Chính - Kế Toán', count: 2, percent: 50 },
            { name: 'Tổ Ngoại Ngữ', count: 1, percent: 30 },
            { name: 'Tổ Lý - Hóa - Sinh', count: 1, percent: 30 },
          ].map(item => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span>{item.name}</span>
                <span>{item.count} nhiệm vụ</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${item.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
