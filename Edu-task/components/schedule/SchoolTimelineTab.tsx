'use client';

import React from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { LEAVE_TYPE_LABELS } from '@/Edu-task/types/leave';
import { TASK_STATUS_CONFIG } from '@/Edu-task/types/task';
import { CalendarDays } from 'lucide-react';
import { isDeptLeader, isSchoolLeadership } from '@/Edu-task/lib/permissions';
import { getDisplayTaskStatus } from '@/Edu-task/lib/taskStatus';

export function SchoolTimelineTab() {
  const { users, leaves, tasks, currentUser, activeRole } = useApp();

  const isSchoolExecutiveOrAdmin = isSchoolLeadership(currentUser, activeRole);
  const showsWholeDepartment = isDeptLeader(currentUser, activeRole);

  const displayUsers = isSchoolExecutiveOrAdmin
    ? users
    : showsWholeDepartment
    ? users.filter(u => u.departmentId === currentUser?.departmentId)
    : users.filter(u => u.id === currentUser?.id);

  const todayStr = new Date().toISOString().split('T')[0];

  let headerTitle = 'Lịch Nghỉ Phép & Khối Lượng Công Việc Cá Nhân';
  let headerSub = 'Theo dõi lịch nghỉ phép đã đăng ký và danh sách công việc đang được giao phụ trách.';

  if (isSchoolExecutiveOrAdmin) {
    headerTitle = 'Lịch Nghỉ Phép & Khối Lượng Công Việc Toàn Trường';
    headerSub = 'Công khai minh bạch tiến độ nhiệm vụ và trạng thái có mặt toàn trường để hỗ trợ Ban Giám Hiệu chỉ đạo.';
  } else if (showsWholeDepartment) {
    headerTitle = `Lịch Nghỉ Phép & Khối Lượng Công Việc - ${currentUser?.departmentName || 'Tổ Chuyên Môn'}`;
    headerSub = `Theo dõi tiến độ nhiệm vụ và lịch nghỉ phép của giáo viên thuộc ${currentUser?.departmentName || 'tổ mình quản lý'}.`;
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-2">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-indigo-600" />
          {headerTitle}
        </h2>
        <p className="text-xs text-slate-500">
          {headerSub}
        </p>
      </div>

      {/* Grid of Teachers with Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayUsers.map(teacher => {
          // Check active leaves for this teacher
          const activeLeaves = leaves.filter(l => 
            l.applicantId === teacher.id && 
            (l.overallStatus === 'APPROVED' || l.overallStatus === 'IN_REVIEW')
          );

          const isOnLeaveToday = activeLeaves.some(l => l.startDate <= todayStr && l.endDate >= todayStr);

          // Active tasks assigned to this teacher
          const teacherTasks = tasks.filter(t => 
            t.assignees.some(a => a.userId === teacher.id) &&
            t.status !== 'COMPLETED'
          );

          return (
            <div 
              key={teacher.id} 
              className={`p-5 rounded-3xl border transition-all ${
                isOnLeaveToday 
                  ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20' 
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              {/* Teacher Info */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">{teacher.fullName}</div>
                  <div className="text-[10px] text-slate-500">{teacher.departmentName} • {teacher.subject || 'Chuyên môn'}</div>
                </div>

                {isOnLeaveToday ? (
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300 animate-pulse">
                    Đang Nghỉ Phép
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                    Sẵn Sàng Làm Việc
                  </span>
                )}
              </div>

              {/* Active Leave Records */}
              <div className="py-2.5 space-y-1.5 border-b border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-400">Lịch nghỉ đăng ký ({activeLeaves.length})</div>
                {activeLeaves.length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic">Không có lịch nghỉ</div>
                ) : (
                  activeLeaves.map(leave => (
                    <div key={leave.id} className="p-2 rounded-xl bg-white border border-slate-200/80 text-[11px] space-y-0.5">
                      <div className="font-bold text-slate-800 flex items-center justify-between">
                        <span>{leave.startDate} → {leave.endDate}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${LEAVE_TYPE_LABELS[leave.leaveType].bg}`}>
                          {LEAVE_TYPE_LABELS[leave.leaveType].label}
                        </span>
                      </div>
                      <p className="text-slate-600 line-clamp-1">{leave.reason}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Active Tasks Assigned */}
              <div className="pt-2.5 space-y-1.5">
                <div className="text-[10px] uppercase font-bold text-slate-400">Công việc đang phụ trách ({teacherTasks.length})</div>
                {teacherTasks.length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic">Hiện chưa có nhiệm vụ nào</div>
                ) : (
                  teacherTasks.map(task => (
                    <div key={task.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px]">
                      <div className="font-bold text-slate-900 line-clamp-1">{task.title}</div>
                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        <span className="text-rose-600 font-semibold">Hạn: {task.deadline.split(' ')[0]}</span>
                        <span className={`font-bold ${TASK_STATUS_CONFIG[getDisplayTaskStatus(task)].color}`}>
                          {TASK_STATUS_CONFIG[getDisplayTaskStatus(task)].label}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
