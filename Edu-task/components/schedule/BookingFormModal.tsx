'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, DoorOpen, Info, X } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import { BOOKING_PURPOSES, BOOKING_PURPOSE_LABELS, BookingPurpose } from '@/Edu-task/types/booking';
import { PeriodSlot, ROOM_KIND_LABELS } from '@/Edu-task/types/schedule';
import { sortClasses, sortRooms, toDateString } from '@/Edu-task/lib/schedule';
import { SlotPicker } from './SlotPicker';

/**
 * Đăng ký phòng đa năng / phòng thí nghiệm.
 *
 * The picker greys out periods the chosen room is already taken for, so the
 * common case — "when is this room free on Thursday?" — is answered by looking
 * rather than by trial and error.
 */

const inputClass =
  'w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

export function BookingFormModal({ onClose }: { onClose: () => void }) {
  const {
    rooms, classes, createBooking, getBookingSlotProblems, getRoomBusySlots, showToast,
  } = useApp();

  const today = toDateString(new Date());
  const activeRooms = useMemo(() => sortRooms(rooms).filter(r => r.isActive), [rooms]);
  const activeClasses = useMemo(() => sortClasses(classes).filter(c => c.isActive), [classes]);

  const [roomId, setRoomId] = useState(activeRooms[0]?.id ?? '');
  const [slot, setSlot] = useState<PeriodSlot>({ date: today, session: 'MORNING', period: 1 });
  const [purpose, setPurpose] = useState<BookingPurpose>('PRACTICAL');
  const [purposeNote, setPurposeNote] = useState('');
  const [classId, setClassId] = useState('');
  const [expectedAttendees, setExpectedAttendees] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const room = activeRooms.find(r => r.id === roomId);

  const busySlots = useMemo(
    () => (roomId ? getRoomBusySlots(roomId, slot.date) : []),
    [roomId, slot.date, getRoomBusySlots]
  );

  const problems = useMemo(
    () => (roomId ? getBookingSlotProblems(slot, { roomId, classId: classId || undefined }) : []),
    [roomId, slot, classId, getBookingSlotProblems]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) {
      showToast('error', 'Vui lòng chọn phòng.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await createBooking({
        roomId,
        slot,
        purpose,
        purposeNote: purposeNote.trim() || undefined,
        classId: classId || undefined,
        expectedAttendees,
      });

      if (created) {
        showToast(
          'success',
          created.status === 'CONFIRMED'
            ? `Đã đặt ${created.roomName}. Phòng này không cần duyệt nên lịch có hiệu lực ngay.`
            : `Đã gửi đăng ký ${created.roomName}, chờ duyệt.`
        );
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const blocked = problems.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-emerald-600" />
              Đăng Ký Phòng
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Phòng đa năng, phòng thí nghiệm, phòng máy, hội trường.
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

          {activeRooms.length === 0 && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              Danh mục phòng đang trống. Quản trị viên cần thêm phòng trong tab <strong>Quản Trị</strong> trước.
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phòng *</label>
            <select value={roomId} onChange={e => setRoomId(e.target.value)} className={inputClass}>
              <option value="">— Chọn phòng —</option>
              {activeRooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} · {ROOM_KIND_LABELS[r.kind]}
                  {r.capacity ? ` · ${r.capacity} chỗ` : ''}
                </option>
              ))}
            </select>

            {room && (
              <p className={`text-[11px] mt-1.5 flex items-start gap-1.5 ${
                room.requiresApproval ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  {room.requiresApproval
                    ? 'Phòng này cần được duyệt — đăng ký sẽ ở trạng thái chờ cho tới khi bộ phận điều phối xác nhận.'
                    : 'Phòng này không cần duyệt — đăng ký xong là có hiệu lực ngay.'}
                  {room.location ? ` Vị trí: ${room.location}.` : ''}
                </span>
              </p>
            )}
          </div>

          <SlotPicker
            label="Thời gian sử dụng"
            value={slot}
            onChange={setSlot}
            busySlots={busySlots}
            minDate={today}
            hint={roomId ? undefined : 'Chọn phòng trước để thấy tiết nào đã kín.'}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mục đích</label>
              <select
                value={purpose}
                onChange={e => setPurpose(e.target.value as BookingPurpose)}
                className={inputClass}
              >
                {BOOKING_PURPOSES.map(p => (
                  <option key={p} value={p}>{BOOKING_PURPOSE_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lớp sử dụng</label>
              <select value={classId} onChange={e => setClassId(e.target.value)} className={inputClass}>
                <option value="">— Không gắn lớp —</option>
                {activeClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung cụ thể</label>
              <input
                value={purposeNote}
                onChange={e => setPurposeNote(e.target.value)}
                placeholder="Thực hành bài 12 — Điện phân"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số người dự kiến</label>
              <input
                type="number"
                min={0}
                value={expectedAttendees ?? ''}
                onChange={e =>
                  setExpectedAttendees(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0))
                }
                placeholder={room?.capacity ? `Tối đa ${room.capacity}` : '40'}
                className={inputClass}
              />
              {room?.capacity && (expectedAttendees ?? 0) > room.capacity && (
                <p className="text-[10px] text-amber-700 mt-1">
                  Vượt sức chứa của phòng ({room.capacity} chỗ).
                </p>
              )}
            </div>
          </div>

          {blocked && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 space-y-1.5">
              <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Tiết này đã có lịch
              </p>
              <ul className="space-y-1">
                {problems.map((problem, index) => (
                  <li key={index} className="text-[11px] text-rose-700">• {problem}</li>
                ))}
              </ul>
            </div>
          )}
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
            disabled={isSaving || blocked || !roomId}
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Đang gửi…' : room?.requiresApproval ? 'Gửi Đăng Ký' : 'Đặt Phòng'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
