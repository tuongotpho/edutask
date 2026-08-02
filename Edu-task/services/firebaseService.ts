import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
  query,
  where,
  Query,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/Edu-task/lib/firebase';
import { User } from '@/Edu-task/types/user';
import { LeaveRequest } from '@/Edu-task/types/leave';
import { Task } from '@/Edu-task/types/task';
import { AppNotification } from '@/Edu-task/types/notification';
import { 
  INITIAL_USERS, 
  INITIAL_LEAVES, 
  INITIAL_TASKS, 
  INITIAL_NOTIFICATIONS 
} from '@/Edu-task/lib/storage';

// Helper to remove any undefined fields before sending to Firestore
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) return null as unknown as T;
  return JSON.parse(JSON.stringify(obj));
}

export const firebaseService = {
  // --- Seed initial data to Firestore if empty ---
  async seedInitialDataIfEmpty(): Promise<void> {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      if (usersSnap.empty) {
        for (const u of INITIAL_USERS) {
          await setDoc(doc(db, 'users', u.id), sanitizeForFirestore(u));
        }
      }

      const leavesSnap = await getDocs(collection(db, 'leaves'));
      if (leavesSnap.empty) {
        for (const l of INITIAL_LEAVES) {
          await setDoc(doc(db, 'leaves', l.id), sanitizeForFirestore(l));
        }
      }

      const tasksSnap = await getDocs(collection(db, 'tasks'));
      if (tasksSnap.empty) {
        for (const t of INITIAL_TASKS) {
          await setDoc(doc(db, 'tasks', t.id), sanitizeForFirestore(t));
        }
      }

      const notifsSnap = await getDocs(collection(db, 'notifications'));
      if (notifsSnap.empty) {
        for (const n of INITIAL_NOTIFICATIONS) {
          await setDoc(doc(db, 'notifications', n.id), sanitizeForFirestore(n));
        }
      }
    } catch (err) {
      console.error('Error seeding initial data to Firestore:', err);
    }
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

  async deleteTask(taskId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (e) {
      console.error('Error deleting task from Firebase:', e);
    }
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
  }
};
