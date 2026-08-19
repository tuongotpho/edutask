'use client';

import React, { useState } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, X, Info, FileText } from 'lucide-react';
import { Department, ROLE_LABELS, RoleType, User } from '@/Edu-task/types/user';
import { Invitation } from '@/Edu-task/types/invitation';
import { ALL_ROLES } from '@/Edu-task/lib/permissions';
import { ToastKind } from '@/Edu-task/components/common/Toast';

interface BulkUserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  existingUsers: User[];
  onImportUsers: (invitations: Invitation[]) => Promise<number>;
  showToast: (kind: ToastKind, message: string) => void;
}

interface ParsedUserRow {
  index: number;
  fullName: string;
  email: string;
  departmentId: string;
  departmentName: string;
  role: RoleType;
  rawRole: string;
  rawDept: string;
  isValid: boolean;
  isDuplicate: boolean;
  errorReason?: string;
}

/** Normalized role map from vietnamese labels / keys to RoleType */
const ROLE_MAP: Record<string, RoleType> = {
  'GIÁO VIÊN': 'TEACHER',
  'GIAO VIEN': 'TEACHER',
  'TEACHER': 'TEACHER',
  'TỔ TRƯỞNG': 'HEAD_OF_DEPT',
  'TO TRUONG': 'HEAD_OF_DEPT',
  'HEAD_OF_DEPT': 'HEAD_OF_DEPT',
  'NHÓM TRƯỞNG': 'GROUP_LEADER',
  'NHOM TRUONG': 'GROUP_LEADER',
  'GROUP_LEADER': 'GROUP_LEADER',
  'HIỆU PHÓ': 'VICE_PRINCIPAL',
  'HIEU PHO': 'VICE_PRINCIPAL',
  'VICE_PRINCIPAL': 'VICE_PRINCIPAL',
  'HIỆU TRƯỞNG': 'PRINCIPAL',
  'HIEU TRUONG': 'PRINCIPAL',
  'PRINCIPAL': 'PRINCIPAL',
  'VĂN THƯ': 'SECRETARY',
  'VAN THU': 'SECRETARY',
  'SECRETARY': 'SECRETARY',
  'KẾ TOÁN': 'ACCOUNTANT',
  'KE TOAN': 'ACCOUNTANT',
  'ACCOUNTANT': 'ACCOUNTANT',
  'CÔNG ĐOÀN': 'TRADE_UNION',
  'CONG DOAN': 'TRADE_UNION',
  'TRADE_UNION': 'TRADE_UNION',
  'THANH TRA': 'INSPECTOR',
  'INSPECTOR': 'INSPECTOR',
  'GIÁM THỊ': 'SUPERVISOR',
  'GIAM THI': 'SUPERVISOR',
  'SUPERVISOR': 'SUPERVISOR',
  'QUẢN TRỊ VIÊN': 'ADMIN',
  'QUAN TRI VIEN': 'ADMIN',
  'ADMIN': 'ADMIN',
};

/** Parse a single CSV line with support for quotes and commas inside cells */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

export function BulkUserImportModal({
  isOpen,
  onClose,
  departments,
  existingUsers,
  onImportUsers,
  showToast,
}: BulkUserImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedUserRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'VALID' | 'DUPLICATE' | 'INVALID'>('ALL');

  if (!isOpen) return null;

  // Generate Sample CSV file
  const handleDownloadSample = () => {
    const header = ['Họ và Tên', 'Email', 'Tổ Chuyên Môn', 'Vai Trò'];
    const sampleRows = [
      ['Nguyễn Văn An', 'nguyenvanan@truong.edu.vn', departments[0]?.name || 'Tổ Toán - Tin', 'Giáo viên'],
      ['Trần Thị Bình', 'tranthibinh@truong.edu.vn', departments[1]?.name || 'Tổ Ngữ Văn', 'Tổ trưởng'],
      ['Lê Hoàng Cường', 'lehoangcuong@truong.edu.vn', departments[0]?.name || 'Tổ Toán - Tin', 'Nhóm trưởng'],
    ];

    const escape = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const csvContent = '\uFEFF' + [header.map(escape).join(','), ...sampleRows.map(r => r.map(escape).join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mau_danh_sach_giao_vien_edutask.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', 'Đã tải xuống file CSV mẫu.');
  };

  // Normalize string for fuzzy matching (strips diacritics, hyphens, spaces, special chars)
  const normalizeStr = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  // Helper to resolve department ID & name intelligently
  const resolveDepartment = (rawDept: string) => {
    // Default teaching department if not specified (avoiding DEPT_BGH!)
    const defaultTeachingDept =
      departments.find(d => d.id !== 'DEPT_BGH') ||
      departments[0] ||
      { id: 'DEPT_TOAN_TIN', name: 'Tổ Toán - Tin' };

    if (!rawDept) return { id: defaultTeachingDept.id, name: defaultTeachingDept.name };

    const rawClean = rawDept.trim().toLowerCase();
    const rawNormalized = normalizeStr(rawDept);

    // 1. Direct match by ID, Code, or Exact Name
    const directMatch = departments.find(d =>
      d.id.toLowerCase() === rawClean ||
      d.code.toLowerCase() === rawClean ||
      d.name.toLowerCase() === rawClean
    );
    if (directMatch) return { id: directMatch.id, name: directMatch.name };

    // 2. Normalized substring match (e.g. "hoasinh" in "tolyhoasinh")
    const normMatch = departments.find(d => {
      const dNorm = normalizeStr(d.name);
      const cNorm = normalizeStr(d.code);
      return dNorm.includes(rawNormalized) || rawNormalized.includes(dNorm) || cNorm.includes(rawNormalized);
    });
    if (normMatch) return { id: normMatch.id, name: normMatch.name };

    // 3. Keyword / Token fuzzy match
    for (const d of departments) {
      const dNorm = normalizeStr(d.name);
      if (
        (rawNormalized.includes('hoa') || rawNormalized.includes('sinh') || rawNormalized.includes('ly')) &&
        (dNorm.includes('hoa') || dNorm.includes('sinh') || dNorm.includes('ly'))
      ) {
        return { id: d.id, name: d.name };
      }
      if (
        (rawNormalized.includes('toan') || rawNormalized.includes('tin')) &&
        (dNorm.includes('toan') || dNorm.includes('tin'))
      ) {
        return { id: d.id, name: d.name };
      }
      if (
        (rawNormalized.includes('van') || rawNormalized.includes('su') || rawNormalized.includes('dia')) &&
        (dNorm.includes('van') || dNorm.includes('su') || dNorm.includes('dia'))
      ) {
        return { id: d.id, name: d.name };
      }
      if (
        (rawNormalized.includes('anh') || rawNormalized.includes('ngoai') || rawNormalized.includes('phap')) &&
        (dNorm.includes('anh') || dNorm.includes('ngoai') || dNorm.includes('phap'))
      ) {
        return { id: d.id, name: d.name };
      }
      if (
        (rawNormalized.includes('hanhchinh') || rawNormalized.includes('ketoan') || rawNormalized.includes('vanthu')) &&
        (dNorm.includes('hanhchinh') || dNorm.includes('ketoan'))
      ) {
        return { id: d.id, name: d.name };
      }
      if (
        (rawNormalized.includes('bgh') || rawNormalized.includes('giamhieu') || rawNormalized.includes('banlanhdao')) &&
        (dNorm.includes('bgh') || dNorm.includes('giamhieu'))
      ) {
        return { id: d.id, name: d.name };
      }
    }

    // 4. Fallback: return default teaching department (never BGH by default!)
    return { id: defaultTeachingDept.id, name: defaultTeachingDept.name };
  };

  // Helper to resolve role
  const resolveRole = (rawRole: string): RoleType => {
    if (!rawRole) return 'TEACHER';
    const cleaned = rawRole.trim().toUpperCase();
    return ROLE_MAP[cleaned] || 'TEACHER';
  };

  // Parse CSV File Content
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Parse lines
      const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length <= 1) {
        showToast('error', 'File không chứa dữ liệu tài khoản (chỉ có dòng tiêu đề hoặc rỗng).');
        setParsedRows([]);
        return;
      }

      const existingEmailSet = new Set(existingUsers.map(u => u.email.toLowerCase().trim()));
      const seenEmailInBatch = new Set<string>();

      const rows: ParsedUserRow[] = [];

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cleanCols = parseCsvLine(line);

        const fullName = cleanCols[0] || '';
        const email = (cleanCols[1] || '').toLowerCase();
        const rawDept = cleanCols[2] || '';
        const rawRole = cleanCols[3] || '';

        const dept = resolveDepartment(rawDept);
        const role = resolveRole(rawRole);

        let isValid = true;
        let isDuplicate = false;
        let errorReason = '';

        if (!fullName) {
          isValid = false;
          errorReason = 'Thiếu Họ và Tên';
        } else if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          isValid = false;
          errorReason = 'Email không hợp lệ';
        } else if (existingEmailSet.has(email) || seenEmailInBatch.has(email)) {
          isDuplicate = true;
          errorReason = 'Email đã tồn tại trong hệ thống';
        }

        seenEmailInBatch.add(email);

        rows.push({
          index: i,
          fullName,
          email,
          departmentId: dept.id,
          departmentName: dept.name,
          role,
          rawRole,
          rawDept,
          isValid,
          isDuplicate,
          errorReason,
        });
      }

      setParsedRows(rows);
    };

    reader.readAsText(uploadedFile, 'UTF-8');
  };

  // Inline edit handlers for preview table
  const handleUpdateRowDepartment = (rowIndex: number, newDeptId: string) => {
    const targetDept = departments.find(d => d.id === newDeptId);
    if (!targetDept) return;

    setParsedRows(prev => prev.map(r => {
      if (r.index !== rowIndex) return r;
      return {
        ...r,
        departmentId: targetDept.id,
        departmentName: targetDept.name,
      };
    }));
  };

  const handleUpdateRowRole = (rowIndex: number, newRole: RoleType) => {
    setParsedRows(prev => prev.map(r => {
      if (r.index !== rowIndex) return r;
      return {
        ...r,
        role: newRole,
      };
    }));
  };

  const handleUpdateRowField = (rowIndex: number, field: 'fullName' | 'email', val: string) => {
    const existingEmailSet = new Set(existingUsers.map(u => u.email.toLowerCase().trim()));

    setParsedRows(prev => prev.map(r => {
      if (r.index !== rowIndex) return r;
      const updated = { ...r, [field]: val };

      const cleanEmail = (updated.email || '').toLowerCase().trim();
      let isValid = true;
      let isDuplicate = false;
      let errorReason = '';

      if (!updated.fullName.trim()) {
        isValid = false;
        errorReason = 'Thiếu Họ và Tên';
      } else if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        isValid = false;
        errorReason = 'Email không hợp lệ';
      } else if (existingEmailSet.has(cleanEmail)) {
        isDuplicate = true;
        errorReason = 'Email đã tồn tại trong hệ thống';
      }

      return {
        ...updated,
        email: cleanEmail,
        isValid,
        isDuplicate,
        errorReason,
      };
    }));
  };

  // Perform bulk import
  const handleConfirmImport = async () => {
    const validRowsToImport = parsedRows.filter(r => r.isValid && !r.isDuplicate);
    if (validRowsToImport.length === 0) {
      showToast('error', 'Không có tài khoản hợp lệ nào để nhập.');
      return;
    }

    setIsProcessing(true);

    const now = Date.now();
    // Ghi THƯ MỜI, không phải hồ sơ người dùng.
    //
    // Trước đây chỗ này dựng thẳng hồ sơ với mã tự chế `USR_BULK_<thời gian>_<số
    // thứ tự>`, vì lúc nhập danh sách thì giáo viên chưa từng đăng nhập nên chưa
    // có mã đăng nhập nào để dùng. Nhưng luật bảo mật lại tra hồ sơ THEO mã đăng
    // nhập, nên hồ sơ ấy vĩnh viễn không khớp với ai: giáo viên đăng nhập xong bị
    // coi là người lạ, hệ thống tạo thêm hồ sơ thứ hai ở trạng thái chờ duyệt, và
    // vai trò ghi trong file bị bỏ qua hoàn toàn.
    //
    // Thư mời không giả vờ biết mã đăng nhập. Nó gắn với email, và hồ sơ thật chỉ
    // được lập vào đúng lúc người ta đăng nhập — khi mã đăng nhập đã tồn tại.
    const invitations: Invitation[] = validRowsToImport.map(row => ({
      email: row.email.trim().toLowerCase(),
      fullName: row.fullName,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      roles: [row.role],
      activeRole: row.role,
      isTeachingStaff: true,
      createdAt: new Date(now).toISOString().replace('T', ' ').slice(0, 16),
    }));

    const importedCount = await onImportUsers(invitations);
    setIsProcessing(false);

    if (importedCount > 0) {
      showToast('success', `Đã mời ${importedCount} tài khoản. Vai trò sẽ được cấp ngay khi họ đăng nhập lần đầu.`);
      onClose();
    } else {
      showToast('error', 'Đã xảy ra lỗi khi tạo tài khoản hàng loạt.');
    }
  };

  const validCount = parsedRows.filter(r => r.isValid && !r.isDuplicate).length;
  const duplicateCount = parsedRows.filter(r => r.isDuplicate).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  const filteredDisplayRows = parsedRows.filter(r => {
    if (activeTabFilter === 'VALID') return r.isValid && !r.isDuplicate;
    if (activeTabFilter === 'DUPLICATE') return r.isDuplicate;
    if (activeTabFilter === 'INVALID') return !r.isValid;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-[5px] max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Nhập Hàng Loạt Tài Khoản Giáo Viên (CSV/Excel)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tải file danh sách giáo viên để khởi tạo hàng loạt tài khoản lên hệ thống cùng lúc.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Step 1 & Step 2 Control bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Step 1: Download Sample */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">1. Tải mẫu danh sách chuẩn</span>
                <FileText className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-[11px] text-slate-500">
                File mẫu bao gồm các cột: <strong>Họ tên, Email, Tổ chuyên môn, Vai trò</strong>.
              </p>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>Tải File Mẫu (CSV)</span>
              </button>
            </div>

            {/* Step 2: Upload File */}
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900">2. Upload file CSV đã điền</span>
                <Upload className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-[11px] text-indigo-700/80">
                Chọn file `.csv` định dạng UTF-8 được xuất từ Excel hoặc Google Sheets.
              </p>
              <label className="w-full px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{file ? file.name : 'Chọn File Từ Máy Tính'}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Parsed Results Section */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              {/* Summary Badges & Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-2.5 rounded-xl text-xs">
                <div className="flex items-center space-x-1 font-bold">
                  <span className="text-slate-700">Tổng cộng: <strong>{parsedRows.length}</strong> |</span>
                  <button
                    onClick={() => setActiveTabFilter('ALL')}
                    className={`px-2 py-1 rounded-lg transition-all ${activeTabFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Tất cả ({parsedRows.length})
                  </button>
                  <button
                    onClick={() => setActiveTabFilter('VALID')}
                    className={`px-2 py-1 rounded-lg transition-all ${activeTabFilter === 'VALID' ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'text-emerald-700 hover:bg-emerald-50'}`}
                  >
                    ✓ Hợp lệ ({validCount})
                  </button>
                  <button
                    onClick={() => setActiveTabFilter('DUPLICATE')}
                    className={`px-2 py-1 rounded-lg transition-all ${activeTabFilter === 'DUPLICATE' ? 'bg-amber-600 text-white shadow-2xs font-bold' : 'text-amber-700 hover:bg-amber-50'}`}
                  >
                    ⚠ Trùng email ({duplicateCount})
                  </button>
                  <button
                    onClick={() => setActiveTabFilter('INVALID')}
                    className={`px-2 py-1 rounded-lg transition-all ${activeTabFilter === 'INVALID' ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'text-rose-700 hover:bg-rose-50'}`}
                  >
                    ✕ Lỗi ({invalidCount})
                  </button>
                </div>

                <div className="text-[11px] text-slate-500">
                  Sẽ khởi tạo <strong className="text-indigo-600 font-extrabold">{validCount}</strong> tài khoản mới.
                </div>
              </div>

              {/* Table Preview with Interactive Inline Inputs */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 bg-white shadow-2xs z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center">STT</th>
                      <th className="p-2.5 w-44">Họ và Tên</th>
                      <th className="p-2.5 w-52">Email</th>
                      <th className="p-2.5 min-w-[180px]">Tổ Chuyên Môn Quy Đổi ✏️</th>
                      <th className="p-2.5 w-44">Vai Trò Quy Đổi ✏️</th>
                      <th className="p-2.5 text-center w-28">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDisplayRows.map((row) => (
                      <tr
                        key={row.index}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          !row.isValid
                            ? 'bg-rose-50/40 text-rose-900'
                            : row.isDuplicate
                            ? 'bg-amber-50/40 text-amber-900'
                            : 'bg-white'
                        }`}
                      >
                        <td className="p-2 text-center font-mono text-slate-400 text-xs">{row.index}</td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.fullName}
                            onChange={(e) => handleUpdateRowField(row.index, 'fullName', e.target.value)}
                            placeholder="Họ và tên"
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 font-bold text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="email"
                            value={row.email}
                            onChange={(e) => handleUpdateRowField(row.index, 'email', e.target.value)}
                            placeholder="email@domain.com"
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 font-mono text-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={row.departmentId}
                            onChange={(e) => handleUpdateRowDepartment(row.index, e.target.value)}
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 font-semibold text-slate-800 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          {row.rawDept && row.rawDept !== row.departmentName && (
                            <span className="block text-[10px] text-slate-400 font-normal px-1 mt-0.5">Từ file: &quot;{row.rawDept}&quot;</span>
                          )}
                        </td>
                        <td className="p-2">
                          <select
                            value={row.role}
                            onChange={(e) => handleUpdateRowRole(row.index, e.target.value as RoleType)}
                            className="w-full px-2 py-1 rounded-lg border border-indigo-200 font-bold text-indigo-800 text-xs bg-indigo-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            {ALL_ROLES.map(r => (
                              <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          {!row.isValid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                              ✕ {row.errorReason}
                            </span>
                          ) : row.isDuplicate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                              ⚠ {row.errorReason}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              ✓ Hợp lệ
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Tài khoản khởi tạo sẽ tự động được kích hoạt và liên kết khi giáo viên đăng nhập Gmail.</span>
          </div>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={validCount === 0 || isProcessing}
              onClick={handleConfirmImport}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isProcessing ? 'Đang Xử Lý...' : `Xác Nhận Tạo ${validCount} Tài Khoản`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
