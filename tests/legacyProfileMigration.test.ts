import { describe, expect, it } from 'vitest';
import { isLegacyBulkId, planLegacyMigration } from '@/Edu-task/lib/legacyProfileMigration';
import { User } from '@/Edu-task/types/user';

/**
 * Don ho so mang ma tu che tu dot nhap danh sach cu.
 *
 * Hai truong hop phai xu ly khac han nhau, va nham la hong that:
 *   - Nham nguoi DA dang nhap thanh chua: tao thu moi thua, va ho so that van
 *     ket o trang thai cho duyet -> nguoi do van khong lam viec duoc.
 *   - Nham nguoi CHUA dang nhap thanh da: ghi de vai tro len ho so cua nguoi
 *     khac trung email, hoac ghi vao khoang khong.
 */

const NOW = '2026-08-20 09:00';

function user(over: Partial<User> & Pick<User, 'id'>): User {
  return {
    fullName: 'Nguoi dung',
    email: 'a@truong.edu.vn',
    departmentId: 'DEPT_TOAN',
    departmentName: 'To Toan',
    roles: ['TEACHER'],
    activeRole: 'TEACHER',
    isTeachingStaff: true,
    status: 'ACTIVE',
    ...over,
  } as User;
}

describe('nhan dien ma tu che', () => {
  it('nhan ma do dot nhap cu sinh ra', () => {
    expect(isLegacyBulkId('USR_BULK_1787152644536_72')).toBe(true);
  });

  it('khong nham ma dang nhap that cua Firebase', () => {
    expect(isLegacyBulkId('XEqwLysO6TP2ymixymfbsQVvBD32')).toBe(false);
  });

  it('khong nham tai khoan quan tri seed tay', () => {
    expect(isLegacyBulkId('USR_ADMIN')).toBe(false);
  });
});

describe('nguoi CHUA tung dang nhap', () => {
  it('chuyen thanh thu moi va xoa ho so giu cho', () => {
    const plan = planLegacyMigration([
      user({ id: 'USR_BULK_1_0', email: 'toTruong@truong.edu.vn', fullName: 'To truong Toan',
             roles: ['HEAD_OF_DEPT'], activeRole: 'HEAD_OF_DEPT' }),
    ], NOW);

    expect(plan.toMerge).toHaveLength(0);
    expect(plan.toInvite).toHaveLength(1);
    expect(plan.toInvite[0].deleteUserId).toBe('USR_BULK_1_0');
    expect(plan.toInvite[0].invitation.roles).toEqual(['HEAD_OF_DEPT']);
  });

  it('ha chu thuong email khi lam ma thu moi', () => {
    const plan = planLegacyMigration([
      user({ id: 'USR_BULK_1_0', email: '  ToTruong@Truong.Edu.VN  ' }),
    ], NOW);
    expect(plan.toInvite[0].invitation.email).toBe('totruong@truong.edu.vn');
  });
});

describe('nguoi DA dang nhap', () => {
  it('nang ho so that len dung vai tro, khong tao thu moi', () => {
    const plan = planLegacyMigration([
      user({ id: 'USR_BULK_1_0', email: 'gv@truong.edu.vn',
             roles: ['HEAD_OF_DEPT'], activeRole: 'HEAD_OF_DEPT',
             departmentId: 'DEPT_HOA', departmentName: 'To Hoa' }),
      user({ id: 'XEqwLysO6TP2ymixymfbsQVvBD32', email: 'gv@truong.edu.vn',
             roles: ['TEACHER'], activeRole: 'TEACHER', status: 'PENDING_APPROVAL' }),
    ], NOW);

    expect(plan.toInvite).toHaveLength(0);
    expect(plan.toMerge).toHaveLength(1);
    const m = plan.toMerge[0];
    expect(m.realUserId).toBe('XEqwLysO6TP2ymixymfbsQVvBD32');
    expect(m.deleteUserId).toBe('USR_BULK_1_0');
    expect(m.patch.roles).toEqual(['HEAD_OF_DEPT']);
    expect(m.patch.departmentId).toBe('DEPT_HOA');
    // Cai quan trong nhat: go khoi trang thai cho duyet.
    expect(m.patch.status).toBe('ACTIVE');
  });

  it('ghep duoc du email khac chu hoa thuong', () => {
    const plan = planLegacyMigration([
      user({ id: 'USR_BULK_1_0', email: 'GV@Truong.edu.vn', roles: ['SUPERVISOR'], activeRole: 'SUPERVISOR' }),
      user({ id: 'uid_that', email: 'gv@truong.edu.vn', status: 'PENDING_APPROVAL' }),
    ], NOW);
    expect(plan.toMerge).toHaveLength(1);
    expect(plan.toMerge[0].patch.roles).toEqual(['SUPERVISOR']);
  });

  it('KHONG dung ho so cu lam moc ghep cho ho so cu khac', () => {
    // Hai ho so cu cung email van phai duoc coi la chua dang nhap, khong duoc
    // lay cai nay lam "ho so that" cua cai kia.
    const plan = planLegacyMigration([
      user({ id: 'USR_BULK_1_0', email: 'trung@truong.edu.vn' }),
      user({ id: 'USR_BULK_1_1', email: 'trung@truong.edu.vn' }),
    ], NOW);
    expect(plan.toMerge).toHaveLength(0);
    expect(plan.toInvite).toHaveLength(2);
  });
});

describe('truong hop can nguoi xem lai', () => {
  it('ho so cu khong co email thi khong tu quyet', () => {
    const plan = planLegacyMigration([user({ id: 'USR_BULK_1_0', email: '' })], NOW);
    expect(plan.toInvite).toHaveLength(0);
    expect(plan.toMerge).toHaveLength(0);
    expect(plan.needsReview).toHaveLength(1);
  });
});

describe('khong dung toi ho so binh thuong', () => {
  it('bo qua moi ho so mang ma dang nhap that', () => {
    const plan = planLegacyMigration([
      user({ id: 'uid_a', email: 'a@truong.edu.vn' }),
      user({ id: 'uid_b', email: 'b@truong.edu.vn' }),
      user({ id: 'USR_ADMIN', email: 'admin@gmail.com' }),
    ], NOW);
    expect(plan.toInvite).toHaveLength(0);
    expect(plan.toMerge).toHaveLength(0);
    expect(plan.needsReview).toHaveLength(0);
  });
});
