# EduTask — Hệ thống Quản lý Công việc & Nghỉ phép Trường học

Ứng dụng nội bộ cho trường học: giao việc, theo dõi tiến độ, và xử lý đơn xin nghỉ phép
với luồng phê duyệt nhiều cấp cùng phân công giáo viên dạy thay.

## Công nghệ

| Thành phần | Lựa chọn |
|---|---|
| Framework | Next.js 15 (App Router), xuất tĩnh (`output: 'export'`) |
| UI | React 19 · TypeScript · Tailwind CSS 4 |
| Dữ liệu | Firebase Firestore (realtime) + Firebase Auth |
| Hosting | Firebase Hosting |
| Kiểm thử | Vitest |

> **Lưu ý kiến trúc:** ứng dụng không có tầng server — trình duyệt nói chuyện trực tiếp
> với Firestore. Vì vậy [`firestore.rules`](./firestore.rules) là **ranh giới bảo mật duy
> nhất**. Mọi kiểm tra quyền trong React chỉ phục vụ hiển thị; quy tắc nghiệp vụ quan
> trọng phải được biểu diễn lại trong rules.

## Chạy tại máy

**Yêu cầu:** Node.js 20+

1. Cài đặt phụ thuộc:
   ```bash
   npm install
   ```

2. Tạo file `.env.local` ở thư mục gốc với thông tin dự án Firebase:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
   NEXT_PUBLIC_ADMIN_EMAILS=admin@gmail.com
   ```
   `NEXT_PUBLIC_ADMIN_EMAILS` là danh sách email quản trị viên khởi tạo (phân tách bằng
   dấu phẩy). Giữ nó khớp với danh sách bootstrap trong `firestore.rules`.

3. Chạy máy chủ phát triển:
   ```bash
   npm run dev
   ```

## Các lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Máy chủ phát triển |
| `npm run build` | Build production (chạy cả type-check và ESLint) |
| `npm test` | Chạy unit test |
| `npm run test:watch` | Test ở chế độ watch |
| `npm run lint` | Chỉ chạy ESLint |

## Cấu trúc thư mục

```
app/                     Next.js App Router (layout, trang gốc)
Edu-task/
  components/            UI theo miền: auth · task · leave · schedule · stats · config
  context/
    AppContext.tsx       Store toàn cục + đăng ký realtime Firestore
    hooks/               Logic nghiệp vụ tách theo miền
  lib/
    permissions.ts       Nguồn duy nhất cho phân quyền hiển thị
    leaveConflict.ts     Quy tắc phát hiện trùng lịch nghỉ
    firebase.ts          Khởi tạo Firebase
    storage.ts           Bộ đệm localStorage
  services/              Lớp truy cập Firestore & Auth
  types/                 Kiểu dữ liệu dùng chung
tests/                   Unit test (Vitest)
firestore.rules          Quy tắc bảo mật — ranh giới bảo mật thật sự
```

## Triển khai

Đẩy lên nhánh `main` sẽ kích hoạt [GitHub Actions](.github/workflows/deploy.yml):
type-check → unit test → build → deploy `firestore.rules` → deploy hosting.

Triển khai thủ công:
```bash
npm run build && npx firebase deploy
```

Chỉ cập nhật quy tắc bảo mật:
```bash
npx firebase deploy --only firestore:rules
```

## Vai trò & phân quyền

Hệ thống có 10 vai trò (giáo viên, nhóm trưởng, tổ trưởng, hiệu phó, hiệu trưởng, văn thư,
kế toán, công đoàn, thanh tra, quản trị). Một người có thể giữ nhiều vai trò và chuyển đổi
vai trò thao tác trên thanh điều hướng.

Bảng năng lực nằm trong [`Edu-task/lib/permissions.ts`](./Edu-task/lib/permissions.ts);
màn hình Quản trị RBAC hiển thị ma trận sinh trực tiếp từ bảng này nên không bao giờ lệch
với logic đang chạy.

## Đánh giá codebase

Xem [REVIEW.md](./REVIEW.md) để biết hiện trạng kỹ thuật, các vấn đề đã xử lý và lộ trình
nâng cấp tính năng.
