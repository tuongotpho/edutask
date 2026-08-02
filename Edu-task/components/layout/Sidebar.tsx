'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  CalendarDays, 
  BarChart3, 
  Settings, 
  Users, 
  ShieldCheck,
  PlusCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { isAdminEmail } from '@/Edu-task/lib/admin';
import { useApp } from '@/Edu-task/context/AppContext';
import { ROLE_LABELS } from '@/Edu-task/types/user';

export type TabType = 'dashboard' | 'leave' | 'task' | 'schedule' | 'stats' | 'config';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onRequestNewLeave: () => void;
  onRequestNewTask: () => void;
}

export function Sidebar({ 
  activeTab, 
  setActiveTab, 
  onRequestNewLeave, 
  onRequestNewTask 
}: SidebarProps) {
  const { currentUser, activeRole, leaves, tasks, users } = useApp();

  const isLeadershipOrAdmin = 
    activeRole === 'ADMIN' || 
    activeRole === 'PRINCIPAL' || 
    activeRole === 'VICE_PRINCIPAL' || 
    activeRole === 'SECRETARY' || 
    activeRole === 'INSPECTOR' ||
    currentUser?.roles?.includes('ADMIN') ||
    currentUser?.roles?.includes('PRINCIPAL') ||
    currentUser?.roles?.includes('VICE_PRINCIPAL');

  const visibleLeaves = leaves.filter(l => {
    if (isLeadershipOrAdmin) return true;
    if (activeRole === 'HEAD_OF_DEPT' || activeRole === 'GROUP_LEADER' || currentUser?.roles?.includes('HEAD_OF_DEPT') || currentUser?.roles?.includes('GROUP_LEADER')) {
      return l.departmentId === currentUser?.departmentId || l.applicantId === currentUser?.id;
    }
    return l.applicantId === currentUser?.id || l.substituteTeacherId === currentUser?.id;
  });

  // Calculate pending review badges based on visible scope
  const pendingLeavesCount = visibleLeaves.filter(l => l.overallStatus === 'IN_REVIEW').length;
  const activeTasksCount = tasks.filter(t => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS' || t.status === 'PENDING_APPROVAL').length;
  const pendingUsersCount = users.filter(u => u.status === 'PENDING_APPROVAL').length;

  const canAssignTasks = activeRole === 'PRINCIPAL' || activeRole === 'VICE_PRINCIPAL' || activeRole === 'HEAD_OF_DEPT' || activeRole === 'GROUP_LEADER' || activeRole === 'ADMIN';
  const isAdmin = activeRole === 'ADMIN' || currentUser?.roles?.includes('ADMIN') || isAdminEmail(currentUser?.email);
  const canViewStats = 
    activeRole === 'ADMIN' || 
    activeRole === 'PRINCIPAL' || 
    activeRole === 'VICE_PRINCIPAL' || 
    activeRole === 'HEAD_OF_DEPT' || 
    activeRole === 'GROUP_LEADER' || 
    activeRole === 'SECRETARY' || 
    activeRole === 'INSPECTOR' ||
    currentUser?.roles?.some(r => ['ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_OF_DEPT', 'GROUP_LEADER', 'SECRETARY', 'INSPECTOR'].includes(r));

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
    ...(canViewStats ? [{
      id: 'stats' as TabType,
      label: 'Báo Cáo & Thống Kê',
      icon: BarChart3,
      badge: null,
    }] : []),
    ...(isAdmin ? [{
      id: 'config' as TabType,
      label: 'Quản Trị RBAC & Duyệt TK',
      icon: ShieldCheck,
      badge: pendingUsersCount > 0 ? `${pendingUsersCount} duyệt` : null,
      badgeColor: 'bg-amber-500 text-white font-bold',
    }] : []),
  ];

  return (
    <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-4 flex-shrink-0">
      <div className="space-y-6">

        {/* Quick Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={onRequestNewLeave}
            className="w-full py-2.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-sm transition-all active:scale-98"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tạo Đơn Xin Nghỉ</span>
          </button>

          {canAssignTasks && (
            <button
              onClick={onRequestNewTask}
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
                onClick={() => setActiveTab(item.id)}
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
        <div className="text-[10px] text-center text-slate-400">
          EduTask v1.0.4 • Trường học Chuyển đổi số
        </div>
      </div>
    </aside>
  );
}
