'use client';

import React, { useMemo, useState } from 'react';
import { History, Search, Download, FileText, CheckSquare } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import { isSchoolLeadership } from '@/Edu-task/lib/permissions';
import { AuditSource, buildAuditLog, filterAuditLog, auditLogToCsv } from '@/Edu-task/lib/auditLog';

const PAGE_SIZE = 50;

/**
 * School-wide activity trail, assembled from the per-record histories the app
 * already writes. Read-only by construction — it is a view, not a new store.
 */
export function AuditLogTab() {
  const { leaves, tasks, currentUser, activeRole, showToast } = useApp();

  const [source, setSource] = useState<AuditSource | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const allowed = isSchoolLeadership(currentUser, activeRole);

  const entries = useMemo(() => buildAuditLog(leaves, tasks), [leaves, tasks]);
  const filtered = useMemo(
    () => filterAuditLog(entries, { source, search, from, to }),
    [entries, source, search, from, to]
  );

  if (!allowed) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm my-6">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-bold text-xl">
          🚫
        </div>
        <h3 className="text-base font-bold text-slate-900">Truy Cập Nhật Ký Bị Từ Chối</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Nhật ký hoạt động toàn trường chỉ dành cho Ban Giám Hiệu, Văn thư, Thanh tra và Quản trị viên.
        </p>
      </div>
    );
  }

  const handleExport = () => {
    if (filtered.length === 0) {
      showToast('error', 'Không có dữ liệu để xuất.');
      return;
    }
    const blob = new Blob([auditLogToCsv(filtered)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nhat-ky-edutask-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('success', `Đã xuất ${filtered.length} dòng nhật ký.`);
  };

  return (
    <div className="space-y-6">

      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              Nhật Ký Hoạt Động Toàn Trường
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Toàn bộ thao tác trên đơn nghỉ phép và công việc, sắp xếp mới nhất trước.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Xuất CSV lưu sổ</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
              placeholder="Tìm người, hành động, mã hồ sơ..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <select
            value={source}
            onChange={e => { setSource(e.target.value as AuditSource | 'ALL'); setVisibleCount(PAGE_SIZE); }}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
          >
            <option value="ALL">-- Tất cả loại hồ sơ --</option>
            <option value="LEAVE">Đơn xin nghỉ</option>
            <option value="TASK">Công việc</option>
          </select>

          <input
            type="date"
            value={from}
            onChange={e => { setFrom(e.target.value); setVisibleCount(PAGE_SIZE); }}
            aria-label="Từ ngày"
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
          />
          <input
            type="date"
            value={to}
            onChange={e => { setTo(e.target.value); setVisibleCount(PAGE_SIZE); }}
            aria-label="Đến ngày"
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            {filtered.length} thao tác
          </span>
          {filtered.length > visibleCount && (
            <span className="text-[11px] text-slate-500">Đang hiển thị {visibleCount} dòng mới nhất</span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-sm text-slate-700">Không có thao tác nào khớp bộ lọc</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 text-xs">
              {filtered.slice(0, visibleCount).map(entry => (
                <li key={entry.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-start gap-3">
                  <span className={`p-1.5 rounded-lg flex-shrink-0 ${
                    entry.source === 'LEAVE' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {entry.source === 'LEAVE'
                      ? <FileText className="w-3.5 h-3.5" />
                      : <CheckSquare className="w-3.5 h-3.5" />}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {entry.recordCode}
                      </span>
                      <span className="font-bold text-slate-900">{entry.action}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {entry.recordTitle} · <strong className="text-slate-700">{entry.actorName}</strong> ({entry.actorRole})
                    </div>
                    {entry.note && (
                      <p className="text-[11px] text-slate-600 mt-1 italic line-clamp-2">&quot;{entry.note}&quot;</p>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{entry.timestamp}</span>
                </li>
              ))}
            </ul>

            {filtered.length > visibleCount && (
              <div className="p-4 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                >
                  Tải thêm {Math.min(PAGE_SIZE, filtered.length - visibleCount)} dòng
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
