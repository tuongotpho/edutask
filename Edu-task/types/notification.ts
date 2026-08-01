export interface AppNotification {
  id: string;
  recipientUserId: string;
  title: string;
  message: string;
  type: 'LEAVE_REQUEST' | 'LEAVE_APPROVAL' | 'TASK_ASSIGNED' | 'TASK_DUE_SOON' | 'EXTENSION_REQUEST' | 'SYSTEM';
  linkUrl?: string;
  isRead: boolean;
  createdAt: string;
}
