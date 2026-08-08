'use client';

import React, { useMemo, useState } from 'react';
import { Check, Clock, DoorOpen, Edit, GraduationCap, PlusCircle, Trash2, X } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  ClassGroup,
  PeriodConfig,
  ROOM_KINDS,
  ROOM_KIND_LABELS,
  Room,
  RoomKind,
  SCHOOL_SESSIONS,
  SCHOOL_SESSION_LABELS,
  SchoolSession,
} from '@/Edu-task/types/schedule';
import { listPeriods, periodKey, sortClasses, sortRooms } from '@/Edu-task/lib/schedule';
import { CollapsibleCard } from '@/Edu-task/components/common/CollapsibleCard';
import { ConfirmModal } from '@/Edu-task/components/common/ConfirmModal';
import { RoomInput, ClassInput } from '@/Edu-task/context/hooks/useCatalogLogic';

/**
 * Admin maintenance for the catalogs every scheduling feature picks from:
 * rooms, classes, and the period timetable.
 *
 * These are separate cards rather than one screen because they are edited on
 * completely different rhythms — the timetable once a year, classes once a
 * term, rooms whenever something is built or closed.
 */

const inputClass =
  'w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

// --- Rooms -----------------------------------------------------------------

const EMPTY_ROOM: RoomInput = {
  name: '',
  code: '',
  kind: 'MULTIPURPOSE',
  location: '',
  note: '',
  requiresApproval: false,
  isActive: true,
};

export function RoomCatalogCard() {
  const { rooms, addRoom, updateRoom, deleteRoom, showToast } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoomInput>(EMPTY_ROOM);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Room | null>(null);

  const sorted = useMemo(() => sortRooms(rooms), [rooms]);
  const activeCount = rooms.filter(r => r.isActive).length;

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_ROOM);
    setIsFormOpen(true);
  };

  const openEdit = (room: Room) => {
    setEditingId(room.id);
    const { name, code, kind, capacity, location, note, requiresApproval, isActive } = room;
    setDraft({ name, code, kind, capacity, location, note, requiresApproval, isActive });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.code.trim()) {
      showToast('error', 'Tên phòng và mã phòng không được để trống.');
      return;
    }

    setIsSaving(true);
    try {
      const ok = editingId ? await updateRoom(editingId, draft) : await addRoom(draft);
      if (ok) {
        showToast('success', editingId ? 'Đã cập nhật phòng.' : 'Đã thêm phòng mới.');
        setIsFormOpen(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <CollapsibleCard
        title="Danh Mục Phòng Chức Năng"
        subtitle="Phòng đa năng, phòng thí nghiệm, phòng máy… Đây là danh sách hiện ra khi giáo viên đăng ký phòng."
        icon={DoorOpen}
        iconClassName="text-emerald-600"
        badge={
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
            {activeCount} phòng đang dùng
          </span>
        }
        headerAction={
          <button
            type="button"
            onClick={openCreate}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thêm Phòng</span>
          </button>
        }
      >
        <div className="space-y-3">
          {sorted.length === 0 && !isFormOpen && (
            <p className="text-xs text-slate-500 py-4 text-center">
              Chưa có phòng nào. Bấm <strong>Thêm Phòng</strong> để tạo danh mục — giáo viên chưa
              đăng ký phòng được cho tới khi có ít nhất một phòng.
            </p>
          )}

          {isFormOpen && (
            <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên phòng *</label>
                  <input
                    value={draft.name}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Phòng Thí nghiệm Hóa 1"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã phòng *</label>
                  <input
                    value={draft.code}
                    onChange={e => setDraft({ ...draft, code: e.target.value })}
                    placeholder="TN-HOA-1"
                    className={`${inputClass} font-mono uppercase`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Loại phòng</label>
                  <select
                    value={draft.kind}
                    onChange={e => setDraft({ ...draft, kind: e.target.value as RoomKind })}
                    className={inputClass}
                  >
                    {ROOM_KINDS.map(kind => (
                      <option key={kind} value={kind}>{ROOM_KIND_LABELS[kind]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sức chứa</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.capacity ?? ''}
                    onChange={e =>
                      setDraft({
                        ...draft,
                        capacity: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    placeholder="45"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vị trí</label>
                  <input
                    value={draft.location ?? ''}
                    onChange={e => setDraft({ ...draft, location: e.target.value })}
                    placeholder="Tầng 2, dãy B"
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.requiresApproval}
                  onChange={e => setDraft({ ...draft, requiresApproval: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                />
                <span className="text-xs text-slate-700">
                  <strong>Phải được duyệt mới xác nhận.</strong>
                  <span className="block text-[11px] text-slate-500">
                    Nên bật cho hội trường và phòng dùng chung. Phòng thí nghiệm thường để tắt —
                    bắt chờ duyệt từng tiết sẽ khiến giáo viên quay lại đăng ký bằng sổ giấy.
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={e => setDraft({ ...draft, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-700">Đang sử dụng</span>
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Hủy</span>
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Đang lưu…' : editingId ? 'Cập Nhật' : 'Thêm Phòng'}</span>
                </button>
              </div>
            </form>
          )}

          {sorted.map(room => (
            <div
              key={room.id}
              className={`flex items-start justify-between gap-3 p-3 rounded-2xl border ${
                room.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-70'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900">{room.name}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px]">
                    {room.code}
                  </span>
                  {room.requiresApproval && (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                      Cần duyệt
                    </span>
                  )}
                  {!room.isActive && (
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold">
                      Ngừng sử dụng
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {ROOM_KIND_LABELS[room.kind]}
                  {room.capacity ? ` · ${room.capacity} chỗ` : ''}
                  {room.location ? ` · ${room.location}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(room)}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                  aria-label={`Sửa ${room.name}`}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(room)}
                  className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                  aria-label={`Xóa ${room.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      {pendingDelete && (
        <ConfirmModal
          isOpen
          title="Xóa phòng khỏi danh mục?"
          message={`Phòng "${pendingDelete.name}" sẽ biến mất khỏi mọi form đăng ký. Nếu phòng chỉ tạm ngừng sử dụng, hãy sửa và bỏ tick "Đang sử dụng" thay vì xóa — cách đó giữ lại lịch sử đăng ký.`}
          confirmText="Xóa phòng"
          onConfirm={async () => {
            const target = pendingDelete;
            setPendingDelete(null);
            if (await deleteRoom(target.id)) showToast('success', 'Đã xóa phòng.');
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}

// --- Classes ---------------------------------------------------------------

const EMPTY_CLASS: ClassInput = { name: '', grade: 10, isActive: true };

export function ClassCatalogCard() {
  const { classes, users, addClass, updateClass, deleteClass, showToast } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClassInput>(EMPTY_CLASS);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ClassGroup | null>(null);

  const sorted = useMemo(() => sortClasses(classes), [classes]);
  const teachers = useMemo(
    () => users.filter(u => u.status === 'ACTIVE').sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')),
    [users]
  );

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_CLASS);
    setIsFormOpen(true);
  };

  const openEdit = (classGroup: ClassGroup) => {
    setEditingId(classGroup.id);
    const { name, grade, homeroomTeacherId, homeroomTeacherName, studentCount, isActive } = classGroup;
    setDraft({ name, grade, homeroomTeacherId, homeroomTeacherName, studentCount, isActive });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      showToast('error', 'Tên lớp không được để trống.');
      return;
    }

    setIsSaving(true);
    try {
      const ok = editingId ? await updateClass(editingId, draft) : await addClass(draft);
      if (ok) {
        showToast('success', editingId ? 'Đã cập nhật lớp.' : 'Đã thêm lớp mới.');
        setIsFormOpen(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <CollapsibleCard
        title="Danh Mục Lớp Học"
        subtitle="Dùng cho đăng ký dạy bù, đặt phòng và sổ ghi nề nếp của giám thị."
        icon={GraduationCap}
        iconClassName="text-sky-600"
        badge={
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-sky-50 text-sky-700 border-sky-200">
            {classes.filter(c => c.isActive).length} lớp
          </span>
        }
        headerAction={
          <button
            type="button"
            onClick={openCreate}
            className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thêm Lớp</span>
          </button>
        }
      >
        <div className="space-y-3">
          {sorted.length === 0 && !isFormOpen && (
            <p className="text-xs text-slate-500 py-4 text-center">
              Chưa có lớp nào trong danh mục.
            </p>
          )}

          {isFormOpen && (
            <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên lớp *</label>
                  <input
                    value={draft.name}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    placeholder="10A1"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Khối</label>
                  <select
                    value={draft.grade}
                    onChange={e => setDraft({ ...draft, grade: Number(e.target.value) })}
                    className={inputClass}
                  >
                    {[10, 11, 12].map(grade => (
                      <option key={grade} value={grade}>Khối {grade}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giáo viên chủ nhiệm</label>
                  <select
                    value={draft.homeroomTeacherId ?? ''}
                    onChange={e => {
                      const teacher = teachers.find(t => t.id === e.target.value);
                      setDraft({
                        ...draft,
                        homeroomTeacherId: teacher?.id,
                        homeroomTeacherName: teacher?.fullName,
                      });
                    }}
                    className={inputClass}
                  >
                    <option value="">— Chưa phân công —</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sĩ số</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.studentCount ?? ''}
                    onChange={e =>
                      setDraft({
                        ...draft,
                        studentCount: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    placeholder="42"
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={e => setDraft({ ...draft, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                />
                <span className="text-xs font-bold text-slate-700">Đang hoạt động</span>
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Hủy</span>
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Đang lưu…' : editingId ? 'Cập Nhật' : 'Thêm Lớp'}</span>
                </button>
              </div>
            </form>
          )}

          {sorted.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sorted.map(classGroup => (
                <div
                  key={classGroup.id}
                  className={`flex items-start justify-between gap-2 p-3 rounded-2xl border ${
                    classGroup.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{classGroup.name}</span>
                      {!classGroup.isActive && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold">
                          Ngừng
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {classGroup.homeroomTeacherName ?? 'Chưa có GVCN'}
                      {classGroup.studentCount ? ` · ${classGroup.studentCount} HS` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(classGroup)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                      aria-label={`Sửa lớp ${classGroup.name}`}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(classGroup)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                      aria-label={`Xóa lớp ${classGroup.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleCard>

      {pendingDelete && (
        <ConfirmModal
          isOpen
          title="Xóa lớp khỏi danh mục?"
          message={`Lớp "${pendingDelete.name}" sẽ biến mất khỏi mọi form. Với lớp đã ra trường, hãy bỏ tick "Đang hoạt động" thay vì xóa để giữ lại dữ liệu các năm trước.`}
          confirmText="Xóa lớp"
          onConfirm={async () => {
            const target = pendingDelete;
            setPendingDelete(null);
            if (await deleteClass(target.id)) showToast('success', 'Đã xóa lớp.');
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}

// --- Period timetable ------------------------------------------------------

export function PeriodConfigCard() {
  const { periodConfig, updatePeriodConfig, showToast } = useApp();

  const [draft, setDraft] = useState<PeriodConfig>(periodConfig);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(periodConfig);

  const setCount = (session: SchoolSession, count: number) => {
    const clamped = Math.max(0, Math.min(10, count));
    setDraft(prev => ({
      ...prev,
      ...(session === 'MORNING' ? { morningPeriods: clamped } : { afternoonPeriods: clamped }),
    }));
  };

  const setTime = (session: SchoolSession, period: number, field: 'start' | 'end', value: string) => {
    const key = periodKey(session, period);
    setDraft(prev => ({
      ...prev,
      times: {
        ...prev.times,
        [key]: { ...(prev.times[key] ?? { start: '', end: '' }), [field]: value },
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (await updatePeriodConfig(draft)) {
        showToast('success', 'Đã lưu khung giờ tiết học.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CollapsibleCard
      title="Khung Giờ Tiết Học"
      subtitle="Số tiết mỗi buổi và giờ ra vào lớp. Dùng chung cho đăng ký dạy bù, đặt phòng và sổ nề nếp."
      icon={Clock}
      iconClassName="text-violet-600"
      badge={
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-violet-50 text-violet-700 border-violet-200">
          {periodConfig.morningPeriods} sáng · {periodConfig.afternoonPeriods} chiều
        </span>
      }
    >
      <div className="space-y-5">
        <p className="text-[11px] text-slate-500">
          Số tiết được đánh lại từ 1 ở mỗi buổi, đúng như cách gọi thường ngày: &ldquo;tiết 1 chiều&rdquo;
          là một tiết khác với &ldquo;tiết 1 sáng&rdquo;. Giờ ra vào lớp dùng để tự chọn sẵn tiết đang
          diễn ra khi giám thị mở màn hình ghi nhận.
        </p>

        {SCHOOL_SESSIONS.map(session => (
          <div key={session} className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">
                Buổi {SCHOOL_SESSION_LABELS[session].toLowerCase()} có
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={session === 'MORNING' ? draft.morningPeriods : draft.afternoonPeriods}
                onChange={e => setCount(session, Number(e.target.value) || 0)}
                className="w-20 p-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              <span className="text-xs text-slate-500">tiết</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {listPeriods(draft, session).map(period => {
                const time = draft.times[periodKey(session, period)];
                return (
                  <div
                    key={periodKey(session, period)}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <span className="text-[11px] font-bold text-slate-700 w-12 flex-shrink-0">
                      Tiết {period}
                    </span>
                    <input
                      type="time"
                      value={time?.start ?? ''}
                      onChange={e => setTime(session, period, 'start', e.target.value)}
                      className="flex-1 min-w-0 p-1.5 rounded-lg border border-slate-200 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                    <span className="text-slate-400 text-[11px]">–</span>
                    <input
                      type="time"
                      value={time?.end ?? ''}
                      onChange={e => setTime(session, period, 'end', e.target.value)}
                      className="flex-1 min-w-0 p-1.5 rounded-lg border border-slate-200 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            disabled={!isDirty || isSaving}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Đang lưu…' : 'Lưu Khung Giờ'}</span>
          </button>
        </div>
      </div>
    </CollapsibleCard>
  );
}
