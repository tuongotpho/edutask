import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { anonDb, createTestEnv, dbFor, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Thiết bị nhận thông báo đẩy.
 *
 * A registration token is a capability, not just an identifier: anyone who can
 * write a row pointing a token at themselves — or read someone else's — gains
 * the ability to have notifications delivered to a device that is not theirs.
 * So the rule is simply "your own rows, nothing else", and these tests prove it
 * from both directions.
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

const TOKEN_ID = 'fcm-token-abc';

const TOKEN = {
  token: TOKEN_ID,
  userId: UID.teacherToan,
  deviceLabel: 'Android · Chrome',
  createdAt: '2026-08-08 06:00',
  lastSeenAt: '2026-08-08 06:00',
};

describe('registering a device', () => {
  it('lets someone register their own device', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'pushTokens', TOKEN_ID), TOKEN)
    );
  });

  it('refuses registering a token in someone else’s name', async () => {
    // Otherwise anyone could have a colleague's phone receive their alerts.
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan2), 'pushTokens', TOKEN_ID), TOKEN)
    );
  });

  it('refuses a signed-out writer', async () => {
    await assertFails(setDoc(doc(anonDb(testEnv), 'pushTokens', TOKEN_ID), TOKEN));
  });

  it('refuses reassigning an existing token to another person', async () => {
    // The dangerous direction: hijacking a device already registered elsewhere.
    await seedDoc(testEnv, 'pushTokens', TOKEN_ID, TOKEN);
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan2), 'pushTokens', TOKEN_ID), {
        ...TOKEN,
        userId: UID.teacherToan2,
      })
    );
  });

  it('lets the owner refresh their own row', async () => {
    await seedDoc(testEnv, 'pushTokens', TOKEN_ID, TOKEN);
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'pushTokens', TOKEN_ID), {
        ...TOKEN,
        lastSeenAt: '2026-08-09 07:00',
      })
    );
  });
});

describe('reading', () => {
  it('lets the owner read their own device row', async () => {
    await seedDoc(testEnv, 'pushTokens', TOKEN_ID, TOKEN);
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'pushTokens', TOKEN_ID)));
  });

  it('refuses reading a colleague’s device row', async () => {
    await seedDoc(testEnv, 'pushTokens', TOKEN_ID, TOKEN);
    await assertFails(getDoc(doc(dbFor(testEnv, UID.teacherToan2), 'pushTokens', TOKEN_ID)));
  });

  it('refuses even an admin from the client', async () => {
    // Nothing in the app needs this: the Cloud Function reads tokens with the
    // Admin SDK, which bypasses rules entirely. Leaving an admin read open
    // would widen the blast radius of a compromised admin account for no gain.
    await seedDoc(testEnv, 'pushTokens', TOKEN_ID, TOKEN);
    await assertFails(getDoc(doc(dbFor(testEnv, UID.admin), 'pushTokens', TOKEN_ID)));
  });
});

describe('unregistering', () => {
  it('lets the owner remove their own device', async () => {
    await seedDoc(testEnv, 'pushTokens', TOKEN_ID, TOKEN);
    await assertSucceeds(deleteDoc(doc(dbFor(testEnv, UID.teacherToan), 'pushTokens', TOKEN_ID)));
  });

  it('refuses removing someone else’s device', async () => {
    // Silently unsubscribing a colleague would be an invisible denial of
    // service — they would simply stop being reminded and never know why.
    await seedDoc(testEnv, 'pushTokens', TOKEN_ID, TOKEN);
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.teacherToan2), 'pushTokens', TOKEN_ID)));
  });
});
