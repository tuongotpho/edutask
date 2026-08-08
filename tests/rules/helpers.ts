import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Shared setup for the security-rules suite.
 *
 * The rules text is handed to the emulator directly rather than left to
 * `firebase.json`, because this project binds its rules to a NAMED database
 * (`edutask`) while the testing SDK talks to the default one. Loading the file
 * explicitly makes the tests exercise the same rules regardless of that
 * binding — we are testing the rules logic, not which database it is attached
 * to.
 *
 * The project id is `demo-` prefixed on purpose: the emulator treats such ids
 * as strictly offline, so a misconfigured test can never reach the real
 * project.
 */

export const PROJECT_ID = 'demo-edutask-rules';

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(path.resolve(import.meta.dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
}

// --- Fixture identities -----------------------------------------------------

export const UID = {
  admin: 'u_admin',
  principal: 'u_principal',
  secretary: 'u_secretary',
  supervisor: 'u_supervisor',
  headToan: 'u_head_toan',
  /** Leads a DIFFERENT department — proves department scoping actually scopes. */
  headHoa: 'u_head_hoa',
  teacherToan: 'u_teacher_toan',
  teacherToan2: 'u_teacher_toan_2',
  teacherHoa: 'u_teacher_hoa',
  outsider: 'u_outsider',
  /** Non-teaching staff — used to prove teaching-only permissions really are. */
  accountant: 'u_accountant',
} as const;

export const DEPT = { toan: 'DEPT_TOAN', hoa: 'DEPT_HOA' } as const;

interface ProfileSpec {
  uid: string;
  roles: string[];
  departmentId: string;
}

const PROFILES: ProfileSpec[] = [
  { uid: UID.admin, roles: ['ADMIN'], departmentId: DEPT.toan },
  { uid: UID.principal, roles: ['PRINCIPAL'], departmentId: DEPT.toan },
  { uid: UID.secretary, roles: ['SECRETARY'], departmentId: DEPT.toan },
  { uid: UID.supervisor, roles: ['SUPERVISOR'], departmentId: DEPT.toan },
  { uid: UID.headToan, roles: ['HEAD_OF_DEPT'], departmentId: DEPT.toan },
  { uid: UID.headHoa, roles: ['HEAD_OF_DEPT'], departmentId: DEPT.hoa },
  { uid: UID.teacherToan, roles: ['TEACHER'], departmentId: DEPT.toan },
  { uid: UID.teacherToan2, roles: ['TEACHER'], departmentId: DEPT.toan },
  { uid: UID.teacherHoa, roles: ['TEACHER'], departmentId: DEPT.hoa },
  { uid: UID.outsider, roles: ['TEACHER'], departmentId: DEPT.hoa },
  { uid: UID.accountant, roles: ['ACCOUNTANT'], departmentId: DEPT.toan },
];

/**
 * Writes the user profiles the rules read via `getUserData()`.
 *
 * Done with rules DISABLED, because seeding a profile through the rules would
 * require the very permissions under test — and a fixture that has to be legal
 * cannot describe an illegal starting state.
 */
export async function seedProfiles(testEnv: RulesTestEnvironment): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all(
      PROFILES.map(profile =>
        setDoc(doc(db, 'users', profile.uid), {
          id: profile.uid,
          fullName: profile.uid,
          email: `${profile.uid}@truong.edu.vn`,
          roles: profile.roles,
          activeRole: profile.roles[0],
          departmentId: profile.departmentId,
          departmentName: profile.departmentId,
          isTeachingStaff: true,
          status: 'ACTIVE',
        })
      )
    );
  });
}

/** Seeds an arbitrary document bypassing rules, for "given an existing X" setups. */
export async function seedDoc(
  testEnv: RulesTestEnvironment,
  collectionPath: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), collectionPath, id), data);
  });
}

export function dbFor(testEnv: RulesTestEnvironment, uid: string): Firestore {
  // The testing SDK's Firestore is API-compatible with the app's; the cast
  // keeps the test helpers readable without leaking the internal type.
  return testEnv.authenticatedContext(uid).firestore() as unknown as Firestore;
}

export function anonDb(testEnv: RulesTestEnvironment): Firestore {
  return testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
}
