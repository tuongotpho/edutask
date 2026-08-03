import { ApprovalStep, ApprovalStatus, LeaveType } from '@/Edu-task/types/leave';
import { RoleType } from '@/Edu-task/types/user';
import { WorkflowConfig, DEFAULT_WORKFLOW_CONFIG } from '@/Edu-task/types/settings';

const DEPT_STEP: ApprovalStep = {
  level: 'GROUP_LEADER' as RoleType,
  levelLabel: 'Nhóm trưởng / Tổ trưởng chuyên môn',
  status: 'PENDING' as ApprovalStatus,
};

const EXECUTIVE_STEP: ApprovalStep = {
  level: 'VICE_PRINCIPAL' as RoleType,
  levelLabel: 'Ban Giám Hiệu',
  status: 'PENDING' as ApprovalStatus,
};

/**
 * Decides whether a request needs executive sign-off on top of the department
 * leader. Short absences can be settled inside the department; anything longer,
 * or a leave type the school has flagged, still goes up to Ban Giám Hiệu.
 */
export function requiresExecutiveApproval(
  config: WorkflowConfig,
  leaveType: LeaveType,
  totalDays: number
): boolean {
  if (config.alwaysExecutiveTypes.includes(leaveType)) return true;
  // A non-positive threshold means "never settle at the department".
  if (config.deptOnlyMaxDays <= 0) return true;
  return totalDays > config.deptOnlyMaxDays;
}

/**
 * Builds the approval chain for a new request.
 *
 * Always returns at least the department step, so `steps[0]` is safe to read
 * and a misconfigured threshold can never produce a request nobody can approve.
 */
export function buildApprovalSteps(
  config: WorkflowConfig | null | undefined,
  leaveType: LeaveType,
  totalDays: number
): ApprovalStep[] {
  const effective = config ?? DEFAULT_WORKFLOW_CONFIG;
  const steps: ApprovalStep[] = [{ ...DEPT_STEP }];
  if (requiresExecutiveApproval(effective, leaveType, totalDays)) {
    steps.push({ ...EXECUTIVE_STEP });
  }
  return steps;
}

/** Human-readable summary of the configured flow, for the admin screen. */
export function describeWorkflow(config: WorkflowConfig): string {
  if (config.deptOnlyMaxDays <= 0) {
    return 'Mọi đơn đều qua 2 cấp: Nhóm/Tổ trưởng chuyên môn → Ban Giám Hiệu.';
  }
  const exceptions = config.alwaysExecutiveTypes.length > 0
    ? ' (trừ các loại nghỉ luôn cần BGH bên dưới)'
    : '';
  return `Đơn từ ${config.deptOnlyMaxDays} ngày trở xuống chỉ cần Nhóm/Tổ trưởng duyệt${exceptions}; đơn dài hơn phải trình Ban Giám Hiệu.`;
}
