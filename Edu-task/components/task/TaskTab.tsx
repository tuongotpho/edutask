'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG, TaskStatus, TaskPriority } from '@/Edu-task/types/task';
import { canAssignTask, isAdmin } from '@/Edu-task/lib/permissions';
import { getDisplayTaskStatus, isTaskOverdue } from '@/Edu-task/lib/taskStatus';
import { matchesSearch } from '@/Edu-task/lib/utils';
import { 
  CheckSquare, 
  Search, 
  PlusCircle, 
  LayoutGrid, 
  List
} from 'lucide-react';

interface TaskTabProps {
  onRequestNewTask: () => void;
  onSelectTask: (taskId: string) => void;
}

export function TaskTab({ onRequestNewTask, onSelectTask }: TaskTabProps) {
  const { tasks, currentUser, activeRole } = useApp();

  const [viewMode, setViewMode] = useState<'BOARD' | 'LIST'>('BOARD');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const canAssign = canAssignTask(currentUser, activeRole);

  const visibleTasks = tasks.filter(task =>
    isAdmin(currentUser, activeRole) || (task.viewerIds && task.viewerIds.includes(currentUser?.id || ''))
  );

  // Filter tasks. Diacritics-insensitive and matched against title,
  // description, code, and both the assigner's and every assignee's name so
  // searching a teacher's name finds tasks they gave or received.
  const filteredTasks = useMemo(() => visibleTasks.filter(task => {
    const isSearchMatch = matchesSearch(
      searchTerm,
      task.title,
      task.description,
      task.code,
      task.assignerName,
      ...task.assignees.map(a => a.userName)
    );

    const matchesPriority = selectedPriority === 'ALL' || task.priority === selectedPriority;
    // Match on the displayed status so "Quá hạn" actually selects something:
    // OVERDUE is derived from the deadline and is never stored on the document.
    const matchesStatus = selectedStatus === 'ALL' || getDisplayTaskStatus(task) === selectedStatus;

    return isSearchMatch && matchesPriority && matchesStatus;
  }), [visibleTasks, searchTerm, selectedPriority, selectedStatus]);

  // Kanban Columns
  const columns: { status: TaskStatus; label: string; bg: string }[] = [
    { status: 'ASSIGNED', label: 'Mới giao', bg: 'bg-sky-50/60 border-sky-200' },
    { status: 'IN_PROGRESS', label: 'Đang thực hiện', bg: 'bg-blue-50/60 border-blue-200' },
    { status: 'PENDING_APPROVAL', label: 'Chờ nghiệm thu', bg: 'bg-amber-50/60 border-amber-200' },
    { status: 'COMPLETED', label: 'Hoàn thành', bg: 'bg-emerald-50/60 border-emerald-200' },
  ];

  return (
    <div className="space-y-6">

      {/* Header & Controls */}
      <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              Quản Lý Giao Việc &amp; Theo Dõi Tiến Độ
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Theo dõi việc cá nhân &amp; tổ bộ môn, tránh giao trùng khi nhân sự nghỉ phép
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Board / List Toggle */}
            <div className="p-1 rounded-xl bg-slate-100 border border-slate-200 flex items-center space-x-1 text-xs">
              <button
                onClick={() => setViewMode('BOARD')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1 transition-all ${
                  viewMode === 'BOARD' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Bảng Kanban</span>
              </button>
              <button
                onClick={() => setViewMode('LIST')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1 transition-all ${
                  viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Danh Sách</span>
              </button>
            </div>

            {canAssign && (
              <button
                onClick={onRequestNewTask}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center space-x-2 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Phát Hành Giao Việc</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm công việc..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
          >
            <option value="ALL">-- Tất cả mức độ ưu tiên --</option>
            {(Object.keys(TASK_PRIORITY_CONFIG) as TaskPriority[]).map(p => (
              <option key={p} value={p}>{TASK_PRIORITY_CONFIG[p].label}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
          >
            <option value="ALL">-- Tất cả trạng thái --</option>
            {(Object.keys(TASK_STATUS_CONFIG) as TaskStatus[]).map(s => (
              <option key={s} value={s}>{TASK_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* BOARD VIEW */}
      {viewMode === 'BOARD' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map(col => {
            const columnTasks = filteredTasks.filter(t => t.status === col.status || (col.status === 'IN_PROGRESS' && t.status === 'VIEWED'));
            return (
              <div key={col.status} className={`p-4 rounded-[5px] border ${col.bg} space-y-3 min-h-[400px]`}>
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">{col.label}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 font-bold text-[10px] shadow-xs">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {columnTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task.id)}
                      className="p-4 bg-white rounded-[5px] border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-slate-500">{task.code}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TASK_PRIORITY_CONFIG[task.priority].badgeBg}`}>
                          {TASK_PRIORITY_CONFIG[task.priority].label}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">{task.title}</h4>

                      <div className="text-[10px] text-slate-500">
                        Giao bởi: <strong className="text-slate-800">{task.assignerName}</strong>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-rose-600 font-bold">Deadline: {task.deadline.split(' ')[0]}</span>
                        {isTaskOverdue(task) ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold border border-rose-300">
                            Quá hạn
                          </span>
                        ) : (
                          <span className="text-slate-400">{task.assignees.length} người nhận</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white rounded-[5px] border border-slate-200 overflow-hidden shadow-sm">
          <div className="divide-y divide-slate-100 text-xs">
            {filteredTasks.map(task => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="p-5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{task.code}</span>
                    <span className="font-bold text-slate-900 text-sm">{task.title}</span>
                  </div>
                  <p className="text-slate-600 line-clamp-1">{task.description}</p>
                  <div className="text-[10px] text-slate-400">Giao bởi: {task.assignerName} • Hạn: {task.deadline}</div>
                </div>

                <div className="text-right flex-shrink-0">
                  {(() => {
                    const displayStatus = getDisplayTaskStatus(task);
                    const config = TASK_STATUS_CONFIG[displayStatus];
                    return (
                      <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
