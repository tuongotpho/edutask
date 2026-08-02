import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  Unsubscribe,
  query,
  where
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
        console.log('Seeding initial users to Firestore...');
        for (const u of INITIAL_USERS) {
          await setDoc(doc(db, 'users', u.id), sanitizeForFirestore(u));
        }
      }

      const leavesSnap = await getDocs(collection(db, 'leaves'));
      if (leavesSnap.empty) {
        console.log('Seeding initial leaves to Firestore...');
        for (const l of INITIAL_LEAVES) {
          await setDoc(doc(db, 'leaves', l.id), sanitizeForFirestore(l));
        }
      }

      const tasksSnap = await getDocs(collection(db, 'tasks'));
      if (tasksSnap.empty) {
        console.log('Seeding initial tasks to Firestore...');
        for (const t of INITIAL_TASKS) {
          await setDoc(doc(db, 'tasks', t.id), sanitizeForFirestore(t));
        }
      }

      const notifsSnap = await getDocs(collection(db, 'notifications'));
      if (notifsSnap.empty) {
        console.log('Seeding initial notifications to Firestore...');
        for (const n of INITIAL_NOTIFICATIONS) {
          await setDoc(doc(db, 'notifications', n.id), sanitizeForFirestore(n));
        }
      }
    } catch (err) {
      console.error('Error seeding initial data to Firestore:', err);
    }
  },

  // --- Users ---
  subscribeUsers(onUpdate: (users: User[]) => void, role?: string, deptId?: string): Unsubscribe {
    let q = collection(db, 'users') as any;
    // If not admin, we could limit, but users collection is small and needed for dropdowns
    // For now, we still fetch all users so the UI works (dropdowns to assign tasks/leaves)
    return onSnapshot(q, (snapshot: any) => {
      const users: User[] = [];
      snapshot.forEach((doc: any) => {
        users.push(doc.data() as User);
      });
      if (users.length > 0) {
        onUpdate(users);
      }
    });
  },

  async saveUser(user: User): Promise<void> {
    await setDoc(doc(db, 'users', user.id), sanitizeForFirestore(user), { merge: true });
  },

  async deleteUser(userId: string): Promise<void> {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'users', userId));
  },

  // --- Leaves ---
  subscribeLeaves(onUpdate: (leaves: LeaveRequest[]) => void, filters?: { role?: string; deptId?: string; userId?: string }): Unsubscribe {
    let q = collection(db, 'leaves') as any;
    
    // Applying basic frontend limits based on role to prevent massive fetches
    // Firestore security rules will enforce this on the backend
    if (filters) {
      if (filters.role === 'GROUP_LEADER' || filters.role === 'HEAD_OF_DEPT') {
        q = query(q, where('departmentId', '==', filters.deptId));
      } else if (filters.role === 'TEACHER') {
        q = query(q, where('applicantId', '==', filters.userId));
      }
    }

    return onSnapshot(q, (snapshot: any) => {
      const leaves: LeaveRequest[] = [];
      snapshot.forEach((doc: any) => {
        leaves.push(doc.data() as LeaveRequest);
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
    let q = collection(db, 'tasks') as any;
    
    if (filters) {
      if (filters.role !== 'ADMIN' && filters.userId) {
        q = query(q, where('viewerIds', 'array-contains', filters.userId));
      }
    }

    return onSnapshot(q, (snapshot: any) => {
      const tasks: Task[] = [];
      snapshot.forEach((doc: any) => {
        tasks.push(doc.data() as Task);
      });
      tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(tasks);
    });
  },

  async saveTask(task: Task): Promise<void> {
    await setDoc(doc(db, 'tasks', task.id), sanitizeForFirestore(task), { merge: true });
  },

  // --- Notifications ---
  subscribeNotifications(onUpdate: (notifs: AppNotification[]) => void, userId?: string): Unsubscribe {
    let q = collection(db, 'notifications') as any;
    
    if (userId) {
      q = query(q, where('recipientUserId', '==', userId));
    }

    return onSnapshot(q, (snapshot: any) => {
      const notifs: AppNotification[] = [];
      snapshot.forEach((doc: any) => {
        notifs.push(doc.data() as AppNotification);
      });
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(notifs);
    });
  },

  async saveNotification(notif: AppNotification): Promise<void> {
    await setDoc(doc(db, 'notifications', notif.id), sanitizeForFirestore(notif), { merge: true });
  }
};
