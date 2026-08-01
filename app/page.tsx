'use client';

import React, { useState } from 'react';
import { AppProvider, useApp } from '@/Edu-task/context/AppContext';
import { Navbar } from '@/Edu-task/components/layout/Navbar';
import { Sidebar, TabType } from '@/Edu-task/components/layout/Sidebar';
import { OverviewTab } from '@/Edu-task/components/dashboard/OverviewTab';
import { LeaveTab } from '@/Edu-task/components/leave/LeaveTab';
import { LeaveFormModal } from '@/Edu-task/components/leave/LeaveFormModal';
import { LeaveDetailModal } from '@/Edu-task/components/leave/LeaveDetailModal';
import { TaskTab } from '@/Edu-task/components/task/TaskTab';
import { TaskFormModal } from '@/Edu-task/components/task/TaskFormModal';
import { TaskDetailModal } from '@/Edu-task/components/task/TaskDetailModal';
import { SchoolTimelineTab } from '@/Edu-task/components/schedule/SchoolTimelineTab';
import { AnalyticsTab } from '@/Edu-task/components/stats/AnalyticsTab';
import { RbacConfigTab } from '@/Edu-task/components/config/RbacConfigTab';
import { LoginPage } from '@/Edu-task/components/auth/LoginPage';
import { PendingApprovalPage } from '@/Edu-task/components/auth/PendingApprovalPage';
import { LeaveRequest } from '@/Edu-task/types/leave';
import { Task } from '@/Edu-task/types/task';

function EduTaskMainApp() {
  const { leaves, tasks, currentUser, isAuthenticated } = useApp();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isLeaveFormOpen, setIsLeaveFormOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);

  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedLeave = leaves.find(l => l.id === selectedLeaveId) || null;
  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

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
          onRequestNewLeave={() => setIsLeaveFormOpen(true)}
          onRequestNewTask={() => setIsTaskFormOpen(true)}
        />

        {/* Dynamic View Panel */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <OverviewTab
              onRequestNewLeave={() => setIsLeaveFormOpen(true)}
              onRequestNewTask={() => setIsTaskFormOpen(true)}
              onSelectLeave={(id) => setSelectedLeaveId(id)}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onGoToTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'leave' && (
            <LeaveTab
              onRequestNewLeave={() => setIsLeaveFormOpen(true)}
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

      {/* Global Modals */}
      <LeaveFormModal
        isOpen={isLeaveFormOpen}
        onClose={() => setIsLeaveFormOpen(false)}
      />

      <LeaveDetailModal
        leave={selectedLeave}
        onClose={() => setSelectedLeaveId(null)}
      />

      <TaskFormModal
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
      />

      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <EduTaskMainApp />
    </AppProvider>
  );
}
