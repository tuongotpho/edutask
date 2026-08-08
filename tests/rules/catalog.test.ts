import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { anonDb, createTestEnv, dbFor, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Shared catalogs: departments, rooms, classes, settings.
 *
 * The claim under test is the one written in the rules file — everyone signed
 * in may READ these (they fill the pickers in every form), and only admins may
 * WRITE them.
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

const ROOM = {
  id: 'ROOM_1', schoolId: 'S', name: 'Phòng TN Hóa 1', code: 'TN-HOA-1',
  kind: 'LAB_CHEMISTRY', requiresApproval: false, isActive: true,
};

describe.each([
  ['rooms', ROOM],
  ['classes', { id: 'CLASS_1', schoolId: 'S', name: '10A1', grade: 10, isActive: true }],
  ['departments', { id: 'DEPT_X', name: 'Tổ mới', code: 'MOI' }],
])('%s catalog', (collection, payload) => {
  it('lets any signed-in member of staff read it', async () => {
    await seedDoc(testEnv, collection, 'seeded', payload);
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), collection, 'seeded')));
  });

  it('refuses a signed-out reader', async () => {
    await seedDoc(testEnv, collection, 'seeded', payload);
    await assertFails(getDoc(doc(anonDb(testEnv), collection, 'seeded')));
  });

  it('lets an admin write it', async () => {
    await assertSucceeds(setDoc(doc(dbFor(testEnv, UID.admin), collection, 'new'), payload));
  });

  it('refuses a plain teacher writing it', async () => {
    await assertFails(setDoc(doc(dbFor(testEnv, UID.teacherToan), collection, 'new'), payload));
  });

  it('refuses a department leader writing it', async () => {
    // Leading a tổ does not make someone a system administrator.
    await assertFails(setDoc(doc(dbFor(testEnv, UID.headToan), collection, 'new'), payload));
  });

  it('refuses a plain teacher deleting it', async () => {
    await seedDoc(testEnv, collection, 'seeded', payload);
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.teacherToan), collection, 'seeded')));
  });
});

describe('settings', () => {
  it('is readable by staff but writable only by admins', async () => {
    await seedDoc(testEnv, 'settings', 'periods', { morningPeriods: 5, afternoonPeriods: 5 });

    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'settings', 'periods')));
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'settings', 'periods'), { morningPeriods: 9 })
    );
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.admin), 'settings', 'periods'), { morningPeriods: 4, afternoonPeriods: 4 })
    );
  });

  it('does not let a teacher rewrite the Telegram bot token', async () => {
    await seedDoc(testEnv, 'settings', 'telegram', { enabled: true, botToken: 'real', chatId: '-100' });
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'settings', 'telegram'), { botToken: 'attacker' })
    );
  });

  it('does not let a teacher READ the Telegram bot token either', async () => {
    // The token is a credential: whoever holds it can post to the school's
    // group AS the school. Sending moved to a Cloud Function precisely so no
    // ordinary client needs it.
    await seedDoc(testEnv, 'settings', 'telegram', { enabled: true, botToken: 'real', chatId: '-100' });
    await assertFails(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'settings', 'telegram')));
    await assertFails(getDoc(doc(dbFor(testEnv, UID.headToan), 'settings', 'telegram')));
  });

  it('still lets an admin read it, for the "gửi thử" button', async () => {
    await seedDoc(testEnv, 'settings', 'telegram', { enabled: true, botToken: 'real', chatId: '-100' });
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.admin), 'settings', 'telegram')));
  });

  it('keeps every OTHER setting readable by all staff', async () => {
    // The exclusion must be surgical: period times and workflow config fill
    // pickers on screens every teacher opens.
    await seedDoc(testEnv, 'settings', 'workflow', { deptOnlyMaxDays: 1, alwaysExecutiveTypes: [] });
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'settings', 'workflow')));
  });
});
