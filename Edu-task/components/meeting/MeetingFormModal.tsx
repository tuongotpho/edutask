'use client';

import React, { useMemo, useState } from 'react';
import { CalendarPlus, Check, Users, X } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import { MEETING_KINDS, MEETING_KIND_LABELS, Meeting, MeetingKind } from '@/Edu-task/types/meeting';
import { toDateString } from '@/Edu-task/lib/schedule';

/**
 * Convening a meeting.
 *
 * The invitee count is shown live as the scope changes, because "họp hội đồng"
 * and "họp tổ Toán" differ by an order of magnitude and the secretary should
 * see which one they just picked before sending eighty notifications.
 */

const inputClass =
  'w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20';

interface MeetingFormModalProps {
  editing?: Meeting | null;
  onClose: () => void;
}

export function MeetingFormModal({ editing, onClose }: MeetingFormModalProps) {
  const { users, departments, createMeeting, updateMeeting, showToast } = useApp();

  const [title, setTitle] = useState(editing?.title ?? '');
  const [agenda, setAgenda] = useState(editing?.agenda ?? '');
  const [kind, setKind] = useState<MeetingKind>(editing?.kind ?? 'STAFF');
  const [date, setDate] = useState(editing?.date ?? toDateString(new Date()));
  const [startTime, setStartTime] = useState(editing?.startTime ?? '14:00');
  const [endTime, setEndTime] = useState(editing?.endTime ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [scope, setScope] = useState<'ALL_STAFF' | 'DEPARTMENTS' | 'CUSTOM'>(editing?.scope ?? 'ALL_STAFF');
  const [departmentIds, setDepartmentIds] = useState<string[]>(editing?.departmentIds ?? []);
  const [userIds, setUserIds] = useState<string[]>(
    editing?.scope === 'CUSTOM' ? editing.participantIds : []
  );
  const [chairedById, setChairedById] = useState(editing?.chairedById ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const activeUsers = useMemo(
    () => users.filter(u => u.status === 'ACTIVE').sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')),
    [users]
  );

  // Mirrors resolveParticipants() in the hook, so the count shown here is the
  // count that will actually be invited.
  const inviteeCount = useMemo(() => {
    if (scope === 'ALL_STAFF') return activeUsers.length;
    if (scope === 'DEPARTMENTS') return activeUsers.filter(u => departmentIds.includes(u.departmentId)).length;
    return userIds.length;
  }, [scope, departmentIds, userIds, activeUsers]);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('error', 'Vui lòng nhập tên cuộc họp.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title, agenda, kind, date, startTime, endTime, location,
        scope, departmentIds, userIds,
        chairedById: chairedById || undefined,
      };
      const ok = editing
        ? await updateMeeting(editing.id, payload)
        : !!(await createMeeting(payload));

      if (ok) {
        showToast(
          'success',
          editing ? 'Đã cập nhật cuộc họp.' : `Đã tạo cuộc họp và gửi giấy mời tới ${inviteeCount} người.`
        );
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const rollLocked = !!editing && editing.status !== 'SCHEDULED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-violet-600" />
              {editing ? 'Sửa Cuộc Họp' : 'Tạo Cuộc Họp'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Thành phần được chốt lại khi tạo, để danh sách điểm danh không thay đổi về sau.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tên cuộc họp *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Họp hội đồng sư phạm tháng 8"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Loại</label>
              <select value={kind} onChange={e => setKind(e.target.value as MeetingKind)} className={inputClass}>
                {MEETING_KINDS.map(k => (
                  <option key={k} value={k}>{MEETING_KIND_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Giờ bắt đầu</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputClass} />
              <p className="text-[10px] text-slate-400 mt-1">Sau giờ này tính là đi muộn.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Giờ kết thúc</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Địa điểm</label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Hội trường tầng 3"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung / chương trình</label>
              <textarea
                value={agenda}
                onChange={e => setAgenda(e.target.value)}
                rows={2}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Chủ trì</label>
              <select value={chairedById} onChange={e => setChairedById(e.target.value)} className={inputClass}>
                <option value="">— Chưa xác định —</option>
                {activeUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-violet-50/50 border border-violet-100 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-violet-600" />
                Thành phần dự họp
              </label>
              <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[10px] font-bold">
                {inviteeCount} người
              </span>
            </div>

            {rollLocked && (
              <p className="text-[11px] text-amber-800 p-2 rounded-xl bg-amber-50 border border-amber-200">
                Cuộc họp đã diễn ra nên danh sách thành phần được giữ nguyên — sửa lại sẽ làm mất
                kết quả điểm danh đã ghi.
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {([
                ['ALL_STAFF', 'Toàn trường'],
                ['DEPARTMENTS', 'Theo tổ'],
                ['CUSTOM', 'Chọn từng người'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={rollLocked}
                  onClick={() => setScope(value)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all disabled:opacity-50 ${
                    scope === value
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {scope === 'DEPARTMENTS' && (
              <div className="flex flex-wrap gap-1.5">
                {departments.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    disabled={rollLocked}
                    onClick={() => toggle(departmentIds, setDepartmentIds, d.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-50 ${
                      departmentIds.includes(d.id)
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}

            {scope === 'CUSTOM' && (
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {activeUsers.map(u => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      disabled={rollLocked}
                      checked={userIds.includes(u.id)}
                      onChange={() => toggle(userIds, setUserIds, u.id)}
                      className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-[11px] text-slate-700 truncate">
                      {u.fullName} <span className="text-slate-400">· {u.departmentName}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-2 p-5 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSaving || !title.trim() || inviteeCount === 0}
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Đang lưu…' : editing ? 'Lưu Thay Đổi' : 'Tạo & Gửi Giấy Mời'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
