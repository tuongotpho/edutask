'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  FileText,
  CheckSquare,
  Repeat,
  ClipboardList,
  CalendarCheck,
  Target,
  GraduationCap,
  Award,
  ShieldCheck,
  UserCheck,
  Users,
  Search,
  HelpCircle,
  Bell,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Info,
  Key,
  Database,
  Calendar,
  AlertTriangle
} from 'lucide-react';

type SectionTab = 'overview' | 'manual' | 'roles' | 'faq';

export function GuideTab() {
  const [activeSubTab, setActiveSubTab] = useState<SectionTab>('overview');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="space-y-6">

      {/* Hero Banner Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[5px] p-6 sm:p-8 text-white shadow-md border border-slate-800">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-48 h-48 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>EduTask System Documentation</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-indigo-400" />
            Giới Thiệu &amp; Hướng Dẫn Sử Dụng Hệ Thống EduTask
          </h1>

          <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
            EduTask là nền tảng Chuyển đổi số Quản trị &amp; Vận hành Nhà trường thông minh, hỗ trợ toàn bộ luồng công việc từ Quản lý Đơn nghỉ phép (2 cấp duyệt), Phân công Giao việc, Đăng ký Dạy bù/Phòng học, Sổ nề nếp chuyên môn, Điểm danh &amp; Hồ sơ học sinh đến Bồi dưỡng Học sinh giỏi.
          </p>

          {/* Sub Navigation Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-800 text-xs">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Info className="w-4 h-4 text-indigo-400" />
              <span>1. Tổng Quan Hệ Thống</span>
            </button>

            <button
              onClick={() => setActiveSubTab('manual')}
              className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'manual'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>2. Hướng Dẫn Từng Bước</span>
            </button>

            <button
              onClick={() => setActiveSubTab('roles')}
              className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'roles'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span>3. Hướng Dẫn Theo Vai Trò</span>
            </button>

            <button
              onClick={() => setActiveSubTab('faq')}
              className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'faq'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-indigo-400" />
              <span>4. Câu Hỏi Thường Gặp (FAQ)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: SYSTEM OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Các Phân Hệ Tính Năng Nổi Bật Của EduTask
            </h2>
            <p className="text-xs text-slate-500">
              Hệ thống được thiết kế dạng mô-đun hóa đáp ứng chuẩn quy trình quản trị trường phổ thông tại Việt Nam:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {/* Feature 1 */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2 hover:border-indigo-300 transition-all">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Quản Lý Đơn Nghỉ Phép &amp; Dạy Thay</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Quy trình duyệt 2 cấp (Tổ trưởng chuyên môn → Ban Giám Hiệu). Tự động tìm và cảnh báo giáo viên dạy thay trùng lịch.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2 hover:border-emerald-300 transition-all">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Giao Việc &amp; Theo Dõi Tiến Độ</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  BGH &amp; Tổ trưởng phát hành chỉ đạo, giao việc cá nhân/tổ nhóm. Đính kèm tệp đính kèm, gia hạn deadline và báo cáo trực tiếp.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-2 hover:border-amber-300 transition-all">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
                  <Repeat className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Dạy Bù, Đăng Ký Phòng &amp; Thiết Bị</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Đăng ký dạy bù do mất tiết, mượn phòng đa năng/thí nghiệm và thiết bị dạy học. Tự động kiểm tra xung đột thời khóa biểu.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-4 rounded-2xl bg-violet-50/50 border border-violet-100 space-y-2 hover:border-violet-300 transition-all">
                <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Sổ Nề Nếp Chuyên Môn Giáo Viên</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ghi nhận giáo viên chậm giờ, trống tiết. Cho phép giáo viên gửi giải trình và lãnh đạo xem xét duyệt giải trình công khai.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-100 space-y-2 hover:border-sky-300 transition-all">
                <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Quản Lý Học Sinh &amp; Điểm Danh</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Quản lý hồ sơ học sinh, liên hệ phụ huynh, điểm danh 1-click hàng ngày, ghi nhận nề nếp vi phạm &amp; tuyên dương khen thưởng.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-2 hover:border-rose-300 transition-all">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Bồi Dưỡng Học Sinh Giỏi (HSG)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Theo dõi danh sách đội tuyển HSG theo môn, quản lý các tiết dạy bồi dưỡng, chuyên đề và lịch thi của nhà trường.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: STEP-BY-STEP MANUAL */}
      {activeSubTab === 'manual' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Hướng Dẫn Thao Tác Chi Tiết Cho Người Dùng
            </h2>

            {/* Step 1 */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center flex-shrink-0">
                1
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-bold text-slate-900 text-sm">Chuyển Đổi Vai Trò Thao Tác (RBAC) trên Thanh Header</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nếu tài khoản của bạn đảm nhiệm nhiều vai trò (ví dụ: vừa là Giáo viên vừa là Tổ trưởng hoặc BGH), bấm vào nút **Vai trò** cạnh góc phải trên cùng để đổi vai trò thao tác. Hệ thống sẽ tự động cập nhật menu và các nút phê duyệt tương ứng.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center flex-shrink-0">
                2
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-bold text-slate-900 text-sm">Nộp Đơn Xin Nghỉ Phép &amp; Chỉ Định Người Dạy Thay</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Bấm nút **"Tạo Đơn Xin Nghỉ"** ở menu bên trái hoặc tab Đơn Xin Nghỉ → Chọn Loại nghỉ (Bệnh, Việc riêng, Công tác...) → Điền ngày bắt đầu, kết thúc, buổi nghỉ → Chọn Giáo viên dạy thay (nếu có). Đơn sẽ tự động gửi tới Tổ trưởng chuyên môn duyệt cấp 1, sau đó tới Ban Giám Hiệu duyệt cấp 2.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center flex-shrink-0">
                3
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-bold text-slate-900 text-sm">Tiếp Nhận &amp; Báo Cáo Tiến Độ Công Việc</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Vào tab **"Quản Lý Giao Việc"** → Nhấp vào công việc được giao để xem nội dung, tài liệu đính kèm → Cập nhật phần trăm hoàn thành hoặc gửi phản hồi/xin gia hạn trực tiếp tới người giao việc.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center flex-shrink-0">
                4
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-bold text-slate-900 text-sm">Điểm Danh &amp; Ghi Nề Nếp Học Sinh Hàng Ngày</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Vào tab **"Học Sinh"** → Chọn Lớp chủ nhiệm/bộ môn → Bấm **"Điểm Danh Lớp"** để chọn trạng thái Vắng/Đi trễ → Ghi nhận vi phạm nề nếp hoặc tuyên dương học sinh có thành tích xuất sắc.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200">
              <div className="w-8 h-8 rounded-full bg-amber-600 text-white font-extrabold text-sm flex items-center justify-center flex-shrink-0">
                5
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-bold text-amber-950 text-sm">Tạo Tài Khoản Hàng Loạt (Dành Cho Quản Trị Viên - Admin)</h3>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Vào tab **"Quản Trị &amp; Duyệt TK"** → Bấm **"Tạo Tài Khoản Hàng Loạt"** → Tải file mẫu CSV/Excel hoặc dán danh sách → Hệ thống tự động nhận diện Email, Họ tên, Tổ chuyên môn và Vai trò. Admin có thể chỉnh sửa trực tiếp từng dòng trên giao diện trước khi bấm **"Tạo Hàng Loạt"**.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ROLE CHEATSHEETS */}
      {activeSubTab === 'roles' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Role 1: Giáo viên */}
            <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <Users className="w-5 h-5 text-indigo-600" />
                <span>Giáo Viên Bộ Môn &amp; Chủ Nhiệm</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside leading-relaxed">
                <li>Tạo đơn xin nghỉ phép &amp; chọn giáo viên dạy thay.</li>
                <li>Theo dõi danh sách công việc cá nhân được BGH / Tổ trưởng giao.</li>
                <li>Đăng ký dạy bù, mượn phòng thí nghiệm &amp; thiết bị.</li>
                <li>Ghi nhận điểm danh &amp; sổ nề nếp học sinh lớp phụ trách.</li>
                <li>Gửi giải trình nề nếp chuyên môn khi có ghi nhận chậm giờ.</li>
              </ul>
            </div>

            {/* Role 2: Tổ trưởng */}
            <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <span>Tổ Trưởng / Nhóm Trưởng Chuyên Môn</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside leading-relaxed">
                <li>Phê duyệt đơn xin nghỉ phép cấp 1 (Tổ chuyên môn).</li>
                <li>Phân công Giáo viên dạy thay chính thức cho đơn xin nghỉ.</li>
                <li>Giao việc &amp; theo dõi tiến độ kế hoạch của giáo viên trong tổ.</li>
                <li>Quản lý danh sách &amp; tiến độ dạy bồi dưỡng HSG thuộc tổ.</li>
                <li>Duyệt đăng ký dạy bù của giáo viên thuộc tổ.</li>
              </ul>
            </div>

            {/* Role 3: BGH */}
            <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-violet-700 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-violet-600" />
                <span>Ban Giám Hiệu (Hiệu Trưởng / Phó HT)</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside leading-relaxed">
                <li>Phê duyệt đơn xin nghỉ phép cấp 2 (Ban Giám Hiệu).</li>
                <li>Phát hành chỉ đạo &amp; giao việc toàn trường.</li>
                <li>Xem báo cáo thống kê chuyên môn, nề nếp &amp; tình hình giảng dạy.</li>
                <li>Xem nhật ký hoạt động &amp; quản lý kế hoạch chung nhà trường.</li>
                <li>Duyệt các trường hợp xin dạy bù / mượn phòng thí nghiệm toàn trường.</li>
              </ul>
            </div>

            {/* Role 4: Admin */}
            <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <Key className="w-5 h-5 text-rose-600" />
                <span>Quản Trị Viên Hệ Thống (Admin)</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside leading-relaxed">
                <li>Phê duyệt tài khoản mới đăng ký qua Google Email.</li>
                <li>Tạo tài khoản hàng loạt (Import Excel/CSV) &amp; sửa vai trò/tổ trực tiếp.</li>
                <li>Cấu hình phân quyền hệ thống (RBAC) &amp; danh mục Lớp/Phòng/Tiết.</li>
                <li>Xóa hoặc khôi phục dữ liệu đơn nghỉ phép / công việc bị nhầm lẫn.</li>
              </ul>
            </div>

          </div>
        </div>
      )}

      {/* SUB-TAB 4: FAQ */}
      {activeSubTab === 'faq' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              Câu Hỏi Thường Gặp (FAQ) &amp; Giải Đáp Thắc Mắc
            </h2>

            <div className="space-y-3 pt-2">
              {/* FAQ Item 1 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleFaq(0)}
                  className="w-full p-4 text-left font-bold text-xs sm:text-sm text-slate-900 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
                >
                  <span>1. Tôi làm thế nào để tạo nhiều tài khoản giáo viên cùng một lúc?</span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openFaqIndex === 0 ? 'rotate-180' : ''}`} />
                </button>
                {openFaqIndex === 0 && (
                  <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-200">
                    Tài khoản <strong>Admin</strong> có thể vào tab <strong>"Quản Trị &amp; Duyệt TK"</strong> → Bấm <strong>"Tạo Tài Khoản Hàng Loạt"</strong> → Tải file Excel/CSV danh sách giáo viên hoặc dán văn bản. Admin có thể chỉnh sửa trực tiếp Tổ chuyên môn &amp; Vai trò của từng người ngay trên bảng nhập trước khi bấm tạo.
                  </div>
                )}
              </div>

              {/* FAQ Item 2 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleFaq(1)}
                  className="w-full p-4 text-left font-bold text-xs sm:text-sm text-slate-900 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
                >
                  <span>2. Đơn xin nghỉ phép bị hủy hoặc tạo nhầm có xóa được không?</span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openFaqIndex === 1 ? 'rotate-180' : ''}`} />
                </button>
                {openFaqIndex === 1 && (
                  <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-200">
                    Người tạo đơn có thể xóa đơn của mình khi đơn ở trạng thái <strong>Đã Hủy (CANCELLED)</strong>. Riêng tài khoản <strong>Admin / Ban Giám Hiệu</strong> có nút bấm <strong>"Xóa Đơn Khỏi Hệ Thống (Admin)"</strong> để xóa vĩnh viễn đơn nghỉ phép bị nhầm lẫn trực tiếp trên giao diện.
                  </div>
                )}
              </div>

              {/* FAQ Item 3 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleFaq(2)}
                  className="w-full p-4 text-left font-bold text-xs sm:text-sm text-slate-900 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
                >
                  <span>3. Nếu hai giáo viên đăng ký cùng một phòng thí nghiệm hoặc tiết dạy bù thì sao?</span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openFaqIndex === 2 ? 'rotate-180' : ''}`} />
                </button>
                {openFaqIndex === 2 && (
                  <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-200">
                    EduTask tích hợp thuật toán kiểm tra xung đột thời khóa biểu thời gian thực. Hệ thống sẽ tự động phát hiện nếu phòng/tiết học đã được đăng ký và đưa ra cảnh báo trùng lịch ngay lập tức để né việc đăng ký đè.
                  </div>
                )}
              </div>

              {/* FAQ Item 4 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleFaq(3)}
                  className="w-full p-4 text-left font-bold text-xs sm:text-sm text-slate-900 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
                >
                  <span>4. Làm sao để nhận thông báo đẩy (Push Notifications) qua điện thoại hoặc Telegram?</span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openFaqIndex === 3 ? 'rotate-180' : ''}`} />
                </button>
                {openFaqIndex === 3 && (
                  <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-200">
                    Bật nút công tắc <strong>"Bật thông báo đẩy"</strong> ở góc trên thanh Header. Khi có đơn xin nghỉ phép mới hoặc công việc được giao, hệ thống sẽ tự động phát thông báo tới thiết bị của bạn và tự động gửi tin nhắn báo vào kênh Telegram của nhà trường.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
