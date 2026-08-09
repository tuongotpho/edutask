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
  TrendingUp
} from 'lucide-react';
import { MissionControl } from './MissionControl';
import { DueSoonPanel } from '@/Edu-task/components/plan/DueSoonPanel';
import { TabType } from '@/Edu-task/components/layout/Sidebar';

/**
 * The overview carries totals only.
 *
 * It used to end with two lists of individual leave requests and tasks. Those
 * are gone: every figure they summarised is now a tile above, and the detail
 * they showed lives in its own tab in the sidebar. Repeating it here made the
 * page long and gave the same number two homes — so a reader had to work out
 * which one to believe.
 */
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

      {/* The operations screen leads for people who run the school; everyone
          else gets their own due list instead, which is what they actually
          need on opening the app. */}
      {isSchoolLeadershipOrAdmin
        ? <MissionControl onNavigate={onGoToTab} />
        : <DueSoonPanel personalOnly />}

      {/* Top Welcome Banner.
          Hidden once Mission Control is on screen: it explains what EduTask is
          to someone who runs the school and opens it every day, and its two
          buttons are the same two already pinned at the top of the sidebar. Its
          only real content — the active role — is in the navbar too. All it
          does here is push the actual figures below the fold. */}
      {!isSchoolLeadershipOrAdmin && (
      <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[5px] p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden">
        {/* Decorative ambient orbs */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-sky-500/8 blur-2xl pointer-events-none" />

        <div className="space-y-2.5 z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 backdrop-blur-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Vai trò hiện tại: {activeRole}
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
            {greetingByTime()}, {currentUser?.fullName}!
          </h2>
          <p className="text-slate-300/90 text-xs md:text-sm leading-relaxed">
            Hệ thống EduTask tự động kết nối luồng xin nghỉ phép và giao việc toàn trường, giúp giảm bớt thao tác giấy tờ và minh bạch tiến độ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10">
          <button
            onClick={onRequestNewLeave}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-900/30 hover:shadow-indigo-500/30 transition-all duration-200 flex items-center space-x-2 hover:-translate-y-0.5 active:translate-y-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tạo Đơn Xin Nghỉ</span>
          </button>
          
          {canAssignTask(currentUser, activeRole) && (
            <button
              onClick={onRequestNewTask}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 hover:shadow-emerald-500/30 transition-all duration-200 flex items-center space-x-2 hover:-translate-y-0.5 active:translate-y-0"
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
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0">
              <CalendarDays className="w-4 h-4" />
              {/* Animated pulse dot */}
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500">
                <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900">
                Thông Báo Lịch Nghỉ Hôm Nay ({todayStr})
              </div>
              <div className="text-xs text-amber-800/80">
                Có {teachersOnLeaveToday.length} giáo viên đang nghỉ phép: {teachersOnLeaveToday.map(l => `${l.applicantName} (${l.departmentName})`).join(', ')}.
              </div>
            </div>
          </div>
          <button
            onClick={() => onGoToTab('schedule')}
            className="text-xs font-bold text-amber-900 hover:text-amber-700 flex items-center space-x-1 px-3 py-1.5 rounded-lg hover:bg-amber-100/80 transition-colors"
          >
            <span>Xem lịch</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metric Cards Grid.
          Hidden for anyone who already has Mission Control above: three of
          these four tiles are the same readings under different names ("Đơn xin
          nghỉ chờ duyệt", "Tránh giao trùng lịch" = "Giáo viên nghỉ hôm nay",
          "Công việc hoàn thành"), and showing a number twice on one screen
          invites the reader to wonder which one is right. The fourth, work in
          progress, is now a registry metric so nothing is lost. */}
      {!isSchoolLeadershipOrAdmin && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">

        {/* Pending Leaves Card */}
        <button
          type="button"
          onClick={() => onGoToTab('leave')}
          className="group relative bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-amber-300 cursor-pointer transition-all duration-300 text-left overflow-hidden hover:shadow-xl hover:shadow-amber-100/40 hover:-translate-y-1 active:translate-y-0 active:shadow-md"
        >
          {/* Accent bar top */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-400 to-orange-400" />
          {/* Decorative background shape */}
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-amber-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300">
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
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Đơn Xin Nghỉ Chờ Duyệt</div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                {(isSchoolLeadershipOrAdmin || isDeptHeader) ? 'Cần BGH & Tổ trưởng xử lý' : 'Đơn đang được duyệt'}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
          </div>
        </button>

        {/* Active Tasks Card */}
        <button
          type="button"
          onClick={() => onGoToTab('task')}
          className="group relative bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-indigo-300 cursor-pointer transition-all duration-300 text-left overflow-hidden hover:shadow-xl hover:shadow-indigo-100/40 hover:-translate-y-1 active:translate-y-0 active:shadow-md"
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-400 to-blue-400" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-600 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300">
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
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Công Việc Đang Thực Hiện</div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">Nhiệm vụ đang triển khai</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
          </div>
        </button>

        {/* Completed Tasks Card — with progress ring */}
        <button
          type="button"
          onClick={() => onGoToTab('task')}
          className="group relative bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-emerald-300 cursor-pointer transition-all duration-300 text-left overflow-hidden hover:shadow-xl hover:shadow-emerald-100/40 hover:-translate-y-1 active:translate-y-0 active:shadow-md"
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400 to-green-400" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-600 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              {completedTasks.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold">
                  <TrendingUp className="w-3 h-3" />
                  {completionRate}%
                </span>
              )}
            </div>

            <div>
              <div className="text-3xl font-extrabold text-emerald-700 tracking-tight">{completedTasks.length}</div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Công Việc Hoàn Thành</div>
            </div>

            {/* Mini progress bar */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-slate-400">Tiến độ hoàn thành</span>
                <span className="text-[10px] font-bold text-emerald-600">{completedTasks.length}/{totalTasks}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-green-400 rounded-full transition-all duration-500"
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
          className="group relative bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-violet-300 cursor-pointer transition-all duration-300 text-left overflow-hidden hover:shadow-xl hover:shadow-violet-100/40 hover:-translate-y-1 active:translate-y-0 active:shadow-md"
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-violet-400 to-purple-400" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-violet-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {(isSchoolLeadershipOrAdmin || isDeptHeader) ? teachersOnLeaveToday.length : visibleLeaves.length}
              </div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                {(isSchoolLeadershipOrAdmin || isDeptHeader) ? 'Tránh Giao Trùng Lịch' : 'Lịch Nghỉ Cá Nhân'}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-violet-600/70">
                {(isSchoolLeadershipOrAdmin || isDeptHeader) ? 'GV đang trong kỳ nghỉ' : 'Tổng số đơn nghỉ'}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
          </div>
        </button>

      </div>
      )}


    </div>
  );
}
