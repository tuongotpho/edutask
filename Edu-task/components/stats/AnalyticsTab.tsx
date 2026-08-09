'use client';

import React, { useMemo } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { BarChart3, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { canViewStats } from '@/Edu-task/lib/permissions';
import { isTaskOverdue } from '@/Edu-task/lib/taskStatus';
import {
  departmentStats,
  monthlyLeaveTrend,
  onTimeCompletionRate,
  topWorkloads,
} from '@/Edu-task/lib/analytics';

function StatCard({ label, value, sub, tone = 'slate' }: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: 'slate' | 'indigo' | 'amber' | 'emerald' | 'rose';
}) {
  const valueTone = {
    slate: 'text-slate-900',
    indigo: 'text-indigo-600',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
  }[tone];

  return (
    <div className="bg-white p-5 rounded-[5px] border border-slate-200 shadow-xs space-y-1.5">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <div className={`text-3xl font-extrabold ${valueTone}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function AnalyticsTab() {
  const { leaves, tasks, departments, users, currentUser, activeRole } = useApp();

  const allowed = canViewStats(currentUser, activeRole);

  // Hooks must run unconditionally, so compute before the permission gate.
  const trend = useMemo(() => monthlyLeaveTrend(leaves, 6), [leaves]);
  const deptStats = useMemo(
    () => departmentStats(departments, tasks, leaves),
    [departments, tasks, leaves]
  );
  const workloads = useMemo(() => topWorkloads(tasks, 5), [tasks]);
  const onTimeRate = useMemo(() => onTimeCompletionRate(tasks), [tasks]);

  if (!allowed) {
    return (
      <div className="p-8 bg-white rounded-[5px] border border-slate-200 text-center space-y-3 shadow-sm my-6">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-bold text-xl">
          🚫
        </div>
        <h3 className="text-base font-bold text-slate-900">Truy Cập Báo Cáo Bị Từ Chối</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Tính năng Báo cáo &amp; Thống kê toàn trường chỉ dành cho Ban Giám Hiệu, Tổ trưởng &amp; Nhóm trưởng chuyên môn.
        </p>
      </div>
    );
  }

  const totalLeaves = leaves.length;
  const approvedLeaves = leaves.filter(l => l.overallStatus === 'APPROVED').length;
  const pendingLeaves = leaves.filter(l => l.overallStatus === 'IN_REVIEW').length;
  const totalLeaveDays = leaves
    .filter(l => l.overallStatus === 'APPROVED')
    .reduce((acc, l) => acc + (l.totalDays ?? 0), 0);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const overdueTasks = tasks.filter(t => isTaskOverdue(t)).length;
  const pendingApprovalTasks = tasks.filter(t => t.status === 'PENDING_APPROVAL').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const unassignedSubstitute = leaves.filter(
    l => l.overallStatus === 'APPROVED' && !l.substituteTeacherId
  ).length;

  const maxTrend = Math.max(...trend.map(p => p.leaveDays), 1);
  const activeStaff = users.filter(u => u.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">

      <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-2">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          Thống Kê Báo Cáo Hiệu Quả Quản Lý
        </h2>
        <p className="text-xs text-slate-500">
          Tổng hợp dữ liệu xin nghỉ và hoàn thành chỉ đạo công việc phục vụ báo cáo Sở GD&amp;ĐT.
          Số liệu tính trên phạm vi dữ liệu bạn được phép xem.
        </p>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Đơn xin nghỉ"
          value={`${totalLeaves}`}
          sub={<>{approvedLeaves} đã duyệt · <strong className="text-amber-600">{pendingLeaves} chờ duyệt</strong></>}
        />
        <StatCard
          label="Tổng ngày nghỉ đã duyệt"
          value={`${totalLeaveDays}`}
          tone="indigo"
          sub={activeStaff > 0 ? `Trung bình ${(totalLeaveDays / activeStaff).toFixed(1)} ngày/người` : undefined}
        />
        <StatCard
          label="Tỷ lệ hoàn thành việc"
          value={`${completionRate}%`}
          tone="emerald"
          sub={
            <>
              {completedTasks}/{totalTasks} việc ·{' '}
              {onTimeRate === null ? 'chưa có dữ liệu đúng hạn' : <>{onTimeRate}% đúng hạn</>}
            </>
          }
        />
        <StatCard
          label="Việc quá hạn"
          value={`${overdueTasks}`}
          tone={overdueTasks > 0 ? 'rose' : 'slate'}
          sub={`${pendingApprovalTasks} việc chờ nghiệm thu`}
        />
      </div>

      {/* Operational warning that needs action, not just observation. */}
      {unassignedSubstitute > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold text-rose-900">
              {unassignedSubstitute} đơn nghỉ đã duyệt nhưng CHƯA phân công giáo viên dạy thay
            </div>
            <p className="text-rose-700 mt-0.5">
              Cần xử lý sớm để tránh trống tiết. Xem chi tiết ở tab Đơn Xin Nghỉ.
            </p>
          </div>
        </div>
      )}

      {/* Leave trend */}
      <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          Xu Hướng Nghỉ Phép 6 Tháng Gần Nhất
        </h3>
        <div className="flex items-end justify-between gap-2 h-40 pt-2">
          {trend.map(point => {
            const heightPercent = Math.round((point.leaveDays / maxTrend) * 100);
            return (
              <div key={point.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[10px] font-bold text-slate-700">{point.leaveDays || ''}</span>
                <div
                  className="w-full bg-indigo-500 rounded-t-lg transition-all min-h-[2px]"
                  style={{ height: `${heightPercent}%` }}
                  title={`${point.leaveCount} đơn · ${point.leaveDays} ngày`}
                />
                <span className="text-[10px] font-semibold text-slate-500">{point.label}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 text-center">Số ngày nghỉ theo tháng (không tính đơn đã hủy / bị từ chối)</p>
      </div>

      {/* Department breakdown */}
      <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Hiệu Quả Theo Tổ Bộ Môn</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-3 font-bold text-slate-700">Tổ chuyên môn</th>
                <th className="p-3 font-bold text-slate-700 text-center">Việc được giao</th>
                <th className="p-3 font-bold text-slate-700 text-center">Hoàn thành</th>
                <th className="p-3 font-bold text-slate-700 text-center">Quá hạn</th>
                <th className="p-3 font-bold text-slate-700 text-center">Ngày nghỉ</th>
                <th className="p-3 font-bold text-slate-700 w-32">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deptStats.map(stat => (
                <tr key={stat.departmentId} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{stat.departmentName}</td>
                  <td className="p-3 text-center text-slate-700">{stat.totalTasks}</td>
                  <td className="p-3 text-center text-emerald-700 font-semibold">{stat.completedTasks}</td>
                  <td className={`p-3 text-center font-semibold ${stat.overdueTasks > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {stat.overdueTasks}
                  </td>
                  <td className="p-3 text-center text-slate-700">{stat.leaveDays}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all"
                          style={{ width: `${stat.completionRate}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-700 w-9 text-right">{stat.completionRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workload distribution */}
      <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-600" />
          Nhân Sự Đang Gánh Nhiều Việc Nhất
        </h3>
        {workloads.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Hiện không có công việc nào đang mở.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {workloads.map(entry => (
              <li key={entry.userId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800">{entry.userName}</span>
                <span className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                    {entry.activeTasks} việc đang mở
                  </span>
                  {entry.overdueTasks > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                      {entry.overdueTasks} quá hạn
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
