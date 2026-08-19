import {
  MetricContext,
  MetricDefinition,
  MetricGroup,
  MetricOutcome,
} from '@/Edu-task/types/dashboard';
import { LeaveRequest } from '@/Edu-task/types/leave';
import { isTaskOverdue, parseDeadline } from '@/Edu-task/lib/taskStatus';
import { onTimeCompletionRate } from '@/Edu-task/lib/analytics';
import { isSunday, isWeekend, toDateString } from '@/Edu-task/lib/schedule';
import { isCounted, punctualityRate, recordsInMonth } from '@/Edu-task/lib/attendanceStats';
import { isMinutesOutstanding } from '@/Edu-task/lib/meetingStats';
import { aggregateProgress } from '@/Edu-task/lib/planProgress';
import {
  classesMissingRoll,
  conductInMonth,
  studentsNeedingSupport,
  summariseDay,
} from '@/Edu-task/lib/studentStats';
import { BOOKING_ACTIVE_STATUSES } from '@/Edu-task/types/booking';
import { faultyEquipment, overdueLoans, totalOnLoan } from '@/Edu-task/lib/equipmentAvailability';

/**
 * The indicator registry behind the principal's operations screen.
 *
 * Adding an indicator means adding one entry here — no component changes. See
 * `types/dashboard.ts` for why indicators whose module does not exist yet are
 * *declared* rather than omitted.
 */

// --- Shared predicates -----------------------------------------------------

/** Dates are `YYYY-MM-DD`, so lexicographic comparison is chronological. */
function coversDate(leave: LeaveRequest, date: string): boolean {
  return (leave.startDate ?? '') <= date && date <= (leave.endDate ?? '');
}

function isAbsentOn(leave: LeaveRequest, date: string): boolean {
  return leave.overallStatus === 'APPROVED' && coversDate(leave, date);
}

/** Builds the context resolvers read, deriving both notions of "today". */
export function buildMetricContext(
  data: Omit<MetricContext, 'today' | 'todayUtc' | 'now'> & { now?: Date }
): MetricContext {
  const now = data.now ?? new Date();
  return {
    ...data,
    now,
    today: toDateString(now),
    todayUtc: now.toISOString().slice(0, 10),
  };
}

// --- Tone helpers ----------------------------------------------------------

/** A count where zero is the good news: 0 → green, else amber past `warnAt`. */
function countOutcome(
  value: number,
  opts: { warnAt?: number; criticalAt?: number; detail?: string; emptyNote: string }
): MetricOutcome {
  // Zero really is the reading here, and the reassuring one.
  if (value === 0) return { state: 'EMPTY', note: opts.emptyNote, zeroIsMeaningful: true };
  const tone =
    opts.criticalAt !== undefined && value >= opts.criticalAt
      ? 'CRITICAL'
      : opts.warnAt !== undefined && value >= opts.warnAt
        ? 'WARNING'
        : 'INFO';
  return { state: 'READY', value, unit: 'COUNT', tone, detail: opts.detail };
}

// --- Registry --------------------------------------------------------------

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // ---------------- Nhân sự ----------------
  {
    key: 'staff.on_leave_today',
    label: 'Giáo viên nghỉ hôm nay',
    group: 'STAFF',
    linkTab: 'leave',
    resolve: ctx => {
      const absent = ctx.leaves.filter(l => isAbsentOn(l, ctx.today));
      const depts = new Set(absent.map(l => l.departmentId));
      const uncovered = absent.filter(l => !l.substituteTeacherId).length;
      return countOutcome(absent.length, {
        warnAt: 3,
        criticalAt: 6,
        emptyNote: 'Hôm nay không có ai nghỉ',
        detail:
          uncovered > 0
            ? `${uncovered} trường hợp chưa có người dạy thay · ${depts.size} tổ`
            : `Đã bố trí dạy thay đủ · ${depts.size} tổ`,
      });
    },
  },
  {
    key: 'staff.leave_pending',
    label: 'Đơn nghỉ chờ phê duyệt',
    group: 'STAFF',
    linkTab: 'leave',
    resolve: ctx =>
      countOutcome(ctx.leaves.filter(l => l.overallStatus === 'IN_REVIEW').length, {
        warnAt: 5,
        criticalAt: 10,
        emptyNote: 'Không còn đơn nào chờ duyệt',
      }),
  },
  {
    key: 'staff.late_today',
    label: 'Giáo viên đi muộn hôm nay',
    group: 'STAFF',
    linkTab: 'attendance',
    resolve: ctx => {
      const late = ctx.attendance.filter(
        r => r.slot?.date === ctx.today && r.issue === 'LATE' && isCounted(r)
      );
      const minutes = late.reduce((sum, r) => sum + (r.minutes ?? 0), 0);
      return countOutcome(late.length, {
        warnAt: 2,
        criticalAt: 5,
        emptyNote: 'Hôm nay chưa có ghi nhận đi muộn',
        detail: minutes > 0 ? `Tổng ${minutes} phút` : undefined,
      });
    },
  },
  {
    key: 'staff.empty_class_today',
    label: 'Lớp trống giờ hôm nay',
    group: 'STAFF',
    linkTab: 'attendance',
    resolve: ctx =>
      countOutcome(
        ctx.attendance.filter(
          r => r.slot?.date === ctx.today && r.issue === 'EMPTY_CLASS' && isCounted(r)
        ).length,
        { warnAt: 1, criticalAt: 3, emptyNote: 'Không có lớp nào trống giờ' }
      ),
  },
  {
    key: 'staff.punctuality_rate',
    label: 'Giáo viên không bị ghi nhận (tháng này)',
    group: 'STAFF',
    linkTab: 'attendance',
    resolve: ctx => {
      const teachingStaff = ctx.users.filter(u => u.status === 'ACTIVE' && u.isTeachingStaff).length;
      const month = ctx.today.slice(0, 7);
      const rate = punctualityRate(recordsInMonth(ctx.attendance, month), teachingStaff);
      if (rate === null) return { state: 'EMPTY', note: 'Chưa có giáo viên nào để tính' };
      return {
        state: 'READY',
        value: rate,
        unit: 'PERCENT',
        tone: rate >= 95 ? 'GOOD' : rate >= 85 ? 'WARNING' : 'CRITICAL',
        // Naming the denominator on the tile itself: this is NOT "% tiết đúng
        // giờ", and a principal quoting it at a meeting must not be ambushed.
        detail: `Trên ${teachingStaff} giáo viên đang hoạt động`,
      };
    },
  },
  {
    key: 'staff.attendance_open',
    label: 'Ghi nhận nền nếp chưa kết luận',
    group: 'STAFF',
    linkTab: 'attendance',
    resolve: ctx =>
      countOutcome(
        ctx.attendance.filter(r => r.status === 'RECORDED' || r.status === 'EXPLAINED').length,
        { warnAt: 3, emptyNote: 'Không còn ghi nhận nào chờ kết luận' }
      ),
  },
  {
    key: 'staff.teaching_now',
    label: 'Giáo viên đang lên lớp',
    group: 'STAFF',
    resolve: null,
    plannedNote: 'Cần nhập thời khóa biểu toàn trường',
  },

  // ---------------- Công việc ----------------
  {
    key: 'work.due_soon',
    label: 'Công việc sắp đến hạn',
    group: 'WORK',
    linkTab: 'task',
    resolve: ctx => {
      const horizon = new Date(ctx.now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const dueSoon = ctx.tasks.filter(t => {
        if (t.status === 'COMPLETED' || isTaskOverdue(t, ctx.now)) return false;
        const deadline = parseDeadline(t.deadline);
        return !!deadline && deadline <= horizon;
      });
      return countOutcome(dueSoon.length, {
        warnAt: 5,
        criticalAt: 15,
        emptyNote: 'Không có việc nào đến hạn trong 3 ngày tới',
        detail: 'Đến hạn trong 3 ngày tới',
      });
    },
  },
  {
    key: 'work.in_progress',
    label: 'Công việc đang thực hiện',
    group: 'WORK',
    linkTab: 'task',
    resolve: ctx => {
      const active = ctx.tasks.filter(
        t => t.status === 'ASSIGNED' || t.status === 'VIEWED' || t.status === 'IN_PROGRESS'
      ).length;
      if (active === 0) {
        return { state: 'EMPTY', note: 'Không có nhiệm vụ nào đang triển khai', zeroIsMeaningful: true };
      }
      // Work in flight is neither good nor bad news — it is just the load.
      return { state: 'READY', value: active, unit: 'COUNT', tone: 'NEUTRAL' };
    },
  },
  {
    key: 'work.overdue',
    label: 'Công việc quá hạn',
    group: 'WORK',
    linkTab: 'task',
    resolve: ctx =>
      countOutcome(ctx.tasks.filter(t => isTaskOverdue(t, ctx.now)).length, {
        warnAt: 1,
        criticalAt: 5,
        emptyNote: 'Không có việc nào quá hạn',
      }),
  },
  {
    key: 'work.pending_approval',
    label: 'Công việc chờ duyệt hoàn thành',
    group: 'WORK',
    linkTab: 'task',
    resolve: ctx =>
      countOutcome(ctx.tasks.filter(t => t.status === 'PENDING_APPROVAL').length, {
        warnAt: 5,
        emptyNote: 'Không có việc nào chờ nghiệm thu',
      }),
  },
  {
    key: 'work.completed_today',
    label: 'Công việc hoàn thành hôm nay',
    group: 'WORK',
    linkTab: 'task',
    resolve: ctx => {
      // `updatedAt` is written from `toISOString()`, so it must be compared
      // against the UTC day, not the local one.
      const done = ctx.tasks.filter(
        t => t.status === 'COMPLETED' && (t.updatedAt ?? '').slice(0, 10) === ctx.todayUtc
      ).length;
      if (done === 0) {
        return { state: 'EMPTY', note: 'Chưa có việc nào hoàn thành hôm nay', zeroIsMeaningful: true };
      }
      return { state: 'READY', value: done, unit: 'COUNT', tone: 'GOOD' };
    },
  },

  // ---------------- Chuyên môn ----------------
  {
    key: 'professional.records_missing',
    label: 'Hồ sơ chuyên môn chưa nộp',
    group: 'PROFESSIONAL',
    resolve: null,
    plannedNote: 'Cần module hồ sơ chuyên môn',
  },
  {
    key: 'professional.lesson_plans_unapproved',
    label: 'Giáo án chưa duyệt',
    group: 'PROFESSIONAL',
    resolve: null,
    plannedNote: 'Cần module giáo án',
  },
  {
    // Deliberately "chưa chốt", not "chưa ký": there is no signature feature,
    // and a tile that claims one would be promising something that does not
    // exist.
    key: 'professional.minutes_outstanding',
    label: 'Biên bản họp chưa chốt',
    group: 'PROFESSIONAL',
    linkTab: 'meetings',
    resolve: ctx =>
      countOutcome(ctx.meetings.filter(isMinutesOutstanding).length, {
        warnAt: 1,
        criticalAt: 3,
        emptyNote: 'Mọi cuộc họp đã có biên bản',
      }),
  },
  {
    key: 'professional.makeups_pending',
    label: 'Đăng ký dạy bù chờ duyệt',
    group: 'PROFESSIONAL',
    linkTab: 'lessons',
    resolve: ctx =>
      countOutcome(ctx.makeups.filter(m => m.status === 'IN_REVIEW').length, {
        warnAt: 3,
        emptyNote: 'Không có đăng ký dạy bù nào chờ duyệt',
      }),
  },
  {
    key: 'professional.dept_plan_progress',
    label: 'Tiến độ kế hoạch tổ chuyên môn',
    group: 'PROFESSIONAL',
    linkTab: 'plans',
    resolve: ctx => {
      const deptPlans = ctx.plans.filter(p => p.scope === 'DEPARTMENT');
      const progress = aggregateProgress(deptPlans, ctx.today);
      if (progress.percent === null) {
        return { state: 'EMPTY', note: 'Chưa có mốc kế hoạch tổ nào để đo' };
      }
      return {
        state: 'READY',
        value: progress.percent,
        unit: 'PERCENT',
        tone: progress.percent >= 80 ? 'GOOD' : progress.percent >= 50 ? 'WARNING' : 'CRITICAL',
        detail:
          progress.overdue > 0
            ? `${progress.done}/${progress.total} mốc · ${progress.overdue} mốc trễ`
            : `${progress.done}/${progress.total} mốc hoàn thành`,
      };
    },
  },

  // ---------------- Học sinh ----------------
  {
    key: 'student.present_today',
    label: 'Tỷ lệ đi học hôm nay',
    group: 'STUDENT',
    linkTab: 'hoc-sinh',
    resolve: ctx => {
      const stats = summariseDay(ctx.studentAttendance, ctx.today);
      const activeClasses = ctx.classes.filter(c => c.isActive).length;

      // "Chưa điểm danh" and "everyone is here" are completely different
      // situations. Reporting 100% for a day nobody has taken the register
      // would be the most dangerous number on this screen.
      if (stats.classesRecorded === 0 || stats.presentRate === null) {
        const weekendNote = isSunday(ctx.today) ? 'Chủ Nhật (ngày nghỉ)' : 'Cuối tuần (ngày nghỉ)';
        return {
          state: 'EMPTY',
          note: activeClasses === 0
            ? 'Chưa có lớp nào trong danh mục'
            : isWeekend(ctx.today)
            ? weekendNote
            : 'Chưa lớp nào điểm danh hôm nay',
        };
      }

      return {
        state: 'READY',
        value: stats.presentRate,
        unit: 'PERCENT',
        tone: stats.presentRate >= 98 ? 'GOOD' : stats.presentRate >= 95 ? 'WARNING' : 'CRITICAL',
        detail: `${stats.classesRecorded}/${activeClasses} lớp đã điểm danh · ${stats.presentCount} có mặt`,
      };
    },
  },
  {
    key: 'student.absent_today',
    label: 'Học sinh nghỉ học hôm nay',
    group: 'STUDENT',
    linkTab: 'hoc-sinh',
    resolve: ctx => {
      const stats = summariseDay(ctx.studentAttendance, ctx.today);
      if (stats.classesRecorded === 0) {
        const weekendNote = isSunday(ctx.today) ? 'Chủ Nhật (ngày nghỉ)' : 'Cuối tuần (ngày nghỉ)';
        return {
          state: 'EMPTY',
          note: isWeekend(ctx.today) ? weekendNote : 'Chưa lớp nào điểm danh hôm nay',
        };
      }
      return countOutcome(stats.absentCount, {
        warnAt: 5,
        criticalAt: 15,
        emptyNote: 'Hôm nay không em nào nghỉ học',
        // Unexcused absence is what actually needs chasing, so it is named
        // separately rather than buried in a single "absent" figure.
        detail: stats.unexcusedCount > 0
          ? `${stats.unexcusedCount} em nghỉ KHÔNG phép`
          : 'Tất cả đều có phép',
      });
    },
  },
  {
    key: 'student.rolls_missing',
    label: 'Lớp chưa điểm danh hôm nay',
    group: 'STUDENT',
    linkTab: 'hoc-sinh',
    resolve: ctx => {
      const activeClassIds = ctx.classes.filter(c => c.isActive).map(c => c.id);
      if (activeClassIds.length === 0) {
        return { state: 'EMPTY', note: 'Chưa có lớp nào trong danh mục' };
      }
      const stats = summariseDay(ctx.studentAttendance, ctx.today);
      if (stats.classesRecorded === 0 && isWeekend(ctx.today)) {
        const weekendNote = isSunday(ctx.today)
          ? 'Chủ Nhật (ngày nghỉ) — không có lịch điểm danh'
          : 'Cuối tuần (ngày nghỉ) — không có lịch điểm danh';
        return { state: 'EMPTY', note: weekendNote };
      }
      const missing = classesMissingRoll(ctx.studentAttendance, ctx.today, activeClassIds);
      return countOutcome(missing.length, {
        warnAt: 1,
        criticalAt: Math.max(2, Math.ceil(activeClassIds.length / 2)),
        emptyNote: 'Mọi lớp đã điểm danh',
        detail: `Trên tổng số ${activeClassIds.length} lớp`,
      });
    },
  },
  {
    key: 'student.discipline',
    label: 'Vi phạm kỷ luật (tháng này)',
    group: 'STUDENT',
    linkTab: 'hoc-sinh',
    resolve: ctx => {
      const month = ctx.today.slice(0, 7);
      const records = conductInMonth(ctx.conduct, month);
      return countOutcome(records.filter(r => r.kind === 'VIOLATION').length, {
        warnAt: 10,
        criticalAt: 30,
        emptyNote: 'Tháng này chưa có vi phạm nào',
      });
    },
  },
  {
    key: 'student.commendations',
    label: 'Khen thưởng (tháng này)',
    group: 'STUDENT',
    linkTab: 'hoc-sinh',
    resolve: ctx => {
      const month = ctx.today.slice(0, 7);
      const count = conductInMonth(ctx.conduct, month).filter(r => r.kind === 'COMMENDATION').length;
      if (count === 0) return { state: 'EMPTY', note: 'Tháng này chưa ghi nhận khen thưởng nào' };
      return { state: 'READY', value: count, unit: 'COUNT', tone: 'GOOD' };
    },
  },
  {
    key: 'student.needs_support',
    label: 'Học sinh cần hỗ trợ',
    group: 'STUDENT',
    linkTab: 'hoc-sinh',
    resolve: ctx => {
      const count = studentsNeedingSupport(ctx.students).length;
      if (count === 0) return { state: 'EMPTY', note: 'Chưa đánh dấu em nào cần hỗ trợ' };
      // Never red: these children are a responsibility to attend to, not a
      // problem indicator, and colouring them like an alert would be wrong.
      return { state: 'READY', value: count, unit: 'COUNT', tone: 'INFO' };
    },
  },
  {
    key: 'student.gifted_programs',
    label: 'Đội tuyển HSG đang bồi dưỡng',
    group: 'STUDENT',
    linkTab: 'boi-duong-hsg',
    resolve: ctx => {
      const activePrograms = (ctx.giftedPrograms ?? []).filter(p => p.status === 'IN_PROGRESS');
      if (activePrograms.length === 0) {
        return { state: 'EMPTY', note: 'Chưa có đội tuyển HSG nào đang triển khai', zeroIsMeaningful: true };
      }
      const totalLessons = activePrograms.reduce((sum, p) => sum + p.lessons.length, 0);
      const completedLessons = activePrograms.reduce(
        (sum, p) => sum + p.lessons.filter(l => l.status === 'COMPLETED').length,
        0
      );
      const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      return {
        state: 'READY',
        value: activePrograms.length,
        unit: 'COUNT',
        tone: 'GOOD',
        detail: `${completedLessons}/${totalLessons} tiết đã học (${progressPercent}%)`,
      };
    },
  },

  // ---------------- Cơ sở vật chất ----------------
  {
    key: 'facility.rooms_booked_today',
    label: 'Phòng chức năng đang dùng hôm nay',
    group: 'FACILITY',
    linkTab: 'lessons',
    resolve: ctx => {
      // A room held by a make-up lesson is just as unavailable as one held by a
      // booking; counting only bookings would understate usage.
      const busyRoomIds = new Set<string>();
      for (const booking of ctx.bookings) {
        if (booking.slot?.date === ctx.today && BOOKING_ACTIVE_STATUSES.includes(booking.status)) {
          busyRoomIds.add(booking.roomId);
        }
      }
      for (const makeup of ctx.makeups) {
        if (
          makeup.roomId &&
          makeup.makeupSlot?.date === ctx.today &&
          (makeup.status === 'APPROVED' || makeup.status === 'COMPLETED')
        ) {
          busyRoomIds.add(makeup.roomId);
        }
      }

      const activeRooms = ctx.rooms.filter(r => r.isActive).length;
      if (busyRoomIds.size === 0) {
        return {
          state: 'EMPTY',
          note: activeRooms === 0 ? 'Chưa có phòng nào trong danh mục' : 'Hôm nay chưa phòng nào được đặt',
        };
      }
      return {
        state: 'READY',
        value: busyRoomIds.size,
        unit: 'COUNT',
        tone: 'INFO',
        detail: activeRooms > 0 ? `Trên tổng số ${activeRooms} phòng` : undefined,
      };
    },
  },
  {
    key: 'facility.bookings_pending',
    label: 'Đăng ký phòng chờ duyệt',
    group: 'FACILITY',
    linkTab: 'lessons',
    resolve: ctx =>
      countOutcome(ctx.bookings.filter(b => b.status === 'IN_REVIEW').length, {
        warnAt: 2,
        emptyNote: 'Không có đăng ký phòng nào chờ duyệt',
      }),
  },
  {
    key: 'facility.equipment_borrowed',
    label: 'Thiết bị đang mượn',
    group: 'FACILITY',
    linkTab: 'lessons',
    resolve: ctx => {
      const units = totalOnLoan(ctx.loans);
      const late = overdueLoans(ctx.loans, ctx.today).length;
      if (units === 0) {
        return { state: 'EMPTY', note: 'Không có thiết bị nào đang được mượn', zeroIsMeaningful: true };
      }
      return {
        state: 'READY',
        value: units,
        unit: 'COUNT',
        // Kit being out is normal; kit being out LATE is not.
        tone: late > 0 ? 'WARNING' : 'INFO',
        detail: late > 0 ? `${late} phiếu đã quá hạn trả` : undefined,
      };
    },
  },
  {
    key: 'facility.equipment_overdue',
    label: 'Phiếu mượn quá hạn trả',
    group: 'FACILITY',
    linkTab: 'lessons',
    resolve: ctx =>
      countOutcome(overdueLoans(ctx.loans, ctx.today).length, {
        warnAt: 1,
        criticalAt: 3,
        emptyNote: 'Không có phiếu mượn nào quá hạn',
      }),
  },
  {
    key: 'facility.equipment_faulty',
    label: 'Thiết bị hỏng / cần sửa',
    group: 'FACILITY',
    linkTab: 'config',
    resolve: ctx => {
      const faulty = faultyEquipment(ctx.equipment);
      const unitsOut = faulty.reduce((sum, item) => sum + (item.outOfServiceQuantity ?? 0), 0);
      return countOutcome(faulty.length, {
        warnAt: 1,
        criticalAt: 4,
        emptyNote: 'Không có thiết bị nào đang hỏng',
        detail: unitsOut > 0 ? `${unitsOut} cái đang ngừng sử dụng` : undefined,
      });
    },
  },
  {
    key: 'facility.loans_pending',
    label: 'Yêu cầu mượn chờ duyệt',
    group: 'FACILITY',
    linkTab: 'lessons',
    resolve: ctx =>
      countOutcome(ctx.loans.filter(l => l.status === 'REQUESTED').length, {
        warnAt: 2,
        emptyNote: 'Không có yêu cầu mượn nào chờ duyệt',
      }),
  },

  // ---------------- Điều hành ----------------
  {
    key: 'operation.on_time_rate',
    label: 'Tỷ lệ hoàn thành đúng hạn',
    group: 'OPERATION',
    linkTab: 'stats',
    resolve: ctx => {
      const rate = onTimeCompletionRate(ctx.tasks);
      if (rate === null) return { state: 'EMPTY', note: 'Chưa có việc nào hoàn thành để tính' };
      return {
        state: 'READY',
        value: rate,
        unit: 'PERCENT',
        tone: rate >= 90 ? 'GOOD' : rate >= 70 ? 'WARNING' : 'CRITICAL',
        detail: 'Trên tổng số việc đã nghiệm thu',
      };
    },
  },
  {
    key: 'operation.year_plan_progress',
    label: 'Tiến độ kế hoạch năm học',
    group: 'OPERATION',
    linkTab: 'plans',
    resolve: ctx => {
      const schoolPlans = ctx.plans.filter(p => p.scope === 'SCHOOL');
      const progress = aggregateProgress(schoolPlans, ctx.today);
      if (progress.percent === null) {
        return { state: 'EMPTY', note: 'Chưa có kế hoạch nhà trường nào có mốc' };
      }
      return {
        state: 'READY',
        value: progress.percent,
        unit: 'PERCENT',
        tone: progress.percent >= 80 ? 'GOOD' : progress.percent >= 50 ? 'WARNING' : 'CRITICAL',
        // Progress is milestones delivered, never days elapsed — see planProgress.
        detail: `${progress.done}/${progress.total} mốc hoàn thành`,
      };
    },
  },
  {
    key: 'operation.plan_milestones_overdue',
    label: 'Mốc kế hoạch đã trễ',
    group: 'OPERATION',
    linkTab: 'plans',
    resolve: ctx => {
      const progress = aggregateProgress(ctx.plans, ctx.today);
      return countOutcome(progress.overdue, {
        warnAt: 1,
        criticalAt: 5,
        emptyNote: 'Không có mốc kế hoạch nào trễ hạn',
      });
    },
  },
];

// --- Lookup helpers --------------------------------------------------------

export function metricsByGroup(group: MetricGroup): MetricDefinition[] {
  return METRIC_DEFINITIONS.filter(m => m.group === group);
}

export function resolveMetric(definition: MetricDefinition, ctx: MetricContext): MetricOutcome {
  if (!definition.resolve) {
    return {
      state: 'NOT_AVAILABLE',
      note: definition.plannedNote ?? 'Chưa có nguồn dữ liệu',
    };
  }
  try {
    return definition.resolve(ctx);
  } catch (err) {
    // One malformed record must not blank the whole operations screen.
    console.error(`Metric "${definition.key}" failed:`, err);
    return { state: 'NOT_AVAILABLE', note: 'Lỗi khi tính chỉ số' };
  }
}

/** Share of declared indicators that can actually be computed today. */
export function metricCoverage(): { ready: number; total: number } {
  return {
    ready: METRIC_DEFINITIONS.filter(m => m.resolve).length,
    total: METRIC_DEFINITIONS.length,
  };
}
