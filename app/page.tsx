'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AppProvider, useApp } from '@/Edu-task/context/AppContext';
import { Navbar } from '@/Edu-task/components/layout/Navbar';
import { Sidebar, TabType } from '@/Edu-task/components/layout/Sidebar';
import { OverviewTab } from '@/Edu-task/components/dashboard/OverviewTab';
import { LeaveTab } from '@/Edu-task/components/leave/LeaveTab';
import { TaskTab } from '@/Edu-task/components/task/TaskTab';
import { LoginPage } from '@/Edu-task/components/auth/LoginPage';
import { PendingApprovalPage } from '@/Edu-task/components/auth/PendingApprovalPage';
import { ToastViewport } from '@/Edu-task/components/common/Toast';
import { LeaveRequest } from '@/Edu-task/types/leave';
import { canAccessTab, DEFAULT_TAB, searchForTab, tabFromSearch } from '@/Edu-task/lib/tabRouting';

// Split out of the initial bundle. The dashboard, leave and task tabs are what
// a teacher opens every day; these are either role-gated (RBAC, analytics) or
// opened on demand (modals, timeline), and the date picker they pull in is
// heavy. `ssr: false` is safe here — the whole page is a client component.
const loading = () => (
  <div className="p-8 text-center text-xs text-slate-400 font-semibold">Đang tải…</div>
);

const SchoolTimelineTab = dynamic(
  () => import('@/Edu-task/components/schedule/SchoolTimelineTab').then(m => m.SchoolTimelineTab),
  { ssr: false, loading }
);
const ScheduleRegistrationTab = dynamic(
  () => import('@/Edu-task/components/schedule/ScheduleRegistrationTab').then(m => m.ScheduleRegistrationTab),
  { ssr: false, loading }
);
const AttendanceTab = dynamic(
  () => import('@/Edu-task/components/attendance/AttendanceTab').then(m => m.AttendanceTab),
  { ssr: false, loading }
);
const MeetingsTab = dynamic(
  () => import('@/Edu-task/components/meeting/MeetingsTab').then(m => m.MeetingsTab),
  { ssr: false, loading }
);
const PlansTab = dynamic(
  () => import('@/Edu-task/components/plan/PlansTab').then(m => m.PlansTab),
  { ssr: false, loading }
);
const StudentsTab = dynamic(
  () => import('@/Edu-task/components/student/StudentsTab').then(m => m.StudentsTab),
  { ssr: false, loading }
);
const GiftedTab = dynamic(
  () => import('@/Edu-task/components/gifted/GiftedTab').then(m => m.GiftedTab),
  { ssr: false, loading }
);
const AnalyticsTab = dynamic(
  () => import('@/Edu-task/components/stats/AnalyticsTab').then(m => m.AnalyticsTab),
  { ssr: false, loading }
);
const AuditLogTab = dynamic(
  () => import('@/Edu-task/components/config/AuditLogTab').then(m => m.AuditLogTab),
  { ssr: false, loading }
);
const RbacConfigTab = dynamic(
  () => import('@/Edu-task/components/config/RbacConfigTab').then(m => m.RbacConfigTab),
  { ssr: false, loading }
);
const LeaveFormModal = dynamic(
  () => import('@/Edu-task/components/leave/LeaveFormModal').then(m => m.LeaveFormModal),
  { ssr: false }
);
const LeaveDetailModal = dynamic(
  () => import('@/Edu-task/components/leave/LeaveDetailModal').then(m => m.LeaveDetailModal),
  { ssr: false }
);
const TaskFormModal = dynamic(
  () => import('@/Edu-task/components/task/TaskFormModal').then(m => m.TaskFormModal),
  { ssr: false }
);
const TaskDetailModal = dynamic(
  () => import('@/Edu-task/components/task/TaskDetailModal').then(m => m.TaskDetailModal),
  { ssr: false }
);
function EduTaskMainApp() {
  const { leaves, tasks, currentUser, activeRole, isAuthenticated } = useApp();

  const [activeTab, setActiveTab] = useState<TabType>(DEFAULT_TAB);

  // The address bar is the source of truth for which tab is open, so a reload
  // keeps you where you were, Back steps between tabs instead of leaving the
  // app, and a tab can be linked to. Read after mount rather than during
  // render: the page is statically exported, so the prerendered HTML knows
  // nothing about the query string and reading it earlier would mismatch.
  useEffect(() => {
    const syncFromUrl = () => setActiveTab(tabFromSearch(window.location.search));
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const goToTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
    window.history.pushState(null, '', `${window.location.pathname}${searchForTab(tab)}`);
  }, []);

  // A link can name any tab, including one this role has no business opening,
  // so the URL is checked against the same rule the sidebar uses.
  const visibleTab = canAccessTab(currentUser, activeRole, activeTab) ? activeTab : DEFAULT_TAB;

  // Correct the address bar rather than leave it claiming a tab that is not on
  // screen — otherwise the refused link stays copyable and keeps misleading.
  // The state write here is not derived data being mirrored — it is a genuine
  // correction that must stick. Rendering already reads `visibleTab`, so
  // dropping it would look identical today; but `activeTab` would keep holding
  // the refused tab, and the moment the user switched into a role that may open
  // it they would be thrown there unannounced. Resetting it makes the refusal
  // final. Runs at most once per refusal, so there is no cascade.
  useEffect(() => {
    if (visibleTab === activeTab) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setActiveTab(visibleTab);
    window.history.replaceState(null, '', `${window.location.pathname}${searchForTab(visibleTab)}`);
  }, [visibleTab, activeTab]);

  // Mobile Navigation Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modals state
  const [isLeaveFormOpen, setIsLeaveFormOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);

  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedLeave = leaves.find(l => l.id === selectedLeaveId) || null;
  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  const handleOpenNewLeave = () => {
    setEditingLeave(null);
    setIsLeaveFormOpen(true);
  };

  const handleOpenEditLeave = (leaveToEdit: LeaveRequest) => {
    setEditingLeave(leaveToEdit);
    setIsLeaveFormOpen(true);
  };

  if (!isAuthenticated || !currentUser) {
    return <LoginPage />;
  }

  if (currentUser.status === 'PENDING_APPROVAL' || currentUser.status === 'REJECTED') {
    return <PendingApprovalPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
      {/* Top Navigation */}
      <Navbar
        onSelectTask={(id) => { goToTab('task'); setSelectedTaskId(id); }}
        onSelectLeave={(id) => { goToTab('leave'); setSelectedLeaveId(id); }}
        onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
      />

      {/* Main Content Layout */}
      <div className="flex-1 w-full max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 flex flex-col md:flex-row">
        {/* Sidebar */}
        <Sidebar
          activeTab={visibleTab}
          setActiveTab={goToTab}
          onRequestNewLeave={handleOpenNewLeave}
          onRequestNewTask={() => setIsTaskFormOpen(true)}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Dynamic View Panel */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {visibleTab === 'dashboard' && (
            <OverviewTab
              onRequestNewLeave={handleOpenNewLeave}
              onRequestNewTask={() => setIsTaskFormOpen(true)}
              onGoToTab={goToTab}
            />
          )}

          {visibleTab === 'leave' && (
            <LeaveTab
              onRequestNewLeave={handleOpenNewLeave}
              onSelectLeave={(id) => setSelectedLeaveId(id)}
            />
          )}

          {visibleTab === 'task' && (
            <TaskTab
              onRequestNewTask={() => setIsTaskFormOpen(true)}
              onSelectTask={(id) => setSelectedTaskId(id)}
            />
          )}

          {visibleTab === 'schedule' && (
            <SchoolTimelineTab onSelectLeave={(id) => setSelectedLeaveId(id)} />
          )}

          {visibleTab === 'lessons' && (
            <ScheduleRegistrationTab />
          )}

          {visibleTab === 'attendance' && (
            <AttendanceTab />
          )}

          {visibleTab === 'meetings' && (
            <MeetingsTab />
          )}

          {visibleTab === 'plans' && (
            <PlansTab />
          )}

          {visibleTab === 'students' && (
            <StudentsTab />
          )}

          {visibleTab === 'gifted' && (
            <GiftedTab />
          )}

          {visibleTab === 'stats' && (
            <AnalyticsTab />
          )}

          {visibleTab === 'audit' && (
            <AuditLogTab />
          )}

          {visibleTab === 'config' && (
            <RbacConfigTab />
          )}
        </main>
      </div>

      {/* Global Modals — mounted only while open so their lazily-loaded chunks
          (and the date picker inside them) are fetched on first use, not on
          every page load. Each modal still guards its own props internally. */}
      {isLeaveFormOpen && (
        <LeaveFormModal
          key={editingLeave?.id ?? 'new-leave'}
          isOpen={isLeaveFormOpen}
          editingLeave={editingLeave}
          onClose={() => {
            setIsLeaveFormOpen(false);
            setEditingLeave(null);
          }}
        />
      )}

      {selectedLeave && (
        <LeaveDetailModal
          key={selectedLeave.id}
          leave={selectedLeave}
          onClose={() => setSelectedLeaveId(null)}
          onEditLeave={handleOpenEditLeave}
        />
      )}

      {isTaskFormOpen && (
        <TaskFormModal
          isOpen={isTaskFormOpen}
          onClose={() => setIsTaskFormOpen(false)}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}

/**
 * Rendered as a sibling of the app shell so toasts survive every branch —
 * login screen, pending-approval screen and the main app alike.
 */
function GlobalToasts() {
  const { toasts, dismissToast } = useApp();
  return <ToastViewport toasts={toasts} onDismiss={dismissToast} />;
}

export default function Page() {
  return (
    <AppProvider>
      <EduTaskMainApp />
      <GlobalToasts />
    </AppProvider>
  );
}
