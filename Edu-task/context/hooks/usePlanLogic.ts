import { MilestoneStatus, Plan, PlanMilestone, PlanScope } from '@/Edu-task/types/plan';
import { ReminderAudience, RecurrenceKind, ReminderSchedule } from '@/Edu-task/types/reminder';
import { User, RoleType } from '@/Edu-task/types/user';
import { genId } from '@/Edu-task/lib/utils';
import { currentSchoolId } from '@/Edu-task/lib/tenant';
import { canManageReminders, reminderScopeFor } from '@/Edu-task/lib/permissions';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

/**
 * Kế hoạch & lịch nhắc.
 *
 * The scope rule is enforced here as well as in `firestore.rules`: a tổ trưởng
 * may only create plans and reminder schedules for their own department. It
 * matters more for reminders than for plans — a school-wide schedule set by one
 * department leader would put their checklist on everyone else's phone, and
 * notification fatigue is how a reminder system stops being read.
 */

interface PlanLogicProps {
  currentUser: User | null;
  activeRole: RoleType;
  plans: Plan[];
  setPlans: React.Dispatch<React.SetStateAction<Plan[]>>;
  reminders: ReminderSchedule[];
  setReminders: React.Dispatch<React.SetStateAction<ReminderSchedule[]>>;
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được lên máy chủ. Thay đổi đã được hoàn tác — vui lòng thử lại.';

export interface PlanInput {
  title: string;
  description?: string;
  scope: PlanScope;
  startDate: string;
  endDate: string;
}

export interface MilestoneInput {
  title: string;
  dueDate: string;
  ownerId?: string;
  note?: string;
}

export interface ReminderInput {
  title: string;
  message?: string;
  scope: 'SCHOOL' | 'DEPARTMENT';
  audience: ReminderAudience;
  recipientIds?: string[];
  recurrence: RecurrenceKind;
  date?: string;
  weekday?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  startDate?: string;
  endDate?: string;
  planId?: string;
}

export function usePlanLogic({
  currentUser, activeRole, plans, setPlans, reminders, setReminders, notify,
}: PlanLogicProps) {

  const now = () => new Date().toISOString().replace('T', ' ').slice(0, 16);

  const commitPlan = async (next: Plan[], toSave: Plan): Promise<boolean> => {
    const previous = plans;
    setPlans(next);
    try {
      await firebaseService.savePlan(toSave);
      return true;
    } catch (err) {
      console.error('Failed to save plan:', err);
      setPlans(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const commitReminder = async (next: ReminderSchedule[], toSave: ReminderSchedule): Promise<boolean> => {
    const previous = reminders;
    setReminders(next);
    try {
      await firebaseService.saveReminder(toSave);
      return true;
    } catch (err) {
      console.error('Failed to save reminder:', err);
      setReminders(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  /** The widest scope this user may create, or null if they may create nothing. */
  const allowedScope = () => reminderScopeFor(currentUser, activeRole);

  // --- Plans ---------------------------------------------------------------

  const createPlan = async (data: PlanInput): Promise<Plan | null> => {
    if (!currentUser) throw new Error('User not logged in');

    const scope = allowedScope();
    if (!scope) {
      notify('error', 'Vai trò hiện tại không có quyền tạo kế hoạch.');
      return null;
    }
    if (data.scope === 'SCHOOL' && scope !== 'SCHOOL') {
      notify('error', 'Chỉ Ban Giám Hiệu mới tạo được kế hoạch toàn trường.');
      return null;
    }
    if (!data.title.trim()) {
      notify('error', 'Vui lòng nhập tên kế hoạch.');
      return null;
    }
    if (data.endDate < data.startDate) {
      notify('error', 'Ngày kết thúc phải sau ngày bắt đầu.');
      return null;
    }

    const timestamp = now();
    const plan: Plan = {
      id: genId('PLAN_2026'),
      schoolId: currentSchoolId(),
      code: `KH-2026-${Date.now().toString().slice(-6)}`,
      title: data.title.trim(),
      description: data.description?.trim() || undefined,
      scope: data.scope,
      departmentId: data.scope === 'DEPARTMENT' ? currentUser.departmentId : undefined,
      departmentName: data.scope === 'DEPARTMENT' ? currentUser.departmentName : undefined,
      startDate: data.startDate,
      endDate: data.endDate,
      milestones: [],
      ownerId: currentUser.id,
      ownerName: currentUser.fullName,
      isArchived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return (await commitPlan([...plans, plan], plan)) ? plan : null;
  };

  const updatePlan = async (id: string, data: Partial<PlanInput>): Promise<boolean> => {
    const target = plans.find(p => p.id === id);
    if (!target) return false;

    const updated: Plan = {
      ...target,
      title: data.title?.trim() ?? target.title,
      description: data.description?.trim() ?? target.description,
      startDate: data.startDate ?? target.startDate,
      endDate: data.endDate ?? target.endDate,
      updatedAt: now(),
    };

    return commitPlan(plans.map(p => (p.id === id ? updated : p)), updated);
  };

  const archivePlan = async (id: string, isArchived: boolean): Promise<boolean> => {
    const target = plans.find(p => p.id === id);
    if (!target) return false;
    const updated: Plan = { ...target, isArchived, updatedAt: now() };
    return commitPlan(plans.map(p => (p.id === id ? updated : p)), updated);
  };

  const deletePlan = async (id: string): Promise<boolean> => {
    const previous = plans;
    setPlans(plans.filter(p => p.id !== id));
    try {
      await firebaseService.deletePlan(id);
      return true;
    } catch (err) {
      console.error('Failed to delete plan:', err);
      setPlans(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  // --- Milestones (stored on the plan) -------------------------------------

  const addMilestone = async (planId: string, data: MilestoneInput, users: User[]): Promise<boolean> => {
    const target = plans.find(p => p.id === planId);
    if (!target) return false;
    if (!data.title.trim() || !data.dueDate) {
      notify('error', 'Mốc kế hoạch cần có tên và hạn hoàn thành.');
      return false;
    }

    const owner = data.ownerId ? users.find(u => u.id === data.ownerId) : undefined;
    const milestone: PlanMilestone = {
      id: genId('MS'),
      title: data.title.trim(),
      dueDate: data.dueDate,
      status: 'PENDING',
      ownerId: owner?.id,
      ownerName: owner?.fullName,
      note: data.note?.trim() || undefined,
    };

    const updated: Plan = {
      ...target,
      milestones: [...target.milestones, milestone].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      updatedAt: now(),
    };

    return commitPlan(plans.map(p => (p.id === planId ? updated : p)), updated);
  };

  const setMilestoneStatus = async (
    planId: string,
    milestoneId: string,
    status: MilestoneStatus
  ): Promise<boolean> => {
    const target = plans.find(p => p.id === planId);
    if (!target) return false;

    const timestamp = now();
    const updated: Plan = {
      ...target,
      milestones: target.milestones.map(m =>
        m.id === milestoneId
          ? {
              ...m,
              status,
              // Cleared when a milestone is reopened, so a reverted item does
              // not keep claiming it was finished.
              completedAt: status === 'DONE' ? timestamp : undefined,
            }
          : m
      ),
      updatedAt: timestamp,
    };

    return commitPlan(plans.map(p => (p.id === planId ? updated : p)), updated);
  };

  const removeMilestone = async (planId: string, milestoneId: string): Promise<boolean> => {
    const target = plans.find(p => p.id === planId);
    if (!target) return false;

    const updated: Plan = {
      ...target,
      milestones: target.milestones.filter(m => m.id !== milestoneId),
      updatedAt: now(),
    };

    return commitPlan(plans.map(p => (p.id === planId ? updated : p)), updated);
  };

  // --- Reminder schedules --------------------------------------------------

  const createReminder = async (data: ReminderInput): Promise<ReminderSchedule | null> => {
    if (!currentUser) throw new Error('User not logged in');

    const scope = allowedScope();
    if (!scope) {
      notify('error', 'Vai trò hiện tại không có quyền cài lịch nhắc.');
      return null;
    }
    if (data.scope === 'SCHOOL' && scope !== 'SCHOOL') {
      notify('error', 'Chỉ Ban Giám Hiệu mới cài được lịch nhắc toàn trường.');
      return null;
    }
    if (!data.title.trim()) {
      notify('error', 'Vui lòng nhập nội dung nhắc.');
      return null;
    }

    // A schedule with no trigger would sit in the list looking active and never
    // fire — worse than not creating it, because people would rely on it.
    if (data.recurrence === 'ONCE' && !data.date) {
      notify('error', 'Vui lòng chọn ngày nhắc.');
      return null;
    }
    if (data.recurrence === 'WEEKLY' && !data.weekday) {
      notify('error', 'Vui lòng chọn thứ trong tuần.');
      return null;
    }
    if (data.recurrence === 'MONTHLY' && !data.dayOfMonth) {
      notify('error', 'Vui lòng chọn ngày trong tháng.');
      return null;
    }

    const timestamp = now();
    const reminder: ReminderSchedule = {
      id: genId('RMD_2026'),
      schoolId: currentSchoolId(),
      title: data.title.trim(),
      message: data.message?.trim() || undefined,
      scope: data.scope,
      departmentId: data.scope === 'DEPARTMENT' ? currentUser.departmentId : undefined,
      departmentName: data.scope === 'DEPARTMENT' ? currentUser.departmentName : undefined,
      audience: data.audience,
      recipientIds: data.audience === 'CUSTOM' ? data.recipientIds : undefined,
      recurrence: data.recurrence,
      date: data.recurrence === 'ONCE' ? data.date : undefined,
      weekday: data.recurrence === 'WEEKLY' ? data.weekday : undefined,
      dayOfMonth: data.recurrence === 'MONTHLY' ? data.dayOfMonth : undefined,
      timeOfDay: data.timeOfDay,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      isActive: true,
      planId: data.planId,
      createdById: currentUser.id,
      createdByName: currentUser.fullName,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return (await commitReminder([...reminders, reminder], reminder)) ? reminder : null;
  };

  const toggleReminder = async (id: string, isActive: boolean): Promise<boolean> => {
    const target = reminders.find(r => r.id === id);
    if (!target || !currentUser) return false;

    if (!canManageReminders(currentUser, activeRole)) {
      notify('error', 'Vai trò hiện tại không có quyền thay đổi lịch nhắc.');
      return false;
    }

    const updated: ReminderSchedule = { ...target, isActive, updatedAt: now() };
    return commitReminder(reminders.map(r => (r.id === id ? updated : r)), updated);
  };

  const deleteReminder = async (id: string): Promise<boolean> => {
    const previous = reminders;
    setReminders(reminders.filter(r => r.id !== id));
    try {
      await firebaseService.deleteReminder(id);
      return true;
    } catch (err) {
      console.error('Failed to delete reminder:', err);
      setReminders(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  return {
    createPlan, updatePlan, archivePlan, deletePlan,
    addMilestone, setMilestoneStatus, removeMilestone,
    createReminder, toggleReminder, deleteReminder,
  };
}
