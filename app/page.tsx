'use client';

import React, { useState } from 'react';
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
const AnalyticsTab = dynamic(
  () => import('@/Edu-task/components/stats/AnalyticsTab').then(m => m.AnalyticsTab),
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
  const { leaves, tasks, currentUser, isAuthenticated } = useApp();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

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

  if (currentUser.status === 'PENDING_APPROVAL') {
    return <PendingApprovalPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
      {/* Top Navigation */}
      <Navbar onSearch={setSearchTerm} />

      {/* Main Content Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onRequestNewLeave={handleOpenNewLeave}
          onRequestNewTask={() => setIsTaskFormOpen(true)}
        />

        {/* Dynamic View Panel */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <OverviewTab
              onRequestNewLeave={handleOpenNewLeave}
              onRequestNewTask={() => setIsTaskFormOpen(true)}
              onSelectLeave={(id) => setSelectedLeaveId(id)}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onGoToTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'leave' && (
            <LeaveTab
              onRequestNewLeave={handleOpenNewLeave}
              onSelectLeave={(id) => setSelectedLeaveId(id)}
              searchTerm={searchTerm}
            />
          )}

          {activeTab === 'task' && (
            <TaskTab
              onRequestNewTask={() => setIsTaskFormOpen(true)}
              onSelectTask={(id) => setSelectedTaskId(id)}
            />
          )}

          {activeTab === 'schedule' && (
            <SchoolTimelineTab />
          )}

          {activeTab === 'stats' && (
            <AnalyticsTab />
          )}

          {activeTab === 'config' && (
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
