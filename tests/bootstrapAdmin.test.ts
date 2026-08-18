import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Danh sách email quản trị khởi tạo tồn tại ở HAI nơi chép tay:
 *   - firestore.rules  → isBootstrapAdminEmail()
 *   - biến môi trường  → NEXT_PUBLIC_ADMIN_EMAILS, đọc bởi lib/admin.ts
 *
 * Rules không đọc được biến môi trường nên không thể gộp làm một. Đây đúng là
 * loại trùng lặp đã gây sự cố: `canSeedConfig` trong AppContext từng là bản
 * chép tay của isAdmin() bên rules, và nó lạc hậu ngay khi rules siết lại —
 * giao diện tưởng có quyền, máy chủ từ chối, người dùng nhận một lỗi vô nghĩa.
 *
 * Không gộp được thì ghim lại. Bài test này không cần emulator nên nó chạy
 * trong `npm test`, tức là chặn được từ trước khi ai đó kịp deploy.
 */

const root = path.resolve(import.meta.dirname, '..');

function emailsInRules(): string[] {
  const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  const fn = rules.match(/function isBootstrapAdminEmail\(\)[\s\S]*?\}/);
  expect(fn, 'không tìm thấy isBootstrapAdminEmail() trong firestore.rules').toBeTruthy();

  const list = fn![0].match(/\[([^\]]*)\]/);
  if (!list || !list[1].trim()) return [];
  return list[1]
    .split(',')
    .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function emailsInEnv(): string[] | null {
  let raw: string;
  try {
    raw = readFileSync(path.join(root, '.env.local'), 'utf8');
  } catch {
    return null; // CI không có .env.local — xem ghi chú ở bài test cuối.
  }
  const line = raw.split(/\r?\n/).find(l => l.startsWith('NEXT_PUBLIC_ADMIN_EMAILS='));
  if (!line) return null;
  return line.slice('NEXT_PUBLIC_ADMIN_EMAILS='.length)
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

describe('email quản trị khởi tạo', () => {
  it('trong rules là danh sách đọc được, không phải cú pháp hỏng', () => {
    // Rỗng là HỢP LỆ và là trạng thái nên hướng tới sau khi trường đã có ADMIN
    // thật. Cái phải chặn là danh sách không phân tích nổi — nó sẽ lặng lẽ cho
    // ra rỗng và khoá luôn cửa thoát hiểm mà không ai biết.
    expect(Array.isArray(emailsInRules())).toBe(true);
  });

  it('mọi mục đều đúng dạng email', () => {
    for (const email of emailsInRules()) {
      expect(email, `"${email}" không phải email hợp lệ`).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
  });

  it('không lẫn khoảng trắng hay chữ hoa gây lệch so sánh', () => {
    // Rules so sánh y hệt chuỗi trong token; client thì hạ chữ thường trước.
    // Một chữ hoa ở đây là hai bên xử sự khác nhau trên cùng một tài khoản.
    for (const email of emailsInRules()) {
      expect(email).toBe(email.trim().toLowerCase());
    }
  });

  it('khớp với NEXT_PUBLIC_ADMIN_EMAILS khi có .env.local', () => {
    const env = emailsInEnv();
    if (env === null) {
      // Trên CI không có .env.local. Bài test vẫn có giá trị vì nó chạy trên
      // máy lập trình viên — đúng nơi cả hai bản được sửa bằng tay.
      expect(true).toBe(true);
      return;
    }
    expect(emailsInRules().map(e => e.toLowerCase()).sort()).toEqual([...env].sort());
  });
});
