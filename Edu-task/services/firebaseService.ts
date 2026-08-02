import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
  Unsubscribe,
  query,
  where,
  Query,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/Edu-task/lib/firebase';
import { sanitizeForFirestore } from '@/Edu-task/lib/utils';
import { User, Department } from '@/Edu-task/types/user';
import { LeaveRequest } from '@/Edu-task/types/leave';
import { Task } from '@/Edu-task/types/task';
import { AppNotification } from '@/Edu-task/types/notification';

export const firebaseService = {
  // --- Departments (shared config: must live server-side so every device and
  // every user sees the same list, not just whoever created it) ---
  subscribeDepartments(onUpdate: (departments: Department[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'departments'), (snapshot) => {
      const departments: Department[] = [];
      snapshot.forEach((d) => departments.push(d.data() as Department));
      departments.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      onUpdate(departments);
    });
  },

  async saveDepartment(department: Department): Promise<void> {
    await setDoc(doc(db, 'departments', department.id), sanitizeForFirestore(department), { merge: true });
  },

  async deleteDepartment(departmentId: string): Promise<void> {
    await deleteDoc(doc(db, 'departments', departmentId));
  },

  // One-off migration of the built-in defaults the very first time this project
  // runs against an empty `departments` collection. Batched so it either lands
  // completely or not at all.
  async seedDepartments(departments: Department[]): Promise<void> {
    const batch = writeBatch(db);
    departments.forEach(d => {
      batch.set(doc(db, 'departments', d.id), sanitizeForFirestore(d));
    });
    await batch.commit();
  },

  // --- School settings ---
  subscribeSchoolName(onUpdate: (name: string | null) => void): Unsubscribe {
    return onSnapshot(doc(db, 'settings', 'school'), (snapshot) => {
      const data = snapshot.data();
      onUpdate(typeof data?.name === 'string' ? data.name : null);
    });
  },

  async saveSchoolName(name: string): Promise<void> {
    await setDoc(doc(db, 'settings', 'school'), { name }, { merge: true });
  },

  // --- Users ---
  subscribeUsers(onUpdate: (users: User[]) => void): Unsubscribe {
    // The users collection is small and needed everywhere (dropdowns to assign
    // tasks/leaves), so we fetch all of them.
    const q: Query<DocumentData> = collection(db, 'users');
    return onSnapshot(q, (snapshot) => {
      const users: User[] = [];
      snapshot.forEach((d) => users.push(d.data() as User));
      onUpdate(users);
    });
  },

  async saveUser(user: User): Promise<void> {
    await setDoc(doc(db, 'users', user.id), sanitizeForFirestore(user), { merge: true });
  },

  async deleteUser(userId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId));
  },

  // --- Leaves ---
  subscribeLeaves(onUpdate: (leaves: LeaveRequest[]) => void, filters?: { role?: string; deptId?: string; userId?: string }): Unsubscribe {
    let q: Query<DocumentData> = collection(db, 'leaves');

    // Applying basic frontend limits based on role to prevent massive fetches
    // Firestore security rules will enforce this on the backend
    if (filters) {
      if (filters.role === 'GROUP_LEADER' || filters.role === 'HEAD_OF_DEPT') {
        q = query(q, where('departmentId', '==', filters.deptId));
      } else if (filters.role === 'TEACHER') {
        q = query(q, where('applicantId', '==', filters.userId));
      }
    }

    return onSnapshot(q, (snapshot) => {
      const leaves: LeaveRequest[] = [];
      snapshot.forEach((d) => {
        leaves.push(d.data() as LeaveRequest);
      });
      leaves.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(leaves);
    });
  },

  async saveLeave(leave: LeaveRequest): Promise<void> {
    await setDoc(doc(db, 'leaves', leave.id), sanitizeForFirestore(leave), { merge: true });
  },

  async deleteLeave(leaveId: string): Promise<void> {
    await deleteDoc(doc(db, 'leaves', leaveId));
  },

  // --- Tasks ---
  subscribeTasks(onUpdate: (tasks: Task[]) => void, filters?: { role?: string; deptId?: string; userId?: string }): Unsubscribe {
    let q: Query<DocumentData> = collection(db, 'tasks');

    if (filters) {
      if (filters.role !== 'ADMIN' && filters.userId) {
        q = query(q, where('viewerIds', 'array-contains', filters.userId));
      }
    }

    return onSnapshot(q, (snapshot) => {
      const tasks: Task[] = [];
      snapshot.forEach((d) => {
        tasks.push(d.data() as Task);
      });
      tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(tasks);
    });
  },

  async saveTask(task: Task): Promise<void> {
    await setDoc(doc(db, 'tasks', task.id), sanitizeForFirestore(task), { merge: true });
  },

  // Write failures must propagate: callers roll back their optimistic update and
  // tell the user. Swallowing the error here would silently desync the UI.
  async deleteTask(taskId: string): Promise<void> {
    await deleteDoc(doc(db, 'tasks', taskId));
  },

  // --- Notifications ---
  subscribeNotifications(onUpdate: (notifs: AppNotification[]) => void, userId?: string): Unsubscribe {
    let q: Query<DocumentData> = collection(db, 'notifications');

    if (userId) {
      q = query(q, where('recipientUserId', '==', userId));
    }

    return onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      snapshot.forEach((d) => {
        notifs.push(d.data() as AppNotification);
      });
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(notifs);
    });
  },

  async saveNotification(notif: AppNotification): Promise<void> {
    await setDoc(doc(db, 'notifications', notif.id), sanitizeForFirestore(notif), { merge: true });
  },

  // Security rules only permit the recipient to touch `isRead`, so this is a
  // targeted update rather than a whole-document write.
  async markNotificationRead(notifId: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', notifId), { isRead: true });
  },

  async markAllNotificationsRead(notifIds: string[]): Promise<void> {
    if (notifIds.length === 0) return;
    const batch = writeBatch(db);
    notifIds.forEach(id => batch.update(doc(db, 'notifications', id), { isRead: true }));
    await batch.commit();
  }
};
