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
| Cài trên máy | PWA (service worker + web manifest) |

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
   NEXT_PUBLIC_FIREBASE_UPLOAD_BUCKET=edutask
   ```
   `NEXT_PUBLIC_FIREBASE_UPLOAD_BUCKET` là bucket Storage **riêng** dùng cho file đính
   kèm (mặc định `edutask`), khác với `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` là bucket
   mặc định của dự án. Cả Firestore và Storage đều dùng tài nguyên đặt tên riêng chứ
   không dùng bản mặc định.
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
| `npm run test:rules` | Kiểm thử quy tắc bảo mật Firestore trên trình giả lập |
| `npm run lint` | Chỉ chạy ESLint |

### Thông báo đẩy (FCM)

Cho phép nhắc việc và đơn cần duyệt **hiện lên màn hình điện thoại kể cả khi không mở
ứng dụng**. Toàn bộ phần này là tùy chọn: thiếu cấu hình thì app chạy y như cũ, chỉ là
thông báo dừng lại trong chuông thay vì ra tới điện thoại.

**Bước 1 — Lấy khóa VAPID** (chỉ làm một lần):
Firebase Console → ⚙ Project settings → **Cloud Messaging** → *Web configuration* →
**Generate key pair**. Copy chuỗi đó vào `.env.local`:

```
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BB...
```

**Bước 2 — Triển khai Cloud Functions** (cần gói **Blaze**):

```bash
npx firebase deploy --only functions --project app-from-ai
```

Ba hàm được triển khai, tất cả ở vùng `asia-southeast1` (Singapore — gần Việt Nam nhất):

| Hàm | Khi nào chạy | Việc |
|---|---|---|
| `onNotificationCreated` | Mỗi khi có bản ghi mới trong `notifications` | Đẩy thông báo tới mọi thiết bị của người nhận |
| `runReminderSchedules` | Mỗi giờ | Bắn các lịch nhắc tới giờ đã cài |
| `dailyDueDigest` | 07:00 hằng ngày | Một tin tổng hợp việc sắp đến hạn cho mỗi người |

> **Thiết kế đáng lưu ý:** `onNotificationCreated` bám vào collection `notifications`
> chứ không bám vào từng nghiệp vụ. Mọi tính năng hiện có đã ghi notification khi có
> việc đáng báo, nên **một trigger phủ hết tất cả** — và mọi module thêm về sau tự động
> có thông báo đẩy mà không phải viết thêm hàm nào.

**Múi giờ:** mọi lịch chạy theo `Asia/Ho_Chi_Minh`. Bỏ qua thiết lập này thì lịch nhắc
07:30 sẽ bắn lúc 14:30 giờ Việt Nam.

**Giới hạn của iPhone:** web push trên iOS chỉ hoạt động khi đã **Thêm vào Màn hình
chính** và máy chạy iOS 16.4 trở lên. Đây là quy định của Apple; ứng dụng phát hiện
trường hợp này và hướng dẫn thay vì hiện một nút bấm vào không có tác dụng.

**Logic dùng chung:** hàm chạy theo lịch dùng **đúng** các hàm tính toán mà trình duyệt
dùng — chúng được `scripts/sync-shared-logic.mjs` chép sang `functions/src/shared/` ở mỗi
lần build và **không bao giờ sửa tay**. Viết bản thứ hai cho máy chủ sẽ dẫn tới cảnh app
báo hạn một đằng, máy chủ nhắc một nẻo, mà không ai biết bên nào đúng.

### Kiểm thử quy tắc bảo mật

`firestore.rules` là **ranh giới phân quyền duy nhất** của ứng dụng, nên nó được kiểm
chứng bằng test chạy trên Firestore Emulator chứ không chỉ dựa vào đọc review:

```bash
npm run test:rules
```

**Yêu cầu: JDK 21 trở lên** (trình giả lập chạy trên JVM; `firebase-tools` từ chối bản
Java cũ hơn). Cài trên Windows:

```bash
winget install --id Microsoft.OpenJDK.21
```

Bộ test dùng project id `demo-edutask-rules` — tiền tố `demo-` khiến trình giả lập chạy
hoàn toàn ngoại tuyến, nên **không có đường nào chạm tới dự án thật**. Rules được nạp
thẳng từ file thay vì qua `firebase.json`, vì dự án gắn rules vào database có tên riêng
(`edutask`) trong khi thư viện test nói chuyện với database mặc định.

Các test này **cố ý tách khỏi `npm test`**: gộp vào sẽ khiến `npm test` hỏng trên mọi
máy chưa cài Java, tức bắt cả nhóm trả giá cho một phụ thuộc chỉ riêng chúng cần.

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
firestore.rules          Quy tắc bảo mật Firestore — ranh giới bảo mật thật sự
storage.rules            Quy tắc bảo mật cho bucket file đính kèm
```

## Triển khai

Đẩy lên nhánh `main` sẽ kích hoạt [GitHub Actions](.github/workflows/deploy.yml):
type-check → unit test → build → deploy `firestore.rules` → deploy hosting.

> ⚠️ **Bước deploy rules hiện chưa tự động được.** Service account triển khai
> thiếu quyền gọi `serviceusage.googleapis.com`, nên Firebase CLI báo 403 khi
> kiểm tra API trước lúc deploy. Bước này được đặt `continue-on-error` để không
> chặn deploy hosting; khi nó thất bại, CI in cảnh báo và **bạn phải áp dụng
> `firestore.rules` thủ công** qua Firebase Console.
>
> Để bật lại tự động hoàn toàn: vào Google Cloud Console → IAM, cấp cho service
> account triển khai hai vai trò `roles/serviceusage.serviceUsageConsumer` và
> `roles/firebaserules.admin`, rồi đổi `continue-on-error` thành `false` trong
> `deploy.yml`.

Triển khai thủ công:
```bash
npm run build && npx firebase deploy
```

Chỉ cập nhật quy tắc bảo mật:
```bash
npx firebase deploy --only firestore:rules,storage
```

## Cài như ứng dụng (PWA)

Mở web trên điện thoại/máy tính rồi chọn **Cài đặt / Thêm vào màn hình chính**. Sau khi cài:

- App **mở được kể cả khi mất mạng** — service worker precache toàn bộ giao diện ngay lúc
  build, nên chạy được từ lần truy cập đầu tiên chứ không phải đợi lần thứ hai.
- Dữ liệu khi ngoại tuyến là bản đã tải trước đó. **Không lưu được thay đổi khi offline** —
  app hiện banner cảnh báo ngay, thay vì để người dùng điền xong form rồi mới báo lỗi.
- Có bản mới thì app hiện nút *"Đã có phiên bản mới — bấm để cập nhật"*.

Đổi icon: sửa `scripts/generate-icons.mjs` rồi chạy `node scripts/generate-icons.mjs`.
Danh sách file precache được sinh tự động sau mỗi `npm run build`.

> Service worker cố ý **không** cache bất kỳ request nào tới Firestore, Auth, Storage hay
> Telegram — chỉ xử lý tài nguyên cùng origin. Nhờ vậy không bao giờ trả về dữ liệu API cũ,
> và không can thiệp vào luồng đăng nhập.

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
