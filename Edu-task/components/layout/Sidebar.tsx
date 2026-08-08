'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  CalendarDays, 
  BarChart3,
  ShieldCheck,
  History,
  PlusCircle,
  Repeat,
  ClipboardList,
  CalendarCheck,
  Target,
  GraduationCap,
  Award,
  X
} from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  canAssignTask,
  canViewLeave,
  isSchoolLeadership,
} from '@/Edu-task/lib/permissions';
import { canAccessTab } from '@/Edu-task/lib/tabRouting';
import { APP_VERSION, describeVersion } from '@/Edu-task/lib/version';
import { classesMissingRoll } from '@/Edu-task/lib/studentStats';
import { toDateString } from '@/Edu-task/lib/schedule';

export type TabType = 'dashboard' | 'leave' | 'task' | 'schedule' | 'lessons' | 'attendance' | 'meetings' | 'plans' | 'students' | 'gifted' | 'stats' | 'audit' | 'config';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onRequestNewLeave: () => void;
  onRequestNewTask: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ 
  activeTab, 
  setActiveTab, 
  onRequestNewLeave, 
  onRequestNewTask,
  isMobileOpen = false,
  onCloseMobile
}: SidebarProps) {
  const {
    currentUser, activeRole, leaves, tasks, users, makeups, bookings, attendance, meetings,
    classes, studentAttendance, giftedPrograms,
  } = useApp();

  const isLeadershipOrAdmin = isSchoolLeadership(currentUser, activeRole);
  const visibleLeaves = leaves.filter(l => canViewLeave(currentUser, activeRole, l));

  // Calculate pending review badges based on visible scope
  const pendingLeavesCount = visibleLeaves.filter(l => l.overallStatus === 'IN_REVIEW').length;
  const activeTasksCount = tasks.filter(t => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS' || t.status === 'PENDING_APPROVAL').length;
  const pendingUsersCount = users.filter(u => u.status === 'PENDING_APPROVAL').length;
  // Badge counts only what this user could act on, so a teacher is not nagged by
  // the whole school's pending paperwork.
  const pendingScheduleCount =
    makeups.filter(m => m.status === 'IN_REVIEW').length +
    bookings.filter(b => b.status === 'IN_REVIEW').length;
  // The attendance subscription is already scoped by role, so whatever arrived
  // is what this user is entitled to act on — no second filter needed here.
  const openAttendanceCount = attendance.filter(
    r => r.status === 'RECORDED' || r.status === 'EXPLAINED'
  ).length;
  const upcomingMeetingsCount = meetings.filter(m => m.status === 'SCHEDULED').length;
  const classesMissingRollToday = classesMissingRoll(
    studentAttendance,
    toDateString(new Date()),
    classes.filter(c => c.isActive).map(c => c.id)
  ).length;

  const myPendingGiftedLessonsCount = giftedPrograms.reduce((acc, p) => {
    return acc + p.lessons.filter(l => l.status === 'PENDING' && l.teacherId === currentUser?.id).length;
  }, 0);

  const canAssignTasks = canAssignTask(currentUser, activeRole);
  // Shared with the URL handler in page.tsx: a tab hidden here must also be
  // unreachable by typing its address.
  const showStats = canAccessTab(currentUser, activeRole, 'stats');
  const showAudit = canAccessTab(currentUser, activeRole, 'audit');
  const isAdmin = canAccessTab(currentUser, activeRole, 'config');

  const menuItems = [
    {
      id: 'dashboard' as TabType,
      label: 'Tổng Quan',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'leave' as TabType,
      label: 'Đơn Xin Nghỉ',
      icon: FileText,
      badge: pendingLeavesCount > 0 ? pendingLeavesCount : null,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'task' as TabType,
      label: 'Quản Lý Giao Việc',
      icon: CheckSquare,
      badge: activeTasksCount > 0 ? activeTasksCount : null,
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'schedule' as TabType,
      label: isLeadershipOrAdmin ? 'Lịch Nghỉ & Việc Toàn Trường' : 'Lịch Nghỉ & Việc Cá Nhân',
      icon: CalendarDays,
      badge: null,
    },
    {
      id: 'lessons' as TabType,
      label: 'Dạy Bù, Phòng & Thiết Bị',
      icon: Repeat,
      badge: pendingScheduleCount > 0 ? pendingScheduleCount : null,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'attendance' as TabType,
      label: 'Nề Nếp Chuyên Môn',
      icon: ClipboardList,
      // For a teacher this counts records about them awaiting a reply; for a
      // supervisor or BGH it counts records awaiting a conclusion.
      badge: openAttendanceCount > 0 ? openAttendanceCount : null,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'meetings' as TabType,
      label: 'Cuộc Họp & Điểm Danh',
      icon: CalendarCheck,
      badge: upcomingMeetingsCount > 0 ? upcomingMeetingsCount : null,
      badgeColor: 'bg-violet-100 text-violet-800',
    },
    {
      id: 'plans' as TabType,
      label: 'Kế Hoạch & Nhắc Việc',
      icon: Target,
      badge: null,
    },
    {
      id: 'students' as TabType,
      label: 'Học Sinh',
      icon: GraduationCap,
      // Counts classes with no roll taken today — the register's to-do list.
      badge: classesMissingRollToday > 0 ? classesMissingRollToday : null,
      badgeColor: 'bg-sky-100 text-sky-800',
    },
    {
      id: 'gifted' as TabType,
      label: 'Bồi Dưỡng HSG',
      icon: Award,
      badge: myPendingGiftedLessonsCount > 0 ? myPendingGiftedLessonsCount : null,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    ...(showStats ? [{
      id: 'stats' as TabType,
      label: 'Báo Cáo & Thống Kê',
      icon: BarChart3,
      badge: null,
    }] : []),
    ...(showAudit ? [{
      id: 'audit' as TabType,
      label: 'Nhật Ký Hoạt Động',
      icon: History,
      badge: null,
    }] : []),
    ...(isAdmin ? [{
      id: 'config' as TabType,
      label: 'Quản Trị & Duyệt TK',
      icon: ShieldCheck,
      badge: pendingUsersCount > 0 ? `${pendingUsersCount} duyệt` : null,
      badgeColor: 'bg-amber-500 text-white font-bold',
    }] : []),
  ];

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    onCloseMobile?.();
  };

  const handleLeaveClick = () => {
    onRequestNewLeave();
    onCloseMobile?.();
  };

  const handleTaskClick = () => {
    onRequestNewTask();
    onCloseMobile?.();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 md:hidden animate-in fade-in duration-150"
        />
      )}

      {/* Sidebar Container — Desktop Column + Mobile Slide-Over Drawer */}
      <aside
        className={`bg-white border-r border-slate-200 flex-col justify-between p-4 flex-shrink-0 transition-all ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 w-72 z-50 shadow-2xl overflow-y-auto flex md:relative md:w-64 md:z-auto md:shadow-none md:overflow-visible'
            : 'hidden md:flex md:w-64'
        }`}
      >
        <div className="space-y-6">

          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 md:hidden">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              <span>Danh Mục Quản Lý</span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleLeaveClick}
              className="w-full py-2.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-sm transition-all active:scale-98"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tạo Đơn Xin Nghỉ</span>
            </button>

            {canAssignTasks && (
              <button
                onClick={handleTaskClick}
                className="w-full py-2 px-3.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center justify-center space-x-2 transition-all active:scale-98"
              >
                <CheckSquare className="w-4 h-4 text-indigo-600" />
                <span>Giao Việc Mới</span>
              </button>
            )}
          </div>

          {/* Navigation List */}
          <nav className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-3 mb-2">
              Danh Mục Quản Lý
            </div>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? 'bg-slate-900 text-white shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-indigo-500 text-white' : item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Version Info */}
        <div className="pt-4 border-t border-slate-100">
          <div className="text-[10px] text-center text-slate-400" title={describeVersion()}>
            EduTask ver {APP_VERSION} • Trường học Chuyển đổi số
          </div>
        </div>
      </aside>
    </>
  );
}
