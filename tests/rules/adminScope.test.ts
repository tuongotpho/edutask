import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createTestEnv, dbFor, seedDoc, seedProfiles, UID } from './helpers';

/**
 * The boundary of "administrator".
 *
 * `lib/permissions.ts` reserves three capabilities for the ADMIN role alone —
 * `catalog:manage`, `config:rbac`, and reading the Telegram bot token — and the
 * UI hides those screens from everyone else. These tests hold the rules to that
 * same line, because the rules are the only thing an attacker has to get past:
 * the screens being hidden costs nothing to someone using the SDK directly.
 *
 * The distinction that matters here is ADMIN versus PRINCIPAL. A hiệu trưởng
 * runs the school; that is not the same job as maintaining its room catalogue or
 * holding the credential that posts to its Telegram group.
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

describe('the Telegram bot token', () => {
  beforeEach(async () => {
    await seedDoc(testEnv, 'settings', 'telegram', { enabled: true, botToken: 'real', chatId: '-100' });
  });

  it('is readable by an admin, for the "gửi thử" button', async () => {
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.admin), 'settings', 'telegram')));
  });

  it('stays out of reach of a hiệu trưởng', async () => {
    await assertFails(getDoc(doc(dbFor(testEnv, UID.principal), 'settings', 'telegram')));
  });

  it('cannot be overwritten by a hiệu trưởng', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.principal), 'settings', 'telegram'), { botToken: 'thay-the' })
    );
  });
});

describe('the room and class catalogue', () => {
  it('is maintained by an admin', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.admin), 'rooms', 'P101'), { id: 'P101', name: 'Phòng 101' })
    );
  });

  it('is not maintained by a hiệu trưởng', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.principal), 'rooms', 'P101'), { id: 'P101', name: 'Phòng 101' })
    );
  });

  it('is not maintained by a tổ trưởng', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'classes', '9A'), { id: '9A', name: 'Lớp 9A' })
    );
  });
});

describe('school configuration', () => {
  it('lets an admin edit the department list', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.admin), 'departments', DEPT_NEW), { id: DEPT_NEW, name: 'Tổ Lý' })
    );
  });

  it('does not let a hiệu trưởng edit the department list', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.principal), 'departments', DEPT_NEW), { id: DEPT_NEW, name: 'Tổ Lý' })
    );
  });

  it('does not let a hiệu trưởng edit the equipment catalogue', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.principal), 'equipment', 'EQ1'), { id: 'EQ1', name: 'Máy chiếu' })
    );
  });
});

const DEPT_NEW = 'DEPT_LY';
