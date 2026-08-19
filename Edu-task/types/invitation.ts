import { RoleType } from '@/Edu-task/types/user';

/**
 * Thư mời tài khoản — danh sách nhân sự đã được duyệt nhưng chưa từng đăng nhập.
 *
 * Nhập danh sách hàng loạt không thể biết trước mã đăng nhập của một người: mã
 * đó do Firebase cấp và chỉ ra đời vào lần họ đăng nhập đầu tiên. Phần mềm
 * trước đây lấp chỗ trống bằng một mã tự chế (`USR_BULK_...`) rồi lưu thẳng
 * thành hồ sơ người dùng. Hậu quả là hồ sơ nằm ở một mã trong khi luật bảo mật
 * lại tra theo mã đăng nhập — hai bên không bao giờ gặp nhau, nên khi giáo viên
 * đăng nhập, hệ thống tưởng họ là người lạ và tạo thêm hồ sơ thứ hai ở trạng
 * thái chờ duyệt, mất sạch vai trò đã ghi trong file.
 *
 * Thư mời tách bạch hai thứ vốn khác nhau: DANH SÁCH DỰ KIẾN gắn với email, và
 * HỒ SƠ THẬT gắn với mã đăng nhập. Hồ sơ chỉ được lập khi người ta thực sự
 * đăng nhập, và luôn lập đúng ở mã đăng nhập của họ.
 *
 * Mã tài liệu chính là email đã hạ chữ thường. Nhờ đó luật bảo mật so sánh
 * thẳng được với email trong phiếu đăng nhập, không phải tra vòng qua `users` —
 * thứ mà người đăng nhập lần đầu chưa hề có.
 */
export interface Invitation {
  /** Email đã hạ chữ thường. Trùng với mã tài liệu. */
  email: string;

  fullName: string;
  departmentId: string;
  departmentName: string;

  /** Vai trò sẽ được cấp khi người này đăng nhập. Chỉ quản trị ghi được. */
  roles: RoleType[];
  activeRole: RoleType;

  isTeachingStaff: boolean;
  subject?: string;
  phone?: string;

  createdAt: string;
  /** Ai đã mời — để truy nguồn khi có tranh chấp về vai trò được cấp. */
  createdById?: string;
}

/** Email dùng làm mã tài liệu: hạ chữ thường và cắt khoảng trắng thừa. */
export function invitationKey(email: string): string {
  return email.trim().toLowerCase();
}
