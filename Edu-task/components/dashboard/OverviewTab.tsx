/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
'use client';

import React from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { canAssignTask, canViewLeave, isDeptLeader, isSchoolLeadership } from '@/Edu-task/lib/permissions';
import {
  FileText, 
  CheckSquare, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  PlusCircle, 
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  CalendarDays,
  Sparkles,
  TrendingUp,
  Activity
} from 'lucide-react';
import { MissionControl } from './MissionControl';
import { DueSoonPanel } from '@/Edu-task/components/plan/DueSoonPanel';
import { TabType } from '@/Edu-task/components/layout/Sidebar';

interface OverviewTabProps {
  onRequestNewLeave: () => void;
  onRequestNewTask: () => void;
  onGoToTab: (tab: TabType) => void;
}

/** Returns a Vietnamese greeting based on the current hour. */
function greetingByTime(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export function OverviewTab({
  onRequestNewLeave,
  onRequestNewTask,
  onGoToTab
}: OverviewTabProps) {
  const { currentUser, activeRole, leaves, tasks } = useApp();

  const isSchoolLeadershipOrAdmin = isSchoolLeadership(currentUser, activeRole);
  const isDeptHeader = isDeptLeader(currentUser, activeRole);
  const visibleLeaves = leaves.filter(l => canViewLeave(currentUser, activeRole, l));

  const visibleTasks = (isSchoolLeadershipOrAdmin || isDeptHeader)
    ? tasks
    : tasks.filter(t => t.assignees?.some(a => a.userId === currentUser?.id) || t.assignerId === currentUser?.id);

  const pendingLeaves = visibleLeaves.filter(l => l.overallStatus === 'IN_REVIEW');
  const activeTasks = visibleTasks.filter(t => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS' || t.status === 'PENDING_APPROVAL');
  const completedTasks = visibleTasks.filter(t => t.status === 'COMPLETED');
  const totalTasks = visibleTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  // Teachers currently on approved leave today
  const todayStr = new Date().toISOString().split('T')[0];
  const teachersOnLeaveToday = visibleLeaves.filter(l => 
    l.overallStatus === 'APPROVED' && 
    l.startDate <= todayStr && 
    l.endDate >= todayStr
  );

  return (
    <div className="space-y-6">

      {/* Mission Control (Leadership) or DueSoonPanel (Staff) */}
      {isSchoolLeadershipOrAdmin
        ? <MissionControl onNavigate={onGoToTab} />
        : <DueSoonPanel personalOnly />}

      {/* Top Welcome Banner (Staff / Non-Leadership View) */}
      {!isSchoolLeadershipOrAdmin && (
        <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[5px] p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
          
          <div className="space-y-3 z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vai trò hiện tại: {activeRole}</span>
            </div>
            
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <span>{greetingByTime()}, {currentUser?.fullName}!</span>
            </h2>
            
            <p className="text-slate-300/90 text-xs md:text-sm leading-relaxed">
              Hệ thống EduTask tự động kết nối luồng xin nghỉ phép và giao việc toàn trường, giúp giảm bớt thao tác giấy tờ và minh bạch tiến độ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 z-10">
            <button
              onClick={onRequestNewLeave}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md hover:shadow-indigo-500/20 transition-all duration-200 flex items-center space-x-2 active:scale-98"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tạo Đơn Xin Nghỉ</span>
            </button>
            
            {canAssignTask(currentUser, activeRole) && (
              <button
                onClick={onRequestNewTask}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md hover:shadow-emerald-500/20 transition-all duration-200 flex items-center space-x-2 active:scale-98"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Phát Hành Giao Việc</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Teacher Availability Alert Ticker (Leadership/Management Only) */}
      {(isSchoolLeadershipOrAdmin || isDeptHeader) && teachersOnLeaveToday.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="relative w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold flex-shrink-0 border border-amber-200">
              <CalendarDays className="w-4.5 h-4.5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500">
                <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 flex items-center gap-2">
                <span>Thông Báo Lịch Nghỉ Hôm Nay ({todayStr})</span>
              </div>
              <div className="text-xs text-amber-800/90 mt-0.5">
                Có {teachersOnLeaveToday.length} giáo viên đang nghỉ phép: {teachersOnLeaveToday.map(l => `${l.applicantName} (${l.departmentName})`).join(', ')}.
              </div>
            </div>
          </div>
          
          <button
            onClick={() => onGoToTab('schedule')}
            className="text-xs font-bold text-amber-900 hover:text-amber-700 flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-100/80 hover:bg-amber-200/80 transition-all border border-amber-200/60 flex-shrink-0"
          >
            <span>Xem lịch</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metric Cards Grid (Staff / Non-Leadership View) */}
      {!isSchoolLeadershipOrAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Pending Leaves Card */}
          <button
            type="button"
            onClick={() => onGoToTab('leave')}
            className="group bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-amber-300 cursor-pointer transition-all duration-200 text-left hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/70 flex items-center justify-center font-bold shadow-2xs group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                {pendingLeaves.length > 0 && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                )}
              </div>

              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{pendingLeaves.length}</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">Đơn Xin Nghỉ Chờ Duyệt</div>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                <span className="text-[11px] text-slate-500">
                  {(isSchoolLeadershipOrAdmin || isDeptHeader) ? 'Cần BGH & Tổ trưởng xử lý' : 'Đơn đang được duyệt'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </button>

          {/* Active Tasks Card */}
          <button
            type="button"
            onClick={() => onGoToTab('task')}
            className="group bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-indigo-300 cursor-pointer transition-all duration-200 text-left hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/70 flex items-center justify-center font-bold shadow-2xs group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                {activeTasks.length > 0 && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
                  </span>
                )}
              </div>

              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{activeTasks.length}</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">Công Việc Đang Thực Hiện</div>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                <span className="text-[11px] text-slate-500">Nhiệm vụ đang triển khai</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </button>

          {/* Completed Tasks Card */}
          <button
            type="button"
            onClick={() => onGoToTab('task')}
            className="group bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-emerald-300 cursor-pointer transition-all duration-200 text-left hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center justify-center font-bold shadow-2xs group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                {completedTasks.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                    {completionRate}%
                  </span>
                )}
              </div>

              <div>
                <div className="text-3xl font-extrabold text-emerald-800 tracking-tight">{completedTasks.length}</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">Công Việc Hoàn Thành</div>
              </div>

              {/* Progress bar */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Tiến độ tổng thể</span>
                  <span className="font-bold text-emerald-700">{completedTasks.length}/{totalTasks}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>
            </div>
          </button>

          {/* Schedule / Leave Overview Card */}
          <button
            type="button"
            onClick={() => onGoToTab('schedule')}
            className="group bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-violet-300 cursor-pointer transition-all duration-200 text-left hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 border border-violet-200/70 flex items-center justify-center font-bold shadow-2xs group-hover:scale-105 transition-transform">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <Activity className="w-4 h-4 text-violet-400" />
              </div>

              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {(isSchoolLeadershipOrAdmin || isDeptHeader) ? teachersOnLeaveToday.length : visibleLeaves.length}
                </div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                  {(isSchoolLeadershipOrAdmin || isDeptHeader) ? 'Tránh Giao Trùng Lịch' : 'Lịch Nghỉ Cá Nhân'}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                <span className="text-[11px] text-slate-500">
                  {(isSchoolLeadershipOrAdmin || isDeptHeader) ? 'GV đang trong kỳ nghỉ' : 'Tổng số đơn nghỉ'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </button>

        </div>
      )}

    </div>
  );
}
