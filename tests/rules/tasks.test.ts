import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { anonDb, createTestEnv, dbFor, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Giao việc.
 *
 * Access is governed by `viewerIds` — an explicit ACL on the document rather
 * than a role rule. That makes one question decisive: can somebody who is on
 * the list rewrite the list? If so the ACL means nothing, because any assignee
 * could add themselves to tasks they were never given, or remove the people
 * who are supposed to be watching.
 */

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await createTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedProfiles(testEnv);
});

const TASK = {
  id: 'TSK_1', code: 'CV-2026-001',
  title: 'Nộp báo cáo tháng', description: '',
  assignerId: UID.headToan, assignerName: 'Tổ trưởng Toán', assignerRole: 'Tổ trưởng',
  assigneeType: 'INDIVIDUAL',
  assignees: [{
    userId: UID.teacherToan, userName: 'GV Toán',
    departmentName: 'Tổ Toán', status: 'ASSIGNED',
  }],
  attachments: [], deadline: '2026-08-20 17:00', startDate: '2026-08-08',
  priority: 'NORMAL', status: 'ASSIGNED',
  viewerIds: [UID.headToan, UID.teacherToan],
  extensionRequests: [], activities: [],
  createdAt: '2026-08-08 08:00', updatedAt: '2026-08-08 08:00',
};

async function seedTask(over: Record<string, unknown> = {}) {
  await seedDoc(testEnv, 'tasks', TASK.id, { ...TASK, ...over });
}

describe('ai đọc được công việc', () => {
  it('cho người trong danh sách xem đọc được', async () => {
    await seedTask();
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'tasks', TASK.id)));
  });

  it('CHẶN người ngoài danh sách xem', async () => {
    await seedTask();
    await assertFails(getDoc(doc(dbFor(testEnv, UID.teacherToan2), 'tasks', TASK.id)));
  });

  it('CHẶN cả tổ trưởng tổ khác dù có vai trò lãnh đạo', async () => {
    await seedTask();
    await assertFails(getDoc(doc(dbFor(testEnv, UID.headHoa), 'tasks', TASK.id)));
  });

  it('CHẶN người chưa đăng nhập', async () => {
    await seedTask();
    await assertFails(getDoc(doc(anonDb(testEnv), 'tasks', TASK.id)));
  });
});

describe('giao việc', () => {
  it('cho tổ trưởng giao việc đứng tên mình', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'tasks', 'TSK_NEW'), TASK)
    );
  });

  it('CHẶN giao việc đứng tên người khác', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'tasks', 'TSK_NEW'), TASK)
    );
  });

  it('CHẶN tạo việc mà chính người giao không nằm trong danh sách xem', async () => {
    // Otherwise a task could be created that its own author cannot see —
    // unauditable by construction.
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'tasks', 'TSK_NEW'), {
        ...TASK, viewerIds: [UID.teacherToan],
      })
    );
  });
});

describe('người nhận việc báo cáo tiến độ', () => {
  it('cho người nhận cập nhật trạng thái của mình', async () => {
    await seedTask();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'tasks', TASK.id), {
        status: 'IN_PROGRESS',
        updatedAt: '2026-08-09 08:00',
      })
    );
  });

  it('CHẶN người nhận tự sửa danh sách xem để kéo người khác vào', async () => {
    // The ACL is the whole access model; letting a viewer rewrite it would
    // dissolve it.
    await seedTask();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'tasks', TASK.id), {
        viewerIds: [UID.headToan, UID.teacherToan, UID.teacherHoa],
      })
    );
  });

  it('CHẶN người nhận tự nhận mình là người giao việc', async () => {
    await seedTask();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'tasks', TASK.id), {
        assignerId: UID.teacherToan,
      })
    );
  });

  it('CHẶN người nhận sửa cấu hình hiển thị để giấu việc khỏi BGH', async () => {
    await seedTask();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'tasks', TASK.id), {
        visibilitySettings: { bghCanView: false },
      })
    );
  });

  it('CHẶN người ngoài danh sách sửa bất cứ thứ gì', async () => {
    await seedTask();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherHoa), 'tasks', TASK.id), { status: 'COMPLETED' })
    );
  });

  it('cho người giao việc sửa mọi thứ, kể cả danh sách xem', async () => {
    await seedTask();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.headToan), 'tasks', TASK.id), {
        viewerIds: [UID.headToan, UID.teacherToan, UID.teacherToan2],
      })
    );
  });
});

describe('xóa việc', () => {
  it('cho người giao việc xóa', async () => {
    await seedTask();
    await assertSucceeds(deleteDoc(doc(dbFor(testEnv, UID.headToan), 'tasks', TASK.id)));
  });

  it('CHẶN người nhận việc xóa việc được giao cho mình', async () => {
    // Otherwise an inconvenient assignment simply disappears.
    await seedTask();
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.teacherToan), 'tasks', TASK.id)));
  });
});
