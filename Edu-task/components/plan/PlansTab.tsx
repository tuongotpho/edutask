'use client';

import React, { useMemo, useState } from 'react';
import {
  Archive,
  BellRing,
  Check,
  ChevronDown,
  ChevronRight,
  ListChecks,
  PlusCircle,
  Power,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import { MILESTONE_STATUS_LABELS, MilestoneStatus, Plan, PLAN_SCOPE_LABELS } from '@/Edu-task/types/plan';
import {
  RECURRENCE_KINDS,
  RECURRENCE_LABELS,
  REMINDER_AUDIENCE_LABELS,
  ReminderAudience,
  RecurrenceKind,
  WEEKDAY_LABELS,
} from '@/Edu-task/types/reminder';
import { formatDateVi, toDateString } from '@/Edu-task/lib/schedule';
import { aggregateProgress, planProgress, visiblePlans } from '@/Edu-task/lib/planProgress';
import { describeRecurrence, nextOccurrence } from '@/Edu-task/lib/reminderSchedule';
import { canManageReminders, isSchoolLeadership, reminderScopeFor } from '@/Edu-task/lib/permissions';
import { DueSoonPanel } from './DueSoonPanel';

/**
 * Kế hoạch & Nhắc việc.
 *
 * Three views because they answer three different questions: what are we
 * working towards (plans), what will the system chase us about (schedules), and
 * what do I need to do this week (due soon). The last is what most people open
 * this tab for, so it is the default.
 */

type SubView = 'due' | 'plans' | 'reminders';

const inputClass =
  'w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

export function PlansTab() {
  const {
    currentUser, activeRole, plans, reminders, users,
    createPlan, archivePlan, deletePlan,
    addMilestone, setMilestoneStatus, removeMilestone,
    createReminder, toggleReminder, deleteReminder,
    showToast,
  } = useApp();

  const today = toDateString(new Date());
  const canManage = canManageReminders(currentUser, activeRole);
  const allowedScope = reminderScopeFor(currentUser, activeRole);
  const seesEverything = isSchoolLeadership(currentUser, activeRole);

  const [subView, setSubView] = useState<SubView>('due');
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [isPlanFormOpen, setIsPlanFormOpen] = useState(false);
  const [isReminderFormOpen, setIsReminderFormOpen] = useState(false);

  const myPlans = useMemo(
    () => visiblePlans(plans, { departmentId: currentUser?.departmentId, seesEverything })
      .filter(p => !p.isArchived),
    [plans, currentUser, seesEverything]
  );
  const overall = useMemo(() => aggregateProgress(myPlans, today), [myPlans, today]);

  const tabs: Array<{ id: SubView; label: string; icon: typeof Target }> = [
    { id: 'due', label: 'Sắp Đến Hạn', icon: BellRing },
    { id: 'plans', label: 'Kế Hoạch & Tiến Độ', icon: Target },
    { id: 'reminders', label: 'Lịch Nhắc', icon: ListChecks },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[5px] border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Kế Hoạch &amp; Nhắc Việc</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mốc tiến độ kế hoạch của tổ và của trường, lịch nhắc định kỳ, và những việc sắp đến hạn.
            </p>
          </div>
          {overall.percent !== null && (
            <div className="px-3 py-2 rounded-2xl bg-indigo-50 border border-indigo-200 text-center">
              <div className="text-xl font-extrabold text-indigo-900">{overall.percent}%</div>
              <div className="text-[10px] font-semibold text-indigo-700">
                {overall.done}/{overall.total} mốc hoàn thành
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = subView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubView(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {subView === 'due' && <DueSoonPanel personalOnly={!seesEverything} />}

      {subView === 'plans' && (
        <section className="space-y-3">
          {canManage && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsPlanFormOpen(!isPlanFormOpen)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tạo Kế Hoạch</span>
              </button>
            </div>
          )}

          {isPlanFormOpen && canManage && (
            <PlanForm
              allowedScope={allowedScope}
              onCancel={() => setIsPlanFormOpen(false)}
              onSubmit={async (data) => {
                if (await createPlan(data)) {
                  showToast('success', 'Đã tạo kế hoạch.');
                  setIsPlanFormOpen(false);
                }
              }}
            />
          )}

          {myPlans.length === 0 ? (
            <div className="bg-white rounded-[5px] border border-slate-200 p-10 text-center shadow-sm">
              <p className="text-xs text-slate-500">Chưa có kế hoạch nào.</p>
            </div>
          ) : (
            myPlans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                today={today}
                canManage={canManage}
                isExpanded={expandedPlanId === plan.id}
                onToggle={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                onAddMilestone={async (data) => {
                  if (await addMilestone(plan.id, data, users)) showToast('success', 'Đã thêm mốc kế hoạch.');
                }}
                onSetStatus={(milestoneId, status) => setMilestoneStatus(plan.id, milestoneId, status)}
                onRemoveMilestone={(milestoneId) => removeMilestone(plan.id, milestoneId)}
                onArchive={async () => {
                  if (await archivePlan(plan.id, true)) showToast('success', 'Đã lưu trữ kế hoạch.');
                }}
                onDelete={async () => {
                  if (await deletePlan(plan.id)) showToast('success', 'Đã xóa kế hoạch.');
                }}
              />
            ))
          )}
        </section>
      )}

      {subView === 'reminders' && (
        <section className="space-y-3">
          {canManage && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsReminderFormOpen(!isReminderFormOpen)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Cài Lịch Nhắc</span>
              </button>
            </div>
          )}

          {isReminderFormOpen && canManage && (
            <ReminderForm
              allowedScope={allowedScope}
              onCancel={() => setIsReminderFormOpen(false)}
              onSubmit={async (data) => {
                if (await createReminder(data)) {
                  showToast('success', 'Đã cài lịch nhắc.');
                  setIsReminderFormOpen(false);
                }
              }}
            />
          )}

          {reminders.length === 0 ? (
            <div className="bg-white rounded-[5px] border border-slate-200 p-10 text-center shadow-sm">
              <p className="text-xs text-slate-500">Chưa có lịch nhắc nào.</p>
            </div>
          ) : (
            reminders.map(reminder => {
              const next = nextOccurrence(reminder, today);
              return (
                <article
                  key={reminder.id}
                  className={`bg-white rounded-[5px] border p-4 shadow-sm ${
                    reminder.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{reminder.title}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          reminder.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {reminder.isActive ? 'Đang bật' : 'Đã tắt'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-50 text-slate-600 border-slate-200">
                          {reminder.scope === 'SCHOOL' ? 'Toàn trường' : reminder.departmentName ?? 'Tổ'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">{describeRecurrence(reminder)}</p>
                      <p className="text-[11px] text-slate-500">
                        Gửi tới: {REMINDER_AUDIENCE_LABELS[reminder.audience]}
                        {next ? ` · Lần tới: ${formatDateVi(next)}` : ' · Không còn lần nào'}
                      </p>
                      {reminder.message && (
                        <p className="text-[11px] text-slate-600 mt-1 italic">“{reminder.message}”</p>
                      )}
                    </div>

                    {canManage && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleReminder(reminder.id, !reminder.isActive)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center gap-1"
                        >
                          <Power className="w-3.5 h-3.5" />
                          {reminder.isActive ? 'Tắt' : 'Bật'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await deleteReminder(reminder.id)) showToast('success', 'Đã xóa lịch nhắc.');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}

          {/* Until the Cloud Function ships, be explicit about reach rather than
              letting people assume their phone will buzz. */}
          <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-[11px] text-sky-900">
            Hiện lịch nhắc hiển thị trong mục <strong>Sắp Đến Hạn</strong> và trong chuông thông báo
            khi mở ứng dụng. Để nhắc <strong>hiện lên màn hình điện thoại kể cả khi không mở app</strong>,
            cần bật thông báo đẩy — phần này đang được xây dựng.
          </div>
        </section>
      )}
    </div>
  );
}

// --- Plan card --------------------------------------------------------------

function PlanCard({
  plan, today, canManage, isExpanded, onToggle,
  onAddMilestone, onSetStatus, onRemoveMilestone, onArchive, onDelete,
}: {
  plan: Plan;
  today: string;
  canManage: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onAddMilestone: (data: { title: string; dueDate: string }) => void;
  onSetStatus: (milestoneId: string, status: MilestoneStatus) => void;
  onRemoveMilestone: (milestoneId: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const progress = planProgress(plan, today);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState(today);

  return (
    <article className="bg-white rounded-[5px] border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <button type="button" onClick={onToggle} className="w-full flex items-start gap-2 text-left">
          {isExpanded
            ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
            : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900">{plan.title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-50 text-slate-600 border-slate-200">
                {plan.scope === 'SCHOOL' ? PLAN_SCOPE_LABELS.SCHOOL : plan.departmentName ?? PLAN_SCOPE_LABELS.DEPARTMENT}
              </span>
              {progress.overdue > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200">
                  {progress.overdue} mốc trễ
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {formatDateVi(plan.startDate)} → {formatDateVi(plan.endDate)} · {plan.ownerName}
            </p>

            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    progress.percent === null ? 'bg-slate-200'
                      : progress.percent >= 80 ? 'bg-emerald-500'
                        : progress.percent >= 50 ? 'bg-amber-500'
                          : 'bg-rose-500'
                  }`}
                  style={{ width: `${progress.percent ?? 0}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-700 w-24 text-right flex-shrink-0">
                {progress.percent === null
                  ? 'chưa có mốc'
                  : `${progress.percent}% · ${progress.done}/${progress.total}`}
              </span>
            </div>
          </div>
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 p-4 space-y-2">
          {plan.milestones.length === 0 && (
            <p className="text-[11px] text-slate-500 text-center py-2">
              Kế hoạch chưa có mốc nào — tiến độ chưa đo được.
            </p>
          )}

          {plan.milestones.map(milestone => {
            const config = MILESTONE_STATUS_LABELS[milestone.status];
            const isLate = milestone.status !== 'DONE' && milestone.dueDate < today;
            return (
              <div
                key={milestone.id}
                className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border flex-wrap ${
                  isLate ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-slate-800">{milestone.title}</span>
                  <span className="block text-[10px] text-slate-500">
                    Hạn {formatDateVi(milestone.dueDate)}
                    {milestone.ownerName ? ` · ${milestone.ownerName}` : ''}
                    {isLate ? ' · đã trễ' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  {canManage
                    ? (['PENDING', 'IN_PROGRESS', 'DONE'] as MilestoneStatus[]).map(status => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => onSetStatus(milestone.id, status)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                            milestone.status === status
                              ? `${MILESTONE_STATUS_LABELS[status].bg} ${MILESTONE_STATUS_LABELS[status].color}`
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {MILESTONE_STATUS_LABELS[status].label}
                        </button>
                      ))
                    : (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => onRemoveMilestone(milestone.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                      aria-label={`Xóa mốc ${milestone.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {canManage && (
            <div className="flex flex-wrap items-end gap-2 pt-2">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Mốc mới</label>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Nộp kế hoạch chuyên môn tháng 9"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Hạn</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                disabled={!newTitle.trim()}
                onClick={() => {
                  onAddMilestone({ title: newTitle, dueDate: newDueDate });
                  setNewTitle('');
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" /> Thêm
              </button>
            </div>
          )}

          {canManage && (
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onArchive}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center gap-1"
              >
                <Archive className="w-3.5 h-3.5" /> Lưu trữ
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// --- Forms ------------------------------------------------------------------

function PlanForm({
  allowedScope, onCancel, onSubmit,
}: {
  allowedScope: 'SCHOOL' | 'DEPARTMENT' | null;
  onCancel: () => void;
  onSubmit: (data: { title: string; description?: string; scope: 'SCHOOL' | 'DEPARTMENT'; startDate: string; endDate: string }) => void;
}) {
  const today = toDateString(new Date());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'SCHOOL' | 'DEPARTMENT'>(allowedScope === 'SCHOOL' ? 'SCHOOL' : 'DEPARTMENT');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  return (
    <div className="bg-white rounded-[5px] border border-slate-200 p-5 shadow-sm space-y-3">
      <h3 className="text-sm font-bold text-slate-900">Kế Hoạch Mới</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">Tên kế hoạch *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Kế hoạch năm học 2026–2027" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Phạm vi</label>
          <select
            value={scope}
            onChange={e => setScope(e.target.value as 'SCHOOL' | 'DEPARTMENT')}
            className={inputClass}
          >
            {allowedScope === 'SCHOOL' && <option value="SCHOOL">{PLAN_SCOPE_LABELS.SCHOOL}</option>}
            <option value="DEPARTMENT">{PLAN_SCOPE_LABELS.DEPARTMENT}</option>
          </select>
          {allowedScope === 'DEPARTMENT' && (
            <p className="text-[10px] text-slate-400 mt-1">
              Chỉ Ban Giám Hiệu tạo được kế hoạch toàn trường.
            </p>
          )}
        </div>
        <div />
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Từ ngày</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Đến ngày</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inputClass} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5">
          <X className="w-4 h-4" /> Hủy
        </button>
        <button
          type="button"
          disabled={!title.trim()}
          onClick={() => onSubmit({ title, description, scope, startDate, endDate })}
          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5"
        >
          <Check className="w-4 h-4" /> Tạo Kế Hoạch
        </button>
      </div>
    </div>
  );
}

function ReminderForm({
  allowedScope, onCancel, onSubmit,
}: {
  allowedScope: 'SCHOOL' | 'DEPARTMENT' | null;
  onCancel: () => void;
  onSubmit: (data: {
    title: string; message?: string;
    scope: 'SCHOOL' | 'DEPARTMENT'; audience: ReminderAudience;
    recurrence: RecurrenceKind; date?: string; weekday?: number; dayOfMonth?: number;
    timeOfDay: string; startDate?: string; endDate?: string;
  }) => void;
}) {
  const today = toDateString(new Date());
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [scope, setScope] = useState<'SCHOOL' | 'DEPARTMENT'>(allowedScope === 'SCHOOL' ? 'SCHOOL' : 'DEPARTMENT');
  const [audience, setAudience] = useState<ReminderAudience>(
    allowedScope === 'SCHOOL' ? 'DEPT_LEADERS' : 'DEPARTMENT'
  );
  const [recurrence, setRecurrence] = useState<RecurrenceKind>('MONTHLY');
  const [date, setDate] = useState(today);
  const [weekday, setWeekday] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(25);
  const [timeOfDay, setTimeOfDay] = useState('07:30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // A department-scoped schedule can only reach that department; offering
  // "toàn trường" here would build a form whose submission the rules reject.
  const audienceOptions: ReminderAudience[] =
    scope === 'SCHOOL' ? ['ALL_STAFF', 'DEPT_LEADERS', 'CUSTOM'] : ['DEPARTMENT'];

  return (
    <div className="bg-white rounded-[5px] border border-slate-200 p-5 shadow-sm space-y-3">
      <h3 className="text-sm font-bold text-slate-900">Lịch Nhắc Mới</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung nhắc *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nhắc các tổ nộp kế hoạch tháng" className={inputClass} />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Phạm vi</label>
          <select
            value={scope}
            onChange={e => {
              const next = e.target.value as 'SCHOOL' | 'DEPARTMENT';
              setScope(next);
              setAudience(next === 'SCHOOL' ? 'DEPT_LEADERS' : 'DEPARTMENT');
            }}
            className={inputClass}
          >
            {allowedScope === 'SCHOOL' && <option value="SCHOOL">Toàn trường</option>}
            <option value="DEPARTMENT">Tổ của tôi</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Gửi tới</label>
          <select value={audience} onChange={e => setAudience(e.target.value as ReminderAudience)} className={inputClass}>
            {audienceOptions.map(option => (
              <option key={option} value={option}>{REMINDER_AUDIENCE_LABELS[option]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Lặp lại</label>
          <select value={recurrence} onChange={e => setRecurrence(e.target.value as RecurrenceKind)} className={inputClass}>
            {RECURRENCE_KINDS.map(kind => (
              <option key={kind} value={kind}>{RECURRENCE_LABELS[kind]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Giờ nhắc</label>
          <input type="time" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} className={inputClass} />
        </div>

        {recurrence === 'ONCE' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ngày nhắc</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
          </div>
        )}

        {recurrence === 'WEEKLY' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Thứ</label>
            <select value={weekday} onChange={e => setWeekday(Number(e.target.value))} className={inputClass}>
              {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {recurrence === 'MONTHLY' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ngày trong tháng</label>
            <input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={e => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
              className={inputClass}
            />
            {dayOfMonth > 28 && (
              <p className="text-[10px] text-amber-700 mt-1">
                Tháng ngắn hơn sẽ nhắc vào ngày cuối tháng.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Bắt đầu từ (tùy chọn)</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Kết thúc (tùy chọn)</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">Lời nhắn kèm theo</label>
          <input value={message} onChange={e => setMessage(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5">
          <X className="w-4 h-4" /> Hủy
        </button>
        <button
          type="button"
          disabled={!title.trim()}
          onClick={() => onSubmit({
            title, message, scope, audience, recurrence,
            date, weekday, dayOfMonth, timeOfDay,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          })}
          className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5"
        >
          <Check className="w-4 h-4" /> Cài Lịch Nhắc
        </button>
      </div>
    </div>
  );
}
