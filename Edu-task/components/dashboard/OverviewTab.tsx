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
  ShieldCheck,
  CalendarDays
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
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Vai trò hiện tại: {activeRole}
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Xin chào, {currentUser?.fullName}!
          </h2>
          <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
            Hệ thống EduTask tự động kết nối luồng xin nghỉ phép và giao việc toàn trường, giúp giảm bớt thao tác giấy tờ và minh bạch tiến độ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10">
          <button
            onClick={onRequestNewLeave}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tạo Đơn Xin Nghỉ</span>
          </button>
          
          {canAssignTask(currentUser, activeRole) && (
            <button
              onClick={onRequestNewTask}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2"
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
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900">
                Thông Báo Lịch Nghỉ Hôm Nay ({todayStr})
              </div>
              <div className="text-xs text-amber-800">
                Có {teachersOnLeaveToday.length} giáo viên đang nghỉ phép: {teachersOnLeaveToday.map(l => `${l.applicantName} (${l.departmentName})`).join(', ')}.
              </div>
            </div>
          </div>
          <button
            onClick={() => onGoToTab('schedule')}
            className="text-xs font-bold text-amber-900 hover:underline flex items-center space-x-1"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <div 
          onClick={() => onGoToTab('leave')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đơn Xin Nghỉ Chờ Duyệt</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{pendingLeaves.length}</div>
          <div className="text-[11px] text-slate-500">
            {(isSchoolLeadershipOrAdmin || isDeptHeader) ? 'Cần BGH & Tổ trưởng xử lý' : 'Đơn của bạn đang được duyệt'}
          </div>
        </div>

        <div 
          onClick={() => onGoToTab('task')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Công Việc Đang Thực Hiện</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{activeTasks.length}</div>
          <div className="text-[11px] text-slate-500">Nhiệm vụ đang triển khai</div>
        </div>

        <div 
          onClick={() => onGoToTab('task')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Công Việc Hoàn Thành</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{completedTasks.length}</div>
          <div className="text-[11px] text-emerald-600">Đã kiểm tra & nghiệm thu</div>
        </div>

        <div 
          onClick={() => onGoToTab('schedule')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {(isSchoolLeadershipOrAdmin || isDeptHeader) ? 'Tránh Giao Trùng Lịch' : 'Lịch Nghỉ Cá Nhân'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {(isSchoolLeadershipOrAdmin || isDeptHeader) ? teachersOnLeaveToday.length : visibleLeaves.length}
          </div>
          <div className="text-[11px] text-purple-700">
            {(isSchoolLeadershipOrAdmin || isDeptHeader) ? 'Giáo viên đang trong kỳ nghỉ' : 'Tổng số đơn nghỉ của bạn'}
          </div>
        </div>

      </div>
      )}


    </div>
  );
}
