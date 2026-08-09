'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { LEAVE_TYPE_LABELS } from '@/Edu-task/types/leave';
import { TASK_STATUS_CONFIG } from '@/Edu-task/types/task';
import { CalendarDays, LayoutGrid, Search } from 'lucide-react';
import { matchesSearch } from '@/Edu-task/lib/utils';
import { LeaveCalendar } from '@/Edu-task/components/schedule/LeaveCalendar';
import { canViewLeave } from '@/Edu-task/lib/permissions';
import { isDeptLeader, isSchoolLeadership } from '@/Edu-task/lib/permissions';
import { getDisplayTaskStatus } from '@/Edu-task/lib/taskStatus';

export function SchoolTimelineTab({ onSelectLeave }: { onSelectLeave?: (leaveId: string) => void }) {
  const { users, leaves, tasks, departments, currentUser, activeRole } = useApp();
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'PEOPLE'>('CALENDAR');

  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleDept, setPeopleDept] = useState('ALL');
  const [peopleStatus, setPeopleStatus] = useState<'ALL' | 'ON_LEAVE' | 'HAS_TASK' | 'FREE'>('ALL');

  const isSchoolExecutiveOrAdmin = isSchoolLeadership(currentUser, activeRole);
  const showsWholeDepartment = isDeptLeader(currentUser, activeRole);

  const displayUsers = useMemo(() => (
    isSchoolExecutiveOrAdmin
      ? users
      : showsWholeDepartment
      ? users.filter(u => u.departmentId === currentUser?.departmentId)
      : users.filter(u => u.id === currentUser?.id)
  ), [users, isSchoolExecutiveOrAdmin, showsWholeDepartment, currentUser?.departmentId, currentUser?.id]);

  const todayStr = new Date().toISOString().split('T')[0];

  /**
   * Whoever needs attention first, first.
   *
   * The grid used to follow the raw user order, so on a staff list of any size
   * the people actually absent today were scattered among colleagues with
   * nothing on. Absent today outranks carrying open work, which outranks free;
   * ties fall back to Vietnamese alphabetical order.
   */
  const peopleRows = useMemo(() => {
    const rows = displayUsers.map(teacher => {
      const activeLeaves = leaves.filter(l =>
        l.applicantId === teacher.id &&
        (l.overallStatus === 'APPROVED' || l.overallStatus === 'IN_REVIEW')
      );
      const isOnLeaveToday = activeLeaves.some(l => l.startDate <= todayStr && l.endDate >= todayStr);
      const teacherTasks = tasks.filter(t =>
        t.assignees.some(a => a.userId === teacher.id) && t.status !== 'COMPLETED'
      );
      return { teacher, activeLeaves, isOnLeaveToday, teacherTasks };
    });

    const rank = (r: typeof rows[number]) => (r.isOnLeaveToday ? 0 : r.teacherTasks.length > 0 ? 1 : 2);
    return rows.sort((a, b) => rank(a) - rank(b) || a.teacher.fullName.localeCompare(b.teacher.fullName, 'vi'));
  }, [displayUsers, leaves, tasks, todayStr]);

  const visibleRows = useMemo(() => peopleRows.filter(r => {
    const isSearchMatch = matchesSearch(
      peopleSearch,
      r.teacher.fullName,
      r.teacher.email,
      r.teacher.subject,
      r.teacher.departmentName
    );
    const matchesDept = peopleDept === 'ALL' || r.teacher.departmentId === peopleDept;
    const matchesStatus =
      peopleStatus === 'ALL' ? true
      : peopleStatus === 'ON_LEAVE' ? r.isOnLeaveToday
      : peopleStatus === 'HAS_TASK' ? r.teacherTasks.length > 0
      : !r.isOnLeaveToday && r.teacherTasks.length === 0;

    return isSearchMatch && matchesDept && matchesStatus;
  }), [peopleRows, peopleSearch, peopleDept, peopleStatus]);

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
      <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-2">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-indigo-600" />
          {headerTitle}
        </h2>
        <p className="text-xs text-slate-500">
          {headerSub}
        </p>

        <div className="pt-2 border-t border-slate-100 flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('CALENDAR')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'CALENDAR' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Lịch Tháng</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('PEOPLE')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'PEOPLE' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Theo Nhân Sự</span>
          </button>
        </div>
      </div>

      {viewMode === 'CALENDAR' && (
        <LeaveCalendar
          leaves={leaves.filter(l => canViewLeave(currentUser, activeRole, l))}
          onSelectLeave={onSelectLeave}
        />
      )}

      {/* Grid of Teachers with Status */}
      {viewMode === 'PEOPLE' && (
      <div className="space-y-4">

        {/* Filters */}
        <div className="bg-white rounded-[5px] border border-slate-200 p-4 shadow-sm space-y-3">
          <div className={`grid grid-cols-1 gap-3 text-xs ${isSchoolExecutiveOrAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                placeholder="Tìm tên, email, môn dạy..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Only leadership sees more than one department, so the filter
                would be a dropdown of one for everybody else. */}
            {isSchoolExecutiveOrAdmin && (
              <select
                value={peopleDept}
                onChange={(e) => setPeopleDept(e.target.value)}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 font-medium"
              >
                <option value="ALL">-- Tất cả Tổ chuyên môn --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}

            <select
              value={peopleStatus}
              onChange={(e) => setPeopleStatus(e.target.value as typeof peopleStatus)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 font-medium"
            >
              <option value="ALL">-- Tất cả trạng thái --</option>
              <option value="ON_LEAVE">Đang nghỉ hôm nay</option>
              <option value="HAS_TASK">Đang có việc được giao</option>
              <option value="FREE">Sẵn sàng, chưa có việc</option>
            </select>
          </div>

          <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
            Hiển thị <strong className="text-slate-700">{visibleRows.length}</strong>/{peopleRows.length} nhân sự · Tự động xếp theo thứ tự: đang nghỉ hôm nay → đang có việc → còn lại.
          </p>
        </div>

        {visibleRows.length === 0 ? (
          <div className="bg-white rounded-[5px] border border-slate-200 p-12 text-center shadow-sm space-y-2">
            <LayoutGrid className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-sm text-slate-700">Không tìm thấy nhân sự nào</p>
            <p className="text-xs text-slate-400">Thử đổi từ khóa hoặc bỏ bớt bộ lọc</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleRows.map(({ teacher, activeLeaves, isOnLeaveToday, teacherTasks }) => {
          return (
            <div 
              key={teacher.id} 
              className={`p-5 rounded-[5px] border transition-all ${
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
        )}
      </div>
      )}

    </div>
  );
}
