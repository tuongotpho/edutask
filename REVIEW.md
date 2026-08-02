# Báo Cáo Đánh Giá Codebase — EduTask

> Ngày review: 2026-08-02 · Commit gốc: `95d70fc` · Người thực hiện: Claude (Opus 4.8)
> Phạm vi: toàn bộ source (41 file, ~5.200 dòng), firestore.rules, CI/CD, dependencies.

---

## 1. Tóm Tắt Điều Hành

**Xếp hạng tổng thể: 6.5/10** — Kiến trúc và tổ chức code tốt hơn mặt bằng dự án cùng loại, nhưng có một lỗi chặn khiến **repo không build được**, và một lỗ hổng kiến trúc khiến dữ liệu cấu hình không đồng bộ giữa các máy.

| Hạng mục | Điểm | Ghi chú |
|---|---|---|
| Tổ chức code | 8/10 | Tách hooks theo domain rất rõ ràng, dễ đọc |
| An toàn kiểu (TypeScript) | 8/10 | `strict: true`, `tsc` sạch |
| Bảo mật | 7/10 | Rules đã siết tốt; còn phụ thuộc hoàn toàn client-side |
| Tính đúng đắn | 5/10 | Build vỡ, đồng bộ dữ liệu không nhất quán |
| Hoàn thiện tính năng | 5/10 | Nhiều UI "vỏ": upload file, workflow rules, RBAC matrix |
| Kiểm thử | 2/10 | Không có test tự động nào |
| Vận hành (CI/CD) | 5/10 | CI không deploy security rules |

**Ba việc cần làm ngay:**
1. ~~Sửa build vỡ do thiếu `react-datepicker`~~ → **đã sửa**
2. ~~Đưa `departments` / `schoolName` lên Firestore~~ → **đã sửa**
3. ~~Bổ sung deploy `firestore.rules` vào CI~~ → **đã sửa**

> **Trạng thái:** toàn bộ P0–P3 đã được xử lý (xem §5), trừ P3-8 được cố ý bỏ qua kèm lý do. Việc còn lại là các đề xuất nâng cấp tính năng ở §6.

---

## 2. Kiến Trúc Tổng Quan

```
Next.js 15 App Router  ──(output: 'export')──►  SPA tĩnh trên Firebase Hosting
         │
         └── app/page.tsx  (một client component duy nhất, 148 dòng)
                  │
                  └── AppProvider (Context API)
                          ├── useAuthLogic       → firebaseAuthService
                          ├── useUserLogic       → firebaseService
                          ├── useTaskLogic       → firebaseService
                          ├── useLeaveLogic      → firebaseService
                          └── useDepartmentLogic → ⚠️ CHỈ localStorage
                                    │
                          Firestore (database: 'edutask') ◄── firestore.rules
```

**Đặc điểm quyết định:** không có tầng server. `output: 'export'` sinh HTML tĩnh, mọi truy cập dữ liệu đi thẳng từ browser tới Firestore.

**Hệ quả:** `firestore.rules` là **ranh giới bảo mật duy nhất**. Toàn bộ kiểm tra quyền trong React (`isAdmin`, `canAssign`, `visibleLeaves`…) chỉ là trải nghiệm người dùng — kẻ tấn công mở DevTools gọi thẳng Firestore SDK sẽ bỏ qua hết. Đây không phải lỗi, nhưng là điều phải luôn ghi nhớ: **mọi quy tắc nghiệp vụ quan trọng phải được biểu diễn lại trong rules.**

---

## 3. Tình Trạng Kiểm Chứng

| Kiểm tra | Trước phiên này | Sau khi sửa |
|---|---|---|
| `npx tsc --noEmit` | ✅ Pass | ✅ Pass |
| `npm run build` | ❌ **Fail** (module not found) | ✅ Pass |
| `npm test` | *Không tồn tại* | ✅ 53 test / 2 file |
| `npx eslint` | 5 vấn đề (bị tắt lúc build) | ✅ **0 lỗi, 0 cảnh báo** — và đã bật lại trong build |
| `npm audit` | 13 lỗ hổng | **9** (bỏ `firebase-admin` cắt được 4; số còn lại đều thuộc dev/build tooling) |
| First Load JS (`/`) | 360 kB | **297 kB** (−18% nhờ code-splitting) |

---

## 4. Danh Mục Vấn Đề

### 🔴 P0 — Chặn phát hành

#### P0-1. Thiếu dependency `react-datepicker` → build vỡ hoàn toàn ✅ ĐÃ SỬA
`TaskFormModal.tsx:7` và `TaskDetailModal.tsx:8` import `react-datepicker`, nhưng `package.json` chỉ khai báo `@types/react-datepicker`.

Đây là loại lỗi dễ lọt lưới nhất: `tsc` **pass** vì gói `@types` cung cấp đủ khai báo kiểu, trong khi module thật không tồn tại. Chỉ khi webpack bundle mới lộ ra:
```
Module not found: Can't resolve 'react-datepicker'
```
Nghĩa là CI trên `main` đang đỏ và **không bản nào deploy được** kể từ khi hai component này được thêm.

**Đã xử lý:** cài `react-datepicker@9.1.0`, gỡ `@types/react-datepicker@6` (v9 tự ship types, giữ lại sẽ xung đột). Build và typecheck đều pass.

> **Bài học:** `tsc --noEmit` không thay thế được `npm run build`. Nên chạy cả hai trong CI.

---

### 🟠 P1 — Nghiêm trọng ✅ ĐÃ SỬA TOÀN BỘ

#### P1-1. `departments` và `schoolName` chỉ lưu localStorage ✅ ĐÃ SỬA
`useDepartmentLogic.ts` ghi qua `storage.saveDepartments()` / `storage.saveSchoolName()` — **không hề chạm tới Firestore**.

Hậu quả thực tế:
- Admin thêm "Tổ Giáo Dục Thể Chất" trên máy A → máy B, điện thoại, và mọi giáo viên khác **không thấy tổ đó**.
- Đổi tên trường chỉ đổi trên trình duyệt của người thao tác.
- Xóa cache trình duyệt = mất toàn bộ cấu hình tổ.
- `updateDepartment` có đồng bộ `departmentName` xuống users/leaves trên Firestore, nhưng bản thân danh sách tổ thì không → dữ liệu lệch pha.

**Khuyến nghị:** tạo collection `departments` và `settings/school` trên Firestore, thêm `subscribeDepartments()` vào `firebaseService`, siết rules cho phép đọc với mọi user đã đăng nhập và chỉ admin được ghi.

#### P1-2. CI không deploy `firestore.rules` ✅ ĐÃ SỬA
`.github/workflows/deploy.yml` chỉ chạy `action-hosting-deploy` (hosting). Rules phải deploy thủ công bằng `firebase deploy --only firestore:rules`.

Rủi ro: code mới giả định rules mới, nhưng production vẫn chạy rules cũ → hoặc app lỗi quyền, hoặc lỗ hổng tưởng đã vá vẫn còn mở. Các thay đổi siết bảo mật ở phiên trước **hiện chưa có hiệu lực trên production** cho tới khi deploy tay.

**Khuyến nghị:** thêm step deploy rules vào workflow (dùng `w9jds/firebase-action` hoặc `firebase-tools` với service account có sẵn).

#### P1-3. Ghi Firestore kiểu "fire-and-forget", không rollback ✅ ĐÃ SỬA
Xuyên suốt `useTaskLogic` / `useLeaveLogic`:
```ts
setTasks(updatedTasks);              // cập nhật UI ngay
storage.saveTasks(updatedTasks);     // ghi localStorage
firebaseService.saveTask(newTask);   // ⚠️ không await, không .catch()
```
Nếu Firestore từ chối (mất mạng, hoặc **bị rules chặn**), UI vẫn báo thành công, localStorage vẫn lưu, người dùng tin việc đã được giao. Chỉ tới lần `onSnapshot` sau dữ liệu mới âm thầm biến mất.

Vấn đề này **nghiêm trọng hơn sau khi siết rules** ở phiên trước: các thao tác nay có thể bị từ chối một cách hợp lệ, và người dùng sẽ không nhận được thông báo nào.

**Khuyến nghị:** `await` các lời gọi ghi, bọc `try/catch`, hiển thị toast lỗi và rollback state khi thất bại.

#### P1-4. Danh sách tổ bị hardcode ở hai nơi ✅ ĐÃ SỬA
- `RbacConfigTab.tsx:884-889` — modal sửa vai trò render cứng 6 `<option>` tổ, bỏ qua `departments` từ context. Tổ do admin tự thêm **không bao giờ xuất hiện** ở đây.
- `LoginPage.tsx:26,41,238` — form đăng ký dùng `INITIAL_DEPARTMENTS` import trực tiếp từ `storage.ts` thay vì state.

Kết quả: giáo viên mới chỉ chọn được 6 tổ mặc định, và admin không gán được người vào tổ mới tạo.

---

### 🟡 P2 — Trung bình ✅ ĐÃ SỬA TOÀN BỘ

#### P2-1. Ba khối UI chỉ là "vỏ", không có chức năng ✅ ĐÃ SỬA
| Vị trí | Hiện trạng |
|---|---|
| `LeaveFormModal.tsx:213-220` | Ô upload minh chứng — **không có `<input type="file">`**, không handler. `proofFiles` luôn `[]` |
| `RbacConfigTab.tsx:241-265` | Hai công tắc workflow (`autoApprove1Day`, `allowSecretaryViewAll`) là `useState` cục bộ, không lưu, không ảnh hưởng logic nào |
| `RbacConfigTab.tsx:86-93` | Ma trận RBAC hardcode, thuần hiển thị — không phải nguồn phân quyền thật |

Người dùng cuối (hiệu trưởng, admin) rất dễ hiểu nhầm rằng bật/tắt công tắc là đã đổi quy trình duyệt. **Nên ẩn đi hoặc gắn nhãn "Sắp ra mắt"** cho tới khi làm thật.

#### P2-2. Thông báo không bao giờ đánh dấu đã đọc ✅ ĐÃ SỬA
`storage.markNotificationRead()` được định nghĩa nhưng **chưa từng được gọi** (xác minh: 1 occurrence duy nhất = chính định nghĩa). Rules đã cho phép cập nhật `isRead`, nhưng UI không có nút. Badge đỏ trên chuông sẽ tăng vĩnh viễn.

#### P2-3. Quyền "giao việc" không nhất quán giữa 3 nơi ✅ ĐÃ SỬA
| File | Điều kiện |
|---|---|
| `Sidebar.tsx:61` | PRINCIPAL, VICE_PRINCIPAL, HEAD_OF_DEPT, GROUP_LEADER, **ADMIN** |
| `TaskTab.tsx:32` | PRINCIPAL, VICE_PRINCIPAL, HEAD_OF_DEPT |
| `OverviewTab.tsx:103` | PRINCIPAL, VICE_PRINCIPAL, HEAD_OF_DEPT |

Admin thấy nút "Giao Việc Mới" ở sidebar nhưng không thấy ở tab Công việc và Tổng quan. Nhóm trưởng cũng vậy.

**Khuyến nghị:** rút thành một helper dùng chung, ví dụ `lib/permissions.ts` → `canAssignTask(user, activeRole)`.

#### P2-4. Markdown lọt vào JSX ✅ ĐÃ SỬA
`PendingApprovalPage.tsx:50` viết `**Quản trị viên / Ban Giám Hiệu**` — JSX không xử lý markdown, người dùng nhìn thấy đúng hai dấu sao. Thay bằng `<strong>`.

#### P2-5. Xóa tổ không kiểm tra ràng buộc đơn nghỉ ✅ ĐÃ SỬA
`RbacConfigTab.tsx:214` chặn xóa khi tổ còn thành viên, nhưng không kiểm tra `leaves` đang tham chiếu `departmentId`. Đơn cũ sẽ trỏ tới tổ không tồn tại.

#### P2-6. Không có test tự động ✅ ĐÃ SỬA
`e2e-test.ts` (304 dòng, Puppeteer) tồn tại nhưng **không có script nào trong `package.json`** để chạy, không nằm trong CI. Với một hệ thống có luồng phê duyệt nhiều cấp và phân quyền phức tạp, đây là rủi ro hồi quy lớn.

**Khuyến nghị tối thiểu:** unit test cho `getTeacherLeaveConflict` và `processLeaveStep` (logic thuần, dễ test, và là nơi sai sót gây hậu quả nghiệp vụ nặng nhất).

#### P2-7. Hiệu năng: 360 kB First Load JS ✅ ĐÃ SỬA
Toàn bộ ứng dụng là một client component. Mọi tab (kể cả Analytics, RBAC mà giáo viên thường không mở) đều nằm trong bundle đầu tiên.

**Khuyến nghị:** `next/dynamic` cho `RbacConfigTab`, `AnalyticsTab`, `SchoolTimelineTab` và các modal.

---

### 🔵 P3 — Nhỏ / Dọn dẹp ✅ ĐÃ SỬA (trừ P3-8, xem ghi chú)

| # | Vấn đề | Vị trí |
|---|---|---|
| P3-1 | `@google/genai` khai báo trong deps nhưng **0 lần sử dụng** | `package.json` |
| P3-2 | `firebase-admin` khai báo trong deps nhưng **0 lần sử dụng** (kéo theo phần lớn cảnh báo `npm audit`) | `package.json` |
| P3-3 | Code chết: `useIsMobile`, `PERMISSIONS`, `WorkflowRule`, `loginAsDemoUser`, `switchUser`, `resetSystemData` — định nghĩa và truyền qua context nhưng không có nơi gọi | nhiều file |
| P3-4 | Hàng chục import icon không dùng (Navbar, LeaveTab, TaskTab, OverviewTab…). Không ai phát hiện vì `eslint.ignoreDuringBuilds: true` | nhiều file |
| P3-5 | `Navbar.tsx:180` — `fullName.split(' ').slice(-1)[0][0]` sẽ ném lỗi nếu `fullName` rỗng | Navbar |
| P3-6 | README vẫn là template Google AI Studio, không mô tả dự án thật | `README.md` |
| P3-7 | `metadata.json` khai báo `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` dù app không dùng AI | `metadata.json` |
| P3-8 | Thư mục `Edu-task` (hoa + gạch nối) lệch quy ước với `app/`; rủi ro phân biệt hoa–thường khi build trên Linux | cấu trúc |
| P3-9 | `addDepartment` dùng `DEPT_${Date.now()}` — cùng lỗi trùng ID đã sửa cho task/leave | `useDepartmentLogic.ts:31` |

---

## 5. Đã Xử Lý Trong Phiên Này

### Bảo mật (`firestore.rules`)
- **Tasks update:** viewer thường không còn ghi đè được `assignerId`, `viewerIds`, `id`, `code`, `createdAt`, `visibilitySettings` → chặn assignee chiếm quyền hoặc sửa ACL.
- **Users update:** thêm `activeRole` vào danh sách khóa → chặn tự nâng quyền để lộ UI quản trị.
- **Leaves create:** bắt buộc `departmentId` khớp hồ sơ người nộp → không định tuyến đơn sang tổ khác.
- **Notifications create:** thêm kiểm tra kiểu chuỗi cho `recipientUserId`/`title`/`message`.

### Sửa lỗi
- `react-datepicker` — cài thiếu, build vỡ (P0-1).
- `deleteLeaveRequest` — chỉ xóa local, đơn "hồi sinh" ở snapshot kế tiếp. Đã thêm `firebaseService.deleteLeave()`.
- `resetSystemData` — crash do `loadedUsers[2]` không tồn tại sau reset.
- Trùng ID task/leave — thay `Date.now()` bằng `genId()` (timestamp + entropy ngẫu nhiên).
- Race điều kiện đặt `currentUser` ở hai nơi — `useAuthLogic` nay nhường hoàn toàn cho effect `onAuthChange`.

### Chất lượng
- Gom `sanitizeForFirestore` trùng lặp về `lib/utils.ts`.
- `storage.getCurrentUserId()` bỏ mặc định `USR_003` (user demo đã xóa).
- Sửa comment lỗi encoding trong `next.config.ts`; đổi `<title>` sang branding EduTask.

### Đợt 2 — Xử lý toàn bộ P1

**P1-1 · Cấu hình lên Firestore**
- Thêm collection `departments` và document `settings/school`, kèm `subscribeDepartments()` / `subscribeSchoolName()` / `saveDepartment()` / `deleteDepartment()` / `saveSchoolName()`.
- Rules mới: mọi user đã đăng nhập được đọc, chỉ admin được ghi.
- **Tự động migrate:** lần đầu chạy với collection rỗng, admin đăng nhập sẽ seed `INITIAL_DEPARTMENTS` bằng `writeBatch` (all-or-nothing). Client không rỗng hóa danh sách khi chờ seed, nên không có khoảnh khắc dropdown trống.
- `deleteDepartment` nay chặn cả khi còn **đơn nghỉ** tham chiếu (trước chỉ chặn theo thành viên) — vá luôn P2-5.

**P1-2 · CI deploy rules**
Thêm step `Deploy Firestore Security Rules` chạy **trước** hosting: nếu rules bị từ chối, frontend cũ vẫn chạy với rules cũ thay vì lệch cặp. Dùng service account sẵn có, ghi file credential tạm rồi xóa ngay sau khi deploy.

**P1-3 · Await + rollback + toast**
- Thêm `components/common/Toast.tsx` và `toasts` / `showToast` / `dismissToast` trong `AppContext`; `ToastViewport` render cạnh app shell nên phủ cả màn hình đăng nhập.
- Mỗi hook nghiệp vụ có helper `commit()`: cập nhật lạc quan → `await` ghi Firestore → nếu lỗi thì **khôi phục state cũ + localStorage** và báo lỗi.
- Toàn bộ mutation đổi sang `async`, trả `Promise<boolean>` (hoặc `Promise<T | null>` với hàm tạo). Modal chỉ đóng khi ghi thành công — người dùng không mất dữ liệu đã nhập.
- `firebaseService.deleteTask/deleteLeave` bỏ `try/catch` tự nuốt lỗi, để lỗi truyền lên cho caller rollback.
- Thông báo (notification) cố tình **không** rollback bản ghi chính: gửi hụt thông báo thì chỉ log, không hủy công việc/đơn nghỉ vừa tạo.
- Thay 8 lời gọi `alert()` bằng toast.

**P1-4 · Bỏ hardcode danh sách tổ**
- `RbacConfigTab` — modal sửa vai trò nay render từ `departments`.
- `LoginPage` — dùng `departments` từ context thay cho `INITIAL_DEPARTMENTS`.

**Tiện thể:** sửa `TaskFormModal` gửi kèm `targetUserIds` thừa khi giao việc cho cả tổ; `addDepartment` dùng `genId()` thay `Date.now()`.

### Đợt 3 — Xử lý toàn bộ P2

**P2-3 · Tập trung hóa phân quyền** *(làm trước vì P2-1 và P2-6 phụ thuộc)*
- Thêm `lib/permissions.ts`: một bảng `ROLE_CAPABILITIES` duy nhất + các helper `canAssignTask` / `canViewStats` / `canViewLeave` / `isAdmin` / `canApproveLeaveStep`.
- Thay thế logic nội tuyến ở **8 component** và `useLeaveLogic`. `LeaveDetailModal` và `processLeaveStep` nay dùng chung `canApproveLeaveStep`, nên nút duyệt không bao giờ hiện ra cho thao tác mà handler sẽ từ chối.
- **Quy ước đã chốt:** hiển thị dựa trên *vai trò hữu hiệu* (vai trò đang chọn + mọi vai trò được gán); còn *phê duyệt* chỉ dựa trên vai trò đang chọn — ký duyệt là hành vi thực hiện **với tư cách** một vai trò cụ thể.

**P2-1 · UI trung thực**
- Ma trận RBAC nay **sinh trực tiếp** từ `ROLE_CAPABILITIES` → không thể lệch với logic thật như bản hardcode cũ.
- Công tắc workflow: `disabled` + nhãn "SẮP RA MẮT" + ghi rõ luồng duyệt hiện tại cố định 2 cấp.
- Ô upload minh chứng: nêu rõ đang phát triển và hướng dẫn nộp bản cứng cho Văn thư.

**P2-2 · Đánh dấu thông báo đã đọc**
Thêm `markNotificationRead` / `markAllNotificationsRead` (dùng `updateDoc` đúng phạm vi rules cho phép, và `writeBatch` cho thao tác hàng loạt). Navbar có chấm xanh phân biệt chưa đọc, click từng mục, và nút "Đánh dấu tất cả đã đọc".

**P2-4 · Markdown lọt vào JSX** — `**...**` → `<strong>`.

**P2-6 · Kiểm thử tự động**
- Tách logic thuần ra `lib/leaveConflict.ts` để test được mà không cần React.
- Thêm Vitest + **53 test**: quy tắc trùng lịch (chồng ngày, buổi sáng/chiều, trạng thái đơn, loại trừ đơn đang sửa) và toàn bộ ma trận phân quyền.
- CI nay chạy `tsc` + `npm test` **trước** khi build.

**P2-7 · Code-splitting**
`next/dynamic` cho RBAC / Analytics / Timeline và 4 modal; các modal chỉ mount khi mở nên chunk (kèm date picker) chỉ tải khi thực sự dùng. **361 kB → 298 kB.**

**Tiện thể:** dọn ~20 import icon thừa; vá `Navbar` crash khi `fullName` rỗng (P3-5).

**Trạng thái kiểm chứng:** `tsc --noEmit` ✅ · `npm test` ✅ 53/53 · `npm run build` ✅ · `eslint` ✅ (5 cảnh báo còn lại đều là pattern có sẵn từ trước, không phát sinh từ các thay đổi này)

### Đợt 4 — Xử lý P3 (dọn dẹp)

**P3-1/P3-2 · Dependency thừa** — gỡ `@google/genai` và `firebase-admin` (cả hai 0 lần dùng, kể cả trong script gốc). `npm audit`: **13 → 9** lỗ hổng.

**P3-3 · Xóa code chết** — `useIsMobile` (xóa file), `PERMISSIONS` cũ trong `types/user.ts` (đã bị `lib/permissions.ts` thay thế), `loginAsDemoUser`, `switchUser`, `resetSystemData`, `seedInitialDataIfEmpty`, và 7 phương thức `storage` không ai gọi (`getCurrentUserId`, `setCurrentUserId`, `addLeave`, `updateLeave`, `addTask`, `updateTask`, `resetAllData`).
`resetSystemData` đáng chú ý: nó chỉ xoá localStorage — sau khi dữ liệu chuyển lên Firestore, một nút "reset hệ thống" chỉ dọn cache máy cục bộ là **gây hiểu nhầm nguy hiểm**, nên xoá hẳn thay vì giữ.
Giữ lại `WorkflowRule` (chưa dùng) vì đây là nền cho tính năng cấu hình luồng duyệt ở §6.

**P3-4 · Import thừa + bật lại ESLint**
- Bật `@typescript-eslint/no-unused-vars` → lộ ra **52 lỗi**; đã dọn sạch ~45 import icon/type thừa và 5 biến không dùng.
- `next.config.ts`: `eslint.ignoreDuringBuilds` **false** — lint lại gác cổng build (đây chính là lý do đống import thừa tích tụ mà không ai thấy).
- Để bật được, phải xử lý 3 lỗi `set-state-in-effect` tồn đọng: hai modal bỏ effect-đồng-bộ-state, chuyển sang khởi tạo `useState` + `key` remount ở call site; riêng effect Firebase Auth giữ lại kèm `eslint-disable` một dòng và lý do (đồng bộ hệ thống ngoài là đúng mục đích của effect).
- **Sửa được một bug thật nhờ việc này:** `LeaveDetailModal` trước đây đồng bộ lại state trên **mỗi** snapshot Firestore, nên người duyệt vừa chọn giáo viên dạy thay thì lựa chọn đó bị xoá ngay khi có bản cập nhật bất kỳ.
- Sửa nốt cảnh báo `exhaustive-deps`: effect đăng ký Firestore nay phụ thuộc các giá trị nguyên thủy thay vì cả object `currentUser` — trước đây object đổi định danh mỗi snapshot sẽ dựng lại toàn bộ subscription.
- `not-found.tsx`: `<a>` → `<Link>`.

**P3-6/P3-7** — README viết lại hoàn toàn (kiến trúc, biến môi trường, lệnh, cấu trúc thư mục, triển khai) thay cho template AI Studio; `metadata.json` bỏ khai báo năng lực Gemini không dùng.

**P3-5 / P3-9** — đã xử lý ở các đợt trước.

#### ⚠️ P3-8 — cố ý KHÔNG làm
Đổi tên thư mục `Edu-task/` → `src/`. Rủi ro được nêu ban đầu là phân biệt hoa–thường khi build trên Linux, nhưng đã kiểm chứng: **115/115 import dùng đúng `@/Edu-task`**, khớp tuyệt đối với tên thư mục thật — nên rủi ro này *không tồn tại*. Phần còn lại thuần thẩm mỹ, trong khi việc đổi tên đụng 115 câu lệnh import trên ~30 file, tạo diff khổng lồ và dễ xung đột với nhánh khác. Đánh giá: lợi ích không tương xứng rủi ro. Nếu vẫn muốn làm, đây là thao tác cơ học và nên làm riêng một commit độc lập.

**Trạng thái kiểm chứng:** `tsc --noEmit` ✅ · `npm test` ✅ 53/53 · `npm run build` ✅ (đã bật lint) · `eslint` ✅ **0 lỗi, 0 cảnh báo**

> ⚠️ **Rules chưa được deploy.** Lần deploy tới CI sẽ tự làm; nếu muốn áp dụng ngay: `firebase deploy --only firestore:rules`.

---

## 5b. Đợt 5 — Lỗi phát hiện thêm sau khi rà lại

Bản review ban đầu bị giới hạn thời gian và bỏ sót bốn lỗi thật. Rà lại lần hai tìm ra:

#### B1. Giáo viên dạy thay không bao giờ nhìn thấy đơn mình phải dạy thay 🔴
`subscribeLeaves` lọc `applicantId == userId` cho vai trò TEACHER. Nhưng theo thiết kế
(và theo `firestore.rules`, và theo `canViewLeave`) người được phân công dạy thay **cũng**
phải xem được đơn đó.

Vì query không bao giờ lấy document về client, bộ lọc `l.substituteTeacherId === currentUser.id`
ở Sidebar/LeaveTab **không thể khớp** — nó lọc trên dữ liệu chưa từng tồn tại. Kết quả: giáo
viên được phân công dạy thay không nhận được thông tin gì trong ứng dụng.

**Đã sửa:** chạy hai truy vấn (`applicantId` và `substituteTeacherId`) rồi gộp, khử trùng theo
`id`. Cố ý không dùng `or()` — truy vấn tuyển có thể đòi composite index riêng, trong khi hai
equality filter đơn lẻ thì Firestore luôn phục vụ được bằng index mặc định.

#### B2. Hiển thị "3 cấp" nhưng luồng duyệt chỉ có 2 bước
`createLeaveRequest` tạo đúng 2 bước (Nhóm/Tổ trưởng → BGH), nhưng LeaveTab ghi cứng
`Bước ${i+1}/3` và `Đã hoàn tất (3/3)`. Đơn duyệt xong hiển thị "Bước 2/3" và không bao giờ
tới 3. **Đã sửa:** suy ra từ `leave.steps.length`; sửa cả tiêu đề mô tả quy trình.

#### B3. Trạng thái `OVERDUE` không nơi nào sinh ra
`TaskStatus` khai báo `OVERDUE`, `TASK_STATUS_CONFIG` có nhãn, bộ lọc có tuỳ chọn "Quá hạn" —
nhưng **không dòng code nào từng gán trạng thái này**. Lọc "Quá hạn" luôn trả về rỗng, và việc
trễ hạn không có dấu hiệu nào.

**Đã sửa:** thêm `lib/taskStatus.ts` với `isTaskOverdue` / `getDisplayTaskStatus` (trạng thái
suy diễn, không lưu xuống DB). Bộ lọc và nhãn dùng trạng thái hiển thị; **cột Kanban vẫn dùng
trạng thái gốc** để việc trễ hạn không biến mất khỏi cột quy trình của nó.
Quy ước đã chốt: việc đã nộp nhưng chưa nghiệm thu vẫn tính là quá hạn — hạn chót là để *hoàn
thành*, không phải để *nộp*.

#### B4. Bộ lọc đơn nghỉ thiếu trạng thái "Đã hủy"
Danh sách render được `CANCELLED` nhưng dropdown không có tuỳ chọn tương ứng. **Đã sửa.**

**Kiểm chứng:** `tsc` ✅ · `npm test` ✅ **64/64** (thêm 11 test cho `taskStatus`) · `eslint` ✅ · `build` ✅

---

## 6. Gợi Ý Nâng Cấp Tính Năng

Sắp theo tỉ lệ **giá trị / công sức**, cao nhất trước.

### 🥇 Nhóm 1 — Hoàn thiện cái đang dang dở (giá trị cao, công sức thấp)

**1. Upload file minh chứng thật (Firebase Storage)**
Ô upload đã có sẵn giao diện, `AttachmentFile` đã có sẵn type, `proofFiles`/`attachments` đã có trong schema. Chỉ thiếu phần nối dây. Đây là tính năng người dùng mong đợi nhất ở một hệ thống đơn từ (giấy khám bệnh, công văn).
*Ước lượng: 0.5–1 ngày.*

**2. Đánh dấu thông báo đã đọc + điều hướng**
`markNotificationRead` và rules đã sẵn sàng. Thêm `onClick` vào từng dòng thông báo → gọi update `isRead` + mở đúng đơn/việc qua `linkUrl` (trường này đã có trong type nhưng chưa dùng).
*Ước lượng: 2–3 giờ.*

**3. Tập trung hóa logic phân quyền**
Tạo `lib/permissions.ts` với `canAssignTask()`, `canViewStats()`, `canApproveLeaveAt(step)`, `isAdmin()`. Hiện các biểu thức này bị sao chép 4–6 lần với nội dung lệch nhau (P2-3), là nguồn bug âm thầm.
*Ước lượng: 3–4 giờ. Trả nợ kỹ thuật lớn.*

### 🥈 Nhóm 2 — Nâng cấp nền tảng

**4. Đưa cấu hình lên Firestore** (giải quyết P1-1)
Collection `departments` + document `settings/school`. Đây là điều kiện tiên quyết để hệ thống dùng được trên nhiều máy — hiện tại mỗi trình duyệt là một "ốc đảo" cấu hình.

**5. Lớp xử lý lỗi + toast** (giải quyết P1-3)
Thay `alert()` (đang dùng 8 chỗ) bằng toast component. Bọc mọi ghi Firestore trong `try/catch` có rollback. Cải thiện đồng thời độ tin cậy lẫn cảm nhận chất lượng.

**6. Cấu hình workflow duyệt thật** (giải quyết P2-1)
`WorkflowRule` đã được định nghĩa sẵn trong `types/leave.ts` nhưng chưa dùng. Cho phép admin cấu hình: nghỉ ≤ 1 ngày chỉ cần tổ trưởng duyệt; nghỉ > 3 ngày bắt buộc hiệu trưởng. Đây là nhu cầu vận hành có thật của trường học.

### 🥉 Nhóm 3 — Tính năng mới có sức thuyết phục

**7. Xuất PDF / Excel đơn nghỉ**
Trường học cần bản in có chữ ký để lưu sổ. Văn thư (`SECRETARY`) đã có trong hệ vai trò và được mô tả là "xuất file PDF lưu trữ" — nhưng chưa hiện thực. Dùng `@react-pdf/renderer` hoặc in qua CSS `@media print`.

**8. Thông báo email / push khi có đơn cần duyệt**
Hiện thông báo chỉ hiển thị trong app — tổ trưởng phải tự mở web mới biết có đơn chờ. Cần Cloud Functions (buộc nâng lên gói Blaze) hoặc tích hợp EmailJS phía client cho phương án nhẹ.

**9. Lịch trực quan (calendar view)**
`SchoolTimelineTab` hiện là lưới thẻ giáo viên. Một calendar tháng thể hiện ai nghỉ ngày nào sẽ hữu ích hơn nhiều cho việc xếp dạy thay — đây chính là bài toán nghiệp vụ trung tâm của ứng dụng.

**10. Dashboard thống kê nâng cao**
`AnalyticsTab` mới có 3 chỉ số + 1 biểu đồ cột CSS. Có thể thêm: xu hướng nghỉ theo tháng, tỉ lệ đúng hạn theo tổ, xếp hạng giáo viên nhận việc nhiều nhất — phục vụ báo cáo Sở GD&ĐT như mô tả trong chính UI.

**11. Nhật ký kiểm toán (audit log)**
`TaskActivity` và `LeaveHistoryLog` đã ghi lịch sử ở cấp từng bản ghi. Gom thành một view toàn hệ thống cho admin sẽ rất giá trị trong môi trường hành chính công.

---

## 7. Kế Hoạch Hành Động Đề Xuất

**Tuần này** — *P0 + P1 đã xong, việc còn lại là kiểm chứng thực tế*
1. Commit & push để CI chạy: build xanh trở lại và rules được deploy tự động
2. **Test thủ công luồng migrate tổ chuyên môn**: đăng nhập bằng admin lần đầu → xác nhận 6 tổ mặc định xuất hiện trong Firestore, rồi kiểm tra máy/trình duyệt thứ hai thấy cùng danh sách
3. Kiểm tra toast lỗi hoạt động: tạm ngắt mạng rồi thử giao việc → phải thấy thông báo lỗi và dữ liệu tự hoàn tác

**Tiếp theo** — *P0–P3 đã xong; chuyển hẳn sang §6: nâng cấp tính năng*
4. Upload file minh chứng thật (Firebase Storage) — UI, type và schema đều đã sẵn, chỉ thiếu nối dây
5. Cấu hình workflow duyệt thật — tận dụng `WorkflowRule` đã định nghĩa sẵn, gỡ nhãn "Sắp ra mắt"
6. Xuất PDF đơn nghỉ cho Văn thư lưu sổ
7. Calendar view cho lịch nghỉ (thay lưới thẻ hiện tại)
8. Mở rộng test sang các hook nghiệp vụ (hiện mới phủ phần logic thuần)

---

## Phụ Lục — Điểm Mạnh Đáng Ghi Nhận

Để cân bằng, những điểm dự án làm tốt:

- **Tách hooks theo domain** (`useAuthLogic`/`useTaskLogic`/`useLeaveLogic`…) rất sạch — dễ đọc, dễ test, hiếm gặp ở dự án sinh từ AI scaffold.
- **`.gitignore` chặn service-account key** đúng chuẩn; không có secret nào bị commit.
- **Rules đã vá lỗ hổng leo thang quyền** ở lần commit trước (self-register không còn tự gán `ADMIN`) — đúng như commit message tuyên bố, không phải nói suông.
- **`typescript.ignoreBuildErrors: false`** — giữ type-check chặn build, quyết định đúng.
- **Comment giải thích "tại sao"** chứ không phải "cái gì" ở nhiều chỗ quan trọng trong rules và hooks.
- **Mô hình dữ liệu chín chắn**: ACL `viewerIds`, quy trình duyệt nhiều bước, lịch sử thao tác, phát hiện trùng lịch dạy thay — thể hiện hiểu biết nghiệp vụ trường học thật.
