/**
 * Approval primitives shared beyond leave requests.
 *
 * `ApprovalStep` and the history-log shape were designed for leave and turned
 * out to fit make-up classes and room bookings unchanged. They are re-exported
 * from here under names that do not say "leave", so new modules can use them
 * without either importing from a module they have nothing to do with, or
 * copying the shapes and letting them drift.
 */

import { ApprovalStatus, ApprovalStep, LeaveHistoryLog } from './leave';

export type { ApprovalStatus, ApprovalStep };

/** Identical to `LeaveHistoryLog`; the name no longer claims it is leave-only. */
export type HistoryLog = LeaveHistoryLog;
