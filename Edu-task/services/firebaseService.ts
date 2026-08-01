import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  Unsubscribe 
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

export const firebaseService = {
  // --- Seed initial data to Firestore if empty ---
  async seedInitialDataIfEmpty(): Promise<void> {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      if (usersSnap.empty) {
        console.log('Seeding initial users to Firestore...');
        for (const u of INITIAL_USERS) {
          await setDoc(doc(db, 'users', u.id), u);
        }
      }

      const leavesSnap = await getDocs(collection(db, 'leaves'));
      if (leavesSnap.empty) {
        console.log('Seeding initial leaves to Firestore...');
        for (const l of INITIAL_LEAVES) {
          await setDoc(doc(db, 'leaves', l.id), l);
        }
      }

      const tasksSnap = await getDocs(collection(db, 'tasks'));
      if (tasksSnap.empty) {
        console.log('Seeding initial tasks to Firestore...');
        for (const t of INITIAL_TASKS) {
          await setDoc(doc(db, 'tasks', t.id), t);
        }
      }

      const notifsSnap = await getDocs(collection(db, 'notifications'));
      if (notifsSnap.empty) {
        console.log('Seeding initial notifications to Firestore...');
        for (const n of INITIAL_NOTIFICATIONS) {
          await setDoc(doc(db, 'notifications', n.id), n);
        }
      }
    } catch (err) {
      console.error('Error seeding initial data to Firestore:', err);
    }
  },

  // --- Users ---
  subscribeUsers(onUpdate: (users: User[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      const users: User[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as User);
      });
      if (users.length > 0) {
        onUpdate(users);
      }
    });
  },

  async saveUser(user: User): Promise<void> {
    await setDoc(doc(db, 'users', user.id), user, { merge: true });
  },

  async deleteUser(userId: string): Promise<void> {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'users', userId));
  },

  // --- Leaves ---
  subscribeLeaves(onUpdate: (leaves: LeaveRequest[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'leaves'), (snapshot) => {
      const leaves: LeaveRequest[] = [];
      snapshot.forEach((doc) => {
        leaves.push(doc.data() as LeaveRequest);
      });
      if (leaves.length > 0) {
        // Sort leaves by createdAt desc
        leaves.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate(leaves);
      }
    });
  },

  async saveLeave(leave: LeaveRequest): Promise<void> {
    await setDoc(doc(db, 'leaves', leave.id), leave, { merge: true });
  },

  // --- Tasks ---
  subscribeTasks(onUpdate: (tasks: Task[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const tasks: Task[] = [];
      snapshot.forEach((doc) => {
        tasks.push(doc.data() as Task);
      });
      if (tasks.length > 0) {
        // Sort tasks by createdAt desc
        tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate(tasks);
      }
    });
  },

  async saveTask(task: Task): Promise<void> {
    await setDoc(doc(db, 'tasks', task.id), task, { merge: true });
  },

  // --- Notifications ---
  subscribeNotifications(onUpdate: (notifs: AppNotification[]) => void): Unsubscribe {
    return onSnapshot(collection(db, 'notifications'), (snapshot) => {
      const notifs: AppNotification[] = [];
      snapshot.forEach((doc) => {
        notifs.push(doc.data() as AppNotification);
      });
      if (notifs.length > 0) {
        notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate(notifs);
      }
    });
  },

  async saveNotification(notif: AppNotification): Promise<void> {
    await setDoc(doc(db, 'notifications', notif.id), notif, { merge: true });
  }
};
