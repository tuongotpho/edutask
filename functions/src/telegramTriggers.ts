import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { notifyTelegram, telegramMessages } from './telegram';
import { LEAVE_TYPE_LABELS } from './shared/types/leave';
import { TASK_PRIORITY_CONFIG } from './shared/types/task';
import type { LeaveRequest } from './shared/types/leave';
import type { Task } from './shared/types/task';

/**
 * Group announcements, driven by Firestore rather than by the browser.
 *
 * These reproduce exactly what the client used to send — same events, same
 * wording — with one meaningful difference: the bot token never leaves the
 * server. See `telegram.ts` for why that mattered.
 *
 * A second, quieter benefit: the announcement now fires on the DOCUMENT, not
 * on a code path. Before, a leave created by any route that did not go through
 * `createLeaveRequest` would silently skip the announcement.
 */

const REGION = 'asia-southeast1';
const DATABASE = 'edutask';

export const onLeaveCreatedTelegram = onDocumentCreated(
  { document: 'leaves/{leaveId}', database: DATABASE, region: REGION },
  async event => {
    const leave = event.data?.data() as LeaveRequest | undefined;
    if (!leave) return;

    await notifyTelegram('LEAVE_CREATED', telegramMessages.leaveCreated({
      applicantName: leave.applicantName ?? 'Giáo viên',
      departmentName: leave.departmentName ?? '',
      leaveTypeLabel: LEAVE_TYPE_LABELS[leave.leaveType]?.label ?? String(leave.leaveType ?? ''),
      startDate: leave.startDate ?? '',
      endDate: leave.endDate ?? '',
      totalDays: leave.totalDays ?? 0,
      reason: leave.reason ?? '',
    }));

    logger.info(`Telegram: leave ${leave.code ?? event.params.leaveId} announced`);
  }
);

export const onLeaveDecidedTelegram = onDocumentUpdated(
  { document: 'leaves/{leaveId}', database: DATABASE, region: REGION },
  async event => {
    const before = event.data?.before.data() as LeaveRequest | undefined;
    const after = event.data?.after.data() as LeaveRequest | undefined;
    if (!before || !after) return;

    // Only announce an actual decision. Editing a reason, attaching a file or
    // reassigning cover all rewrite the document too, and announcing those
    // would turn the group chat into a change log nobody reads.
    const stepsAdvanced = countDecided(after.steps) > countDecided(before.steps);
    const statusSettled =
      before.overallStatus !== after.overallStatus &&
      ['APPROVED', 'REJECTED', 'REQUEST_EDIT'].includes(after.overallStatus);

    if (!stepsAdvanced && !statusSettled) return;

    const decisionLabel =
      after.overallStatus === 'APPROVED' ? 'ĐÃ DUYỆT HOÀN TẤT'
        : after.overallStatus === 'REJECTED' ? 'BỊ TỪ CHỐI'
          : after.overallStatus === 'REQUEST_EDIT' ? 'YÊU CẦU CHỈNH SỬA'
            : 'đã qua một cấp duyệt';

    // The step that just moved is the last one carrying a decision.
    const decidedStep = [...(after.steps ?? [])]
      .reverse()
      .find(step => step.status === 'APPROVED' || step.status === 'REJECTED');

    await notifyTelegram('LEAVE_DECIDED', telegramMessages.leaveDecided({
      applicantName: after.applicantName ?? 'Giáo viên',
      decisionLabel,
      stepLabel: decidedStep?.levelLabel ?? 'Người duyệt',
      approverName: decidedStep?.approverName ?? 'Người duyệt',
      comment: decidedStep?.comment,
    }));

    logger.info(`Telegram: leave ${after.code ?? event.params.leaveId} → ${decisionLabel}`);
  }
);

function countDecided(steps: LeaveRequest['steps'] | undefined): number {
  return (steps ?? []).filter(s => s.status === 'APPROVED' || s.status === 'REJECTED').length;
}

export const onTaskCreatedTelegram = onDocumentCreated(
  { document: 'tasks/{taskId}', database: DATABASE, region: REGION },
  async event => {
    const task = event.data?.data() as Task | undefined;
    if (!task) return;

    const assignees = task.assignees ?? [];

    await notifyTelegram('TASK_ASSIGNED', telegramMessages.taskAssigned({
      title: task.title ?? '',
      assignerName: task.assignerName ?? '',
      assigneeSummary: assignees.length > 0
        ? assignees.map(a => a.userName).join(', ')
        : 'Chưa có người nhận',
      deadline: task.deadline ?? '',
      priorityLabel: TASK_PRIORITY_CONFIG[task.priority]?.label ?? String(task.priority ?? ''),
    }));

    logger.info(`Telegram: task ${task.code ?? event.params.taskId} announced`);
  }
);
