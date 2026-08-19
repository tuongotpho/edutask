import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, deleteDoc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { createTestEnv, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Thu moi tai khoan.
 *
 * Bai toan goc: nhap danh sach giao vien hang loat khong the biet truoc ma dang
 * nhap cua ho — ma do chi ra doi khi ho dang nhap lan dau. Phan mem truoc day
 * lap cho trong bang mot ma tu che (USR_BULK_...), nen ho so nam o mot ma trong
 * khi may chu lai tra theo ma dang nhap. Hai ben khong bao gio gap nhau: giao
 * vien dang nhap xong bi tao them ho so thu hai o trang thai cho duyet, mat
 * sach vai tro ghi trong file CSV.
 *
 * Thu moi tach hai viec do ra. Danh sach nhap vao la LOI MOI gan voi email;
 * ho so chi duoc lap khi nguoi ta dang nhap, va luon lap dung o ma dang nhap.
 *
 * Ma tai lieu thu moi chinh la email da ha chu thuong, nen luat so sanh thang
 * duoc voi email trong phieu dang nhap.
 */

let testEnv: RulesTestEnvironment;

const TEACHER_EMAIL = 'gv.toan@truong.edu.vn';
const TEACHER_UID = 'uid_gv_toan_moi';

const INVITE = {
  email: TEACHER_EMAIL,
  fullName: 'Nguyen Van A',
  departmentId: 'DEPT_TOAN',
  departmentName: 'To Toan',
  roles: ['HEAD_OF_DEPT'],
  activeRole: 'HEAD_OF_DEPT',
  isTeachingStaff: true,
  createdAt: '2026-08-20 08:00',
};

/** Ho so ma ung dung lap khi nguoi duoc moi dang nhap lan dau. */
function claimedProfile(uid: string, over: Record<string, unknown> = {}) {
  return {
    id: uid,
    fullName: INVITE.fullName,
    email: TEACHER_EMAIL,
    departmentId: INVITE.departmentId,
    departmentName: INVITE.departmentName,
    roles: INVITE.roles,
    activeRole: INVITE.activeRole,
    isTeachingStaff: true,
    status: 'ACTIVE',
    ...over,
  };
}

/** Phieu dang nhap co email — thu moi nhan dien qua email, khong qua uid. */
function dbForEmail(uid: string, email: string) {
  return testEnv.authenticatedContext(uid, { email }).firestore() as never;
}

beforeAll(async () => { testEnv = await createTestEnv(); });
afterAll(async () => { await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedProfiles(testEnv);
  await seedDoc(testEnv, 'invitations', TEACHER_EMAIL, INVITE);
});

describe('ai doc duoc thu moi', () => {
  it('nguoi duoc moi doc duoc thu cua chinh minh', async () => {
    await assertSucceeds(getDoc(doc(dbForEmail(TEACHER_UID, TEACHER_EMAIL), 'invitations', TEACHER_EMAIL)));
  });

  it('khong phan biet chu hoa thuong trong email dang nhap', async () => {
    await assertSucceeds(getDoc(doc(dbForEmail(TEACHER_UID, 'GV.Toan@Truong.Edu.VN'), 'invitations', TEACHER_EMAIL)));
  });

  it('CHAN nguoi khac doc thu moi khong phai cua minh', async () => {
    await assertFails(getDoc(doc(dbForEmail('uid_nguoi_khac', 'nguoikhac@truong.edu.vn'), 'invitations', TEACHER_EMAIL)));
  });

  it('CHAN liet ke toan bo danh sach thu moi', async () => {
    await assertFails(getDocs(collection(dbForEmail(TEACHER_UID, TEACHER_EMAIL), 'invitations')));
  });

  it('cho Ban Giam hieu liet ke de quan ly', async () => {
    const db = testEnv.authenticatedContext(UID.principal).firestore() as never;
    await assertSucceeds(getDocs(collection(db, 'invitations')));
  });
});

describe('ai tao duoc thu moi', () => {
  it('cho Ban Giam hieu', async () => {
    const db = testEnv.authenticatedContext(UID.principal).firestore() as never;
    await assertSucceeds(setDoc(doc(db, 'invitations', 'moi@truong.edu.vn'), INVITE));
  });

  it('CHAN giao vien tu tao thu moi cho chinh minh', async () => {
    const db = dbForEmail(UID.teacherToan, 'u_teacher_toan@truong.edu.vn');
    await assertFails(setDoc(doc(db, 'invitations', 'u_teacher_toan@truong.edu.vn'), { ...INVITE, roles: ['ADMIN'] }));
  });

  it('CHAN giao vien sua thu moi cua minh de nang vai tro', async () => {
    const db = dbForEmail(TEACHER_UID, TEACHER_EMAIL);
    await assertFails(setDoc(doc(db, 'invitations', TEACHER_EMAIL), { ...INVITE, roles: ['ADMIN'] }));
  });
});

describe('lap ho so tu thu moi', () => {
  it('nguoi duoc moi lap duoc ho so voi DUNG vai tro trong thu', async () => {
    const db = dbForEmail(TEACHER_UID, TEACHER_EMAIL);
    await assertSucceeds(setDoc(doc(db, 'users', TEACHER_UID), claimedProfile(TEACHER_UID)));
  });

  it('CHAN tu nang vai tro cao hon thu moi', async () => {
    const db = dbForEmail(TEACHER_UID, TEACHER_EMAIL);
    await assertFails(setDoc(doc(db, 'users', TEACHER_UID), claimedProfile(TEACHER_UID, { roles: ['ADMIN'], activeRole: 'ADMIN' })));
  });

  it('CHAN doi sang to khac voi thu moi', async () => {
    const db = dbForEmail(TEACHER_UID, TEACHER_EMAIL);
    await assertFails(setDoc(doc(db, 'users', TEACHER_UID), claimedProfile(TEACHER_UID, { departmentId: 'DEPT_HOA' })));
  });

  it('CHAN lap ho so o ma KHAC ma dang nhap cua minh', async () => {
    const db = dbForEmail(TEACHER_UID, TEACHER_EMAIL);
    await assertFails(setDoc(doc(db, 'users', 'USR_BULK_123_45'), claimedProfile('USR_BULK_123_45')));
  });

  it('CHAN nguoi KHONG co thu moi lap ho so vai tro cao', async () => {
    const db = dbForEmail('uid_la', 'khongmoi@truong.edu.vn');
    await assertFails(setDoc(doc(db, 'users', 'uid_la'), claimedProfile('uid_la')));
  });

  it('nguoi khong co thu moi van tu dang ky duoc o trang thai CHO DUYET', async () => {
    const db = dbForEmail('uid_tu_dang_ky', 'tudangky@truong.edu.vn');
    await assertSucceeds(setDoc(doc(db, 'users', 'uid_tu_dang_ky'), {
      id: 'uid_tu_dang_ky',
      fullName: 'Nguoi moi',
      email: 'tudangky@truong.edu.vn',
      departmentId: 'DEPT_TOAN',
      departmentName: 'To Toan',
      roles: ['TEACHER'],
      activeRole: 'TEACHER',
      isTeachingStaff: true,
      status: 'PENDING_APPROVAL',
    }));
  });
});

describe('don thu moi sau khi dung', () => {
  it('nguoi nhan tu xoa duoc thu cua minh', async () => {
    await assertSucceeds(deleteDoc(doc(dbForEmail(TEACHER_UID, TEACHER_EMAIL), 'invitations', TEACHER_EMAIL)));
  });

  it('CHAN xoa thu moi cua nguoi khac', async () => {
    await assertFails(deleteDoc(doc(dbForEmail('uid_nguoi_khac', 'nguoikhac@truong.edu.vn'), 'invitations', TEACHER_EMAIL)));
  });
});
