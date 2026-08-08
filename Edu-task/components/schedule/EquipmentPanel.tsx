'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, PackageCheck, PlusCircle, Undo2, Wrench, X } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_CONDITION_LABELS,
  EquipmentCondition,
  EquipmentLoan,
  LOAN_STATUS_LABELS,
} from '@/Edu-task/types/equipment';
import { availability, canBorrow, isLoanOverdue, sortEquipment } from '@/Edu-task/lib/equipmentAvailability';
import { formatDateVi, toDateString } from '@/Edu-task/lib/schedule';
import { canManageRooms, isSchoolLeadership } from '@/Edu-task/lib/permissions';

/**
 * Mượn thiết bị.
 *
 * The borrow form shows availability for the selected item and refuses before
 * submission, for the same reason the room picker greys out busy periods:
 * finding out you cannot have something only after filling in a form is what
 * drives people back to the paper register in the store cupboard.
 */

const inputClass =
  'w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20';

export function EquipmentPanel() {
  const {
    currentUser, activeRole, equipment, loans,
    requestLoan, decideLoan, returnLoan, cancelLoan, showToast,
  } = useApp();

  const today = toDateString(new Date());
  const canManage = canManageRooms(currentUser, activeRole);
  const seesEverything = isSchoolLeadership(currentUser, activeRole) || canManage;

  const activeEquipment = useMemo(
    () => sortEquipment(equipment).filter(e => e.isActive),
    [equipment]
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [equipmentId, setEquipmentId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [borrowDate, setBorrowDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [isSaving, setIsSaving] = useState(false);

  const selected = activeEquipment.find(e => e.id === equipmentId);
  const snapshot = selected ? availability(selected, loans) : null;
  const check = selected ? canBorrow(selected, loans, quantity) : null;

  const visibleLoans = useMemo(() => {
    if (!currentUser) return [];
    const scoped = seesEverything ? loans : loans.filter(l => l.borrowerId === currentUser.id);
    // Overdue first, then open, then history — the order someone acts in.
    return [...scoped].sort((a, b) => {
      const rank = (l: EquipmentLoan) =>
        isLoanOverdue(l, today) ? 0 : l.status === 'REQUESTED' ? 1 : l.status === 'BORROWED' ? 2 : 3;
      return rank(a) - rank(b) || (b.borrowDate ?? '').localeCompare(a.borrowDate ?? '');
    });
  }, [loans, currentUser, seesEverything, today]);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const created = await requestLoan({ equipmentId, quantity, purpose, borrowDate, dueDate });
      if (created) {
        showToast(
          'success',
          created.status === 'BORROWED'
            ? `Đã ghi phiếu mượn ${created.equipmentName}. Hạn trả ${formatDateVi(created.dueDate)}.`
            : `Đã gửi yêu cầu mượn ${created.equipmentName}, chờ duyệt.`
        );
        setIsFormOpen(false);
        setPurpose('');
        setQuantity(1);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Mượn Thiết Bị</span>
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-orange-600" />
            Phiếu Mượn Thiết Bị
          </h3>

          {activeEquipment.length === 0 && (
            <p className="text-[11px] text-amber-900 p-3 rounded-2xl bg-amber-50 border border-amber-200">
              Danh mục thiết bị đang trống. Quản trị viên cần thêm thiết bị trong tab <strong>Quản Trị</strong> trước.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Thiết bị *</label>
              <select value={equipmentId} onChange={e => setEquipmentId(e.target.value)} className={inputClass}>
                <option value="">— Chọn thiết bị —</option>
                {activeEquipment.map(item => {
                  const snap = availability(item, loans);
                  return (
                    <option key={item.id} value={item.id} disabled={snap.available === 0}>
                      {item.name} · {EQUIPMENT_CATEGORY_LABELS[item.category]} · còn {snap.available}/{snap.serviceable}
                      {snap.available === 0 ? ' (hết)' : ''}
                    </option>
                  );
                })}
              </select>
              {snapshot && (
                <p className="text-[11px] mt-1.5 text-slate-600">
                  <strong className="text-emerald-700">{snapshot.available} cái rảnh</strong>
                  {' · '}{snapshot.reserved} đang mượn hoặc chờ duyệt
                  {snapshot.outOfService > 0 ? ` · ${snapshot.outOfService} đang hỏng` : ''}
                  {selected?.requiresApproval ? ' · Thiết bị này cần được duyệt' : ' · Mượn xong dùng được ngay'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng</label>
              <input
                type="number"
                min={1}
                max={snapshot?.available ?? 99}
                value={quantity}
                onChange={e => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className={inputClass}
              />
            </div>
            <div />
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày mượn</label>
              <input type="date" value={borrowDate} onChange={e => setBorrowDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hạn trả</label>
              <input type="date" min={borrowDate} value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Mục đích sử dụng *</label>
              <input
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="Dạy chuyên đề lớp 11A2"
                className={inputClass}
              />
            </div>
          </div>

          {check && !check.ok && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{check.reason}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsFormOpen(false)} className={secondaryBtn}>Hủy</button>
            <button
              type="button"
              disabled={isSaving || !equipmentId || !purpose.trim() || (check ? !check.ok : true)}
              onClick={handleSubmit}
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Đang gửi…' : selected?.requiresApproval ? 'Gửi Yêu Cầu' : 'Ghi Phiếu Mượn'}</span>
            </button>
          </div>
        </div>
      )}

      {visibleLoans.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
          <p className="text-xs text-slate-500">
            {seesEverything ? 'Chưa có phiếu mượn nào.' : 'Bạn chưa mượn thiết bị nào.'}
          </p>
        </div>
      ) : (
        visibleLoans.map(loan => (
          <LoanCard
            key={loan.id}
            loan={loan}
            today={today}
            isOwner={loan.borrowerId === currentUser?.id}
            canManage={canManage}
            onDecide={async (decision) => {
              const comment = decision === 'REJECTED'
                ? window.prompt('Lý do từ chối (tùy chọn):') ?? undefined
                : undefined;
              if (await decideLoan(loan.id, decision, comment)) {
                showToast('success', decision === 'BORROWED' ? 'Đã duyệt cho mượn.' : 'Đã từ chối.');
              }
            }}
            onReturn={async (condition, note) => {
              if (await returnLoan(loan.id, condition, note)) {
                showToast(
                  'success',
                  condition === 'GOOD'
                    ? 'Đã nhận lại thiết bị.'
                    : 'Đã nhận lại và ghi nhận hư hỏng — số cái này đã được tạm ngừng cho mượn.'
                );
              }
            }}
            onCancel={async () => {
              if (await cancelLoan(loan.id)) showToast('success', 'Đã hủy phiếu mượn.');
            }}
          />
        ))
      )}
    </section>
  );
}

function LoanCard({
  loan, today, isOwner, canManage, onDecide, onReturn, onCancel,
}: {
  loan: EquipmentLoan;
  today: string;
  isOwner: boolean;
  canManage: boolean;
  onDecide: (decision: 'BORROWED' | 'REJECTED') => void;
  onReturn: (condition: EquipmentCondition, note?: string) => void;
  onCancel: () => void;
}) {
  const [isReturning, setIsReturning] = useState(false);
  const [condition, setCondition] = useState<EquipmentCondition>('GOOD');
  const [note, setNote] = useState('');

  const overdue = isLoanOverdue(loan, today);
  const statusConfig = LOAN_STATUS_LABELS[loan.status];

  return (
    <article className={`bg-white rounded-3xl border p-4 shadow-sm space-y-3 ${
      overdue ? 'border-rose-300' : 'border-slate-200'
    }`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{loan.code}</span>
            <span className="text-sm font-bold text-slate-900">
              {loan.quantity} × {loan.equipmentName}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig.bg} ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            {overdue && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200">
                Quá hạn trả
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {loan.borrowerName} · {loan.departmentName}
          </p>
          <p className="text-[11px] text-slate-600">
            {formatDateVi(loan.borrowDate)} → hạn trả {formatDateVi(loan.dueDate)} · {loan.purpose}
          </p>
          {loan.returnedAt && (
            <p className="text-[11px] text-slate-500 mt-0.5">
              Đã trả cho {loan.returnedToName}
              {loan.returnCondition && loan.returnCondition !== 'GOOD'
                ? ` · ${EQUIPMENT_CONDITION_LABELS[loan.returnCondition].label}`
                : ''}
              {loan.returnNote ? ` — ${loan.returnNote}` : ''}
            </p>
          )}
          {loan.decisionComment && (
            <p className="text-[11px] text-slate-500 mt-0.5 italic">{loan.decisionComment}</p>
          )}
        </div>
      </div>

      {isReturning && (
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <label className="block text-[11px] font-bold text-slate-700">Tình trạng khi nhận lại</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(EQUIPMENT_CONDITION_LABELS) as EquipmentCondition[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setCondition(option)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  condition === option
                    ? `${EQUIPMENT_CONDITION_LABELS[option].bg} ${EQUIPMENT_CONDITION_LABELS[option].color}`
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {EQUIPMENT_CONDITION_LABELS[option].label}
              </button>
            ))}
          </div>
          {condition !== 'GOOD' && (
            <p className="text-[10px] text-amber-700">
              {loan.quantity} cái sẽ được tạm ngừng cho mượn cho tới khi sửa xong.
            </p>
          )}
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ghi chú (tùy chọn)"
            className={inputClass}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsReturning(false)} className={secondaryBtn}>Hủy</button>
            <button
              type="button"
              onClick={() => { onReturn(condition, note); setIsReturning(false); setNote(''); }}
              className={primaryBtn}
            >
              <PackageCheck className="w-3.5 h-3.5" /> Xác Nhận Đã Nhận
            </button>
          </div>
        </div>
      )}

      {!isReturning && (
        <div className="flex flex-wrap gap-2 justify-end">
          {isOwner && loan.status === 'REQUESTED' && (
            <button type="button" onClick={onCancel} className={secondaryBtn}>Rút yêu cầu</button>
          )}
          {canManage && loan.status === 'REQUESTED' && (
            <>
              <button type="button" onClick={() => onDecide('REJECTED')} className={dangerBtn}>
                <X className="w-3.5 h-3.5" /> Từ chối
              </button>
              <button type="button" onClick={() => onDecide('BORROWED')} className={primaryBtn}>
                <Check className="w-3.5 h-3.5" /> Duyệt cho mượn
              </button>
            </>
          )}
          {canManage && loan.status === 'BORROWED' && (
            <button type="button" onClick={() => setIsReturning(true)} className={primaryBtn}>
              <Undo2 className="w-3.5 h-3.5" /> Nhận lại
            </button>
          )}
          {/* Said plainly rather than leaving the borrower hunting for a button
              that deliberately does not exist. */}
          {isOwner && !canManage && loan.status === 'BORROWED' && (
            <span className="text-[10px] text-slate-400 self-center">
              Mang thiết bị tới phòng thiết bị để xác nhận trả.
            </span>
          )}
        </div>
      )}
    </article>
  );
}

const primaryBtn =
  'px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors';
const secondaryBtn =
  'px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] transition-colors';
const dangerBtn =
  'px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1 transition-colors';
