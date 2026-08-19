import { User } from '@/Edu-task/types/user';
import { Invitation } from '@/Edu-task/types/invitation';

/**
 * Dọn các hồ sơ mang mã tự chế do đợt nhập danh sách cũ để lại.
 *
 * Bối cảnh: bản nhập hàng loạt trước đây tạo thẳng hồ sơ người dùng với mã
 * `USR_BULK_<thời gian>_<số thứ tự>`, vì lúc nhập thì giáo viên chưa từng đăng
 * nhập nên chưa có mã đăng nhập. Nhưng luật bảo mật tra hồ sơ THEO mã đăng
 * nhập, nên những hồ sơ ấy không bao giờ khớp với ai.
 *
 * Hậu quả tuỳ theo người đó đã đăng nhập hay chưa, và hai trường hợp cần xử lý
 * khác hẳn nhau — đó là lý do phần quyết định được tách riêng ra đây thay vì
 * nằm lẫn trong nút bấm:
 *
 *   - CHƯA đăng nhập: hồ sơ chỉ là chỗ giữ tên. Chuyển thành thư mời rồi xoá.
 *     Không mất gì, vì chưa có dữ liệu nào trỏ tới nó.
 *
 *   - ĐÃ đăng nhập: hệ thống đã tạo cho họ hồ sơ thật ở đúng mã đăng nhập,
 *     nhưng ở trạng thái chờ duyệt với vai trò mặc định. Việc cần làm là chép
 *     vai trò và tổ từ hồ sơ cũ sang hồ sơ thật rồi xoá hồ sơ cũ — KHÔNG tạo
 *     thư mời, vì thư mời chỉ dùng cho người chưa có hồ sơ.
 */

/** Mã do đợt nhập cũ sinh ra. Hồ sơ thật luôn mang mã đăng nhập của Firebase. */
export function isLegacyBulkId(id: string): boolean {
  return /^USR_BULK_/.test(id);
}

/**
 * Hồ sơ quản trị do bản cũ seed tay vào `users/USR_ADMIN`.
 *
 * Cùng một căn bệnh với `USR_BULK_*` — mã tự đặt thay vì mã đăng nhập — nhưng
 * xử lý phải khác, và khác ở chỗ nguy hiểm: nếu tài khoản đó CHƯA từng đăng
 * nhập thì đây có thể là hồ sơ quản trị duy nhất của trường. Xoá nó đi mà không
 * có hồ sơ thay thế là tự khoá mình ra ngoài phần quản trị.
 *
 * Nên nó chỉ được dọn khi đã có hồ sơ thật cùng email để chuyển vai trò sang.
 * Không bao giờ chuyển thành thư mời: thư mời dành cho người chưa có hồ sơ, còn
 * đây là tài khoản đang nắm quyền cao nhất.
 */
export function isAdminPlaceholderId(id: string): boolean {
  return id === 'USR_ADMIN';
}

/** Mọi hồ sơ mang mã tự đặt thay vì mã đăng nhập. */
export function isPlaceholderId(id: string): boolean {
  return isLegacyBulkId(id) || isAdminPlaceholderId(id);
}

export interface MigrationPlan {
  /** Người chưa đăng nhập: dựng thư mời rồi xoá hồ sơ giữ chỗ. */
  toInvite: Array<{ invitation: Invitation; deleteUserId: string }>;
  /** Người đã đăng nhập: nâng hồ sơ thật lên đúng vai trò rồi xoá hồ sơ cũ. */
  toMerge: Array<{ realUserId: string; patch: Partial<User>; deleteUserId: string }>;
  /** Hồ sơ cũ thiếu email nên không ghép được với ai — cần người xem lại. */
  needsReview: User[];
}

/**
 * Lập kế hoạch dọn dẹp từ danh sách người dùng hiện có.
 *
 * Thuần: không đọc ghi gì, chỉ nhìn dữ liệu rồi nói ra việc cần làm. Nhờ vậy
 * kiểm thử được toàn bộ các nhánh mà không phải dựng cơ sở dữ liệu, và người
 * bấm nút xem trước được đúng những gì sắp xảy ra.
 */
export function planLegacyMigration(users: User[], now: string): MigrationPlan {
  const plan: MigrationPlan = { toInvite: [], toMerge: [], needsReview: [] };

  const legacy = users.filter(u => isPlaceholderId(u.id));
  const byEmail = new Map<string, User[]>();
  for (const u of users) {
    if (isPlaceholderId(u.id)) continue;
    const key = (u.email || '').trim().toLowerCase();
    if (!key) continue;
    byEmail.set(key, [...(byEmail.get(key) ?? []), u]);
  }

  for (const old of legacy) {
    const key = (old.email || '').trim().toLowerCase();
    if (!key) {
      plan.needsReview.push(old);
      continue;
    }

    const real = byEmail.get(key)?.[0];
    if (real) {
      // Đã đăng nhập rồi. Chỉ chép phần bị mất, không đụng tới những trường mà
      // hồ sơ thật nắm giữ (mã, ảnh đại diện, thứ họ tự sửa được).
      plan.toMerge.push({
        realUserId: real.id,
        patch: {
          roles: old.roles,
          activeRole: old.activeRole,
          departmentId: old.departmentId,
          departmentName: old.departmentName,
          status: 'ACTIVE',
        },
        deleteUserId: old.id,
      });
    } else if (isAdminPlaceholderId(old.id)) {
      // Chưa có hồ sơ thật để chuyển sang. Không xoá, không mời — báo để người
      // ta tự quyết, vì đây có thể là hồ sơ quản trị duy nhất còn lại.
      plan.needsReview.push(old);
    } else {
      plan.toInvite.push({
        invitation: {
          email: key,
          fullName: old.fullName,
          departmentId: old.departmentId,
          departmentName: old.departmentName,
          roles: old.roles,
          activeRole: old.activeRole,
          isTeachingStaff: old.isTeachingStaff ?? true,
          subject: old.subject,
          phone: old.phone,
          createdAt: now,
        },
        deleteUserId: old.id,
      });
    }
  }

  return plan;
}
