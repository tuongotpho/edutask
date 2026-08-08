'use client';

import React, { useMemo, useState } from 'react';
import { Check, Edit, PlusCircle, Trash2, Wrench, X } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_CONDITION_LABELS,
  Equipment,
  EquipmentCategory,
  EquipmentCondition,
} from '@/Edu-task/types/equipment';
import { availability, sortEquipment } from '@/Edu-task/lib/equipmentAvailability';
import { CollapsibleCard } from '@/Edu-task/components/common/CollapsibleCard';
import { ConfirmModal } from '@/Edu-task/components/common/ConfirmModal';
import { EquipmentInput } from '@/Edu-task/context/hooks/useEquipmentLogic';

/**
 * Admin maintenance for the equipment register.
 *
 * Each row shows availability computed live from open loans, not a stored
 * number — so the admin sees the same figure a borrower does, and there is no
 * second copy to fall out of step.
 */

const inputClass =
  'w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

const EMPTY: EquipmentInput = {
  name: '',
  code: '',
  category: 'PROJECTOR',
  totalQuantity: 1,
  outOfServiceQuantity: 0,
  condition: 'GOOD',
  location: '',
  note: '',
  requiresApproval: false,
  isActive: true,
};

export function EquipmentCatalogCard() {
  const { equipment, loans, addEquipment, updateEquipment, deleteEquipment, showToast } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EquipmentInput>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Equipment | null>(null);

  const sorted = useMemo(() => sortEquipment(equipment), [equipment]);
  const totalUnits = equipment.reduce((sum, e) => sum + (e.totalQuantity ?? 0), 0);

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY);
    setIsFormOpen(true);
  };

  const openEdit = (item: Equipment) => {
    setEditingId(item.id);
    const { name, code, category, totalQuantity, outOfServiceQuantity, condition, location, note, requiresApproval, isActive } = item;
    setDraft({ name, code, category, totalQuantity, outOfServiceQuantity, condition, location, note, requiresApproval, isActive });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.code.trim()) {
      showToast('error', 'Tên và mã thiết bị không được để trống.');
      return;
    }
    if (draft.outOfServiceQuantity > draft.totalQuantity) {
      showToast('error', 'Số cái hỏng không thể lớn hơn tổng số.');
      return;
    }

    setIsSaving(true);
    try {
      const ok = editingId ? await updateEquipment(editingId, draft) : await addEquipment(draft);
      if (ok) {
        showToast('success', editingId ? 'Đã cập nhật thiết bị.' : 'Đã thêm thiết bị mới.');
        setIsFormOpen(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <CollapsibleCard
        title="Danh Mục Thiết Bị"
        subtitle="Máy chiếu, laptop, âm thanh, thiết bị thí nghiệm… Số lượng còn rảnh được tính trực tiếp từ các phiếu mượn đang mở."
        icon={Wrench}
        iconClassName="text-orange-600"
        badge={
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-orange-50 text-orange-700 border-orange-200">
            {equipment.length} loại · {totalUnits} cái
          </span>
        }
        headerAction={
          <button
            type="button"
            onClick={openCreate}
            className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thêm Thiết Bị</span>
          </button>
        }
      >
        <div className="space-y-3">
          {sorted.length === 0 && !isFormOpen && (
            <p className="text-xs text-slate-500 py-4 text-center">
              Chưa có thiết bị nào. Giáo viên chưa mượn được cho tới khi danh mục có ít nhất một mục.
            </p>
          )}

          {isFormOpen && (
            <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên thiết bị *</label>
                  <input
                    value={draft.name}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Máy chiếu Epson EB-X06"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã *</label>
                  <input
                    value={draft.code}
                    onChange={e => setDraft({ ...draft, code: e.target.value })}
                    placeholder="MC-01"
                    className={`${inputClass} font-mono uppercase`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Loại</label>
                  <select
                    value={draft.category}
                    onChange={e => setDraft({ ...draft, category: e.target.value as EquipmentCategory })}
                    className={inputClass}
                  >
                    {EQUIPMENT_CATEGORIES.map(c => (
                      <option key={c} value={c}>{EQUIPMENT_CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tình trạng chung</label>
                  <select
                    value={draft.condition}
                    onChange={e => setDraft({ ...draft, condition: e.target.value as EquipmentCondition })}
                    className={inputClass}
                  >
                    {(Object.keys(EQUIPMENT_CONDITION_LABELS) as EquipmentCondition[]).map(c => (
                      <option key={c} value={c}>{EQUIPMENT_CONDITION_LABELS[c].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tổng số cái *</label>
                  <input
                    type="number"
                    min={1}
                    value={draft.totalQuantity}
                    onChange={e => setDraft({ ...draft, totalQuantity: Math.max(1, Number(e.target.value) || 1) })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đang hỏng / ngừng dùng</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.outOfServiceQuantity}
                    onChange={e => setDraft({ ...draft, outOfServiceQuantity: Math.max(0, Number(e.target.value) || 0) })}
                    className={inputClass}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Vẫn nằm trong sổ tài sản, nhưng không cho mượn.</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nơi cất giữ</label>
                  <input
                    value={draft.location ?? ''}
                    onChange={e => setDraft({ ...draft, location: e.target.value })}
                    placeholder="Kho thiết bị tầng 1"
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.requiresApproval}
                  onChange={e => setDraft({ ...draft, requiresApproval: e.target.checked })}
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 mt-0.5"
                />
                <span className="text-xs text-slate-700">
                  <strong>Phải được duyệt mới cho mượn.</strong>
                  <span className="block text-[11px] text-slate-500">
                    Nên bật cho thiết bị đắt tiền. Dụng cụ thông thường nên để tắt — bắt chờ duyệt
                    từng lần sẽ khiến giáo viên tự lấy mà không ghi sổ.
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={e => setDraft({ ...draft, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                />
                <span className="text-xs font-bold text-slate-700">Đang sử dụng</span>
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5">
                  <X className="w-4 h-4" /> Hủy
                </button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Đang lưu…' : editingId ? 'Cập Nhật' : 'Thêm Thiết Bị'}</span>
                </button>
              </div>
            </form>
          )}

          {sorted.map(item => {
            const snapshot = availability(item, loans);
            const conditionConfig = EQUIPMENT_CONDITION_LABELS[item.condition];
            return (
              <div
                key={item.id}
                className={`flex items-start justify-between gap-3 p-3 rounded-2xl border ${
                  item.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-70'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">{item.name}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px]">
                      {item.code}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${conditionConfig.bg} ${conditionConfig.color}`}>
                      {conditionConfig.label}
                    </span>
                    {item.requiresApproval && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                        Cần duyệt
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {EQUIPMENT_CATEGORY_LABELS[item.category]}
                    {item.location ? ` · ${item.location}` : ''}
                  </p>
                  <p className="text-[11px] mt-0.5">
                    <span className="font-bold text-emerald-700">{snapshot.available} rảnh</span>
                    <span className="text-slate-500">
                      {' / '}{snapshot.serviceable} dùng được / {snapshot.total} tổng
                      {snapshot.reserved > 0 ? ` · ${snapshot.reserved} đang mượn` : ''}
                      {snapshot.outOfService > 0 ? ` · ${snapshot.outOfService} hỏng` : ''}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" onClick={() => openEdit(item)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800" aria-label={`Sửa ${item.name}`}>
                    <Edit className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setPendingDelete(item)} className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600" aria-label={`Xóa ${item.name}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleCard>

      {pendingDelete && (
        <ConfirmModal
          isOpen
          title="Xóa thiết bị khỏi danh mục?"
          message={`"${pendingDelete.name}" sẽ biến mất khỏi form mượn. Với thiết bị đã thanh lý, hãy bỏ tick "Đang sử dụng" thay vì xóa — cách đó giữ lại lịch sử mượn trả.`}
          confirmText="Xóa thiết bị"
          onConfirm={async () => {
            const target = pendingDelete;
            setPendingDelete(null);
            if (await deleteEquipment(target.id)) showToast('success', 'Đã xóa thiết bị.');
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
