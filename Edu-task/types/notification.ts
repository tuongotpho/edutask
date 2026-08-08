export interface AppNotification {
  id: string;
  recipientUserId: string;
  /**
   * Who raised it. Enforced by rules to match the caller, so a notification is
   * always traceable to an account.
   *
   * Every feature writes notifications from an ordinary user's browser — a
   * teacher filing leave notifies their tổ trưởng — so "only admins may create"
   * was never an option. Attribution is what remains: it does not stop someone
   * sending "Bạn bị đình chỉ công tác" to a colleague, but it does mean nobody
   * can do it anonymously.
   *
   * `SYSTEM` is written by Cloud Functions, which use the Admin SDK and bypass
   * rules.
   */
  createdById: string;
  createdByName: string;
  title: string;
  message: string;
  type: 'LEAVE_REQUEST' | 'LEAVE_APPROVAL' | 'TASK_ASSIGNED' | 'TASK_DUE_SOON' | 'EXTENSION_REQUEST' | 'SYSTEM';
  linkUrl?: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * A notification before the sender is stamped on it.
 *
 * Call sites build one of these; each hook's `pushNotification` helper adds
 * `createdById` / `createdByName` from the signed-in user. Keeping the stamp in
 * one place per hook — rather than at all eighteen call sites — is what makes
 * it impossible for a new feature to forget it and be rejected by the rules.
 */
export type NotificationDraft = Omit<AppNotification, 'createdById' | 'createdByName'>;
