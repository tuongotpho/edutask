'use client';

import React, { useMemo, useState } from 'react';
import {
  CalendarRange,
  Check,
  DoorOpen,
  PlusCircle,
  Repeat,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  MAKEUP_REASON_LABELS,
  MAKEUP_STATUS_LABELS,
  MakeupClass,
  MakeupStatus,
} from '@/Edu-task/types/makeup';
import {
  BOOKING_PURPOSE_LABELS,
  BOOKING_STATUS_LABELS,
  BookingStatus,
  RoomBooking,
} from '@/Edu-task/types/booking';
import { formatSlot } from '@/Edu-task/lib/schedule';
import { canApproveMakeup, canManageRooms, isSchoolLeadership } from '@/Edu-task/lib/permissions';
import { StatusRow, rowButton } from '@/Edu-task/components/common/StatusRow';
import { bookingTone, makeupTone } from '@/Edu-task/lib/statusTone';
import { MakeupFormModal } from './MakeupFormModal';
import { BookingFormModal } from './BookingFormModal';
import { RoomTimetable } from './RoomTimetable';
import { EquipmentPanel } from './EquipmentPanel';

/**
 * Dạy bù & phòng học.
 *
 * The two features share one tab because they are the same daily act — booking
 * a slot — and because a sidebar with a separate entry for every small workflow
 * stops being navigable. The sub-view switch keeps each list short enough to
 * scan.
 */

type SubView = 'makeup' | 'booking' | 'timetable' | 'equipment';

export function ScheduleRegistrationTab() {
  const {
    currentUser, activeRole, makeups, bookings, loans,
    decideMakeup, cancelMakeup, completeMakeup, deleteMakeup,
    decideBooking, cancelBooking,
    showToast,
  } = useApp();

  const [subView, setSubView] = useState<SubView>('makeup');
  const [isMakeupFormOpen, setIsMakeupFormOpen] = useState(false);
  const [editingMakeup, setEditingMakeup] = useState<MakeupClass | null>(null);
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);

  const canApprove = canApproveMakeup(currentUser, activeRole);
  const canManageBookings = canManageRooms(currentUser, activeRole);
  const seesEverything = isSchoolLeadership(currentUser, activeRole);

  /**
   * Scope. Firestore hands every record to the browser because clash detection
   * needs the full picture, but showing a teacher the whole school's paperwork
   * would bury their own three records. Leadership and approvers see all;
   * everyone else sees their own plus their department's.
   */
  const visibleMakeups = useMemo(() => {
    if (!currentUser) return [];
    if (seesEverything || canApprove) {
      return canApprove && !seesEverything
        ? makeups.filter(m => m.departmentId === currentUser.departmentId || m.teacherId === currentUser.id)
        : makeups;
    }
    return makeups.filter(m => m.teacherId === currentUser.id);
  }, [makeups, currentUser, seesEverything, canApprove]);

  const visibleBookings = useMemo(() => {
    if (!currentUser) return [];
    if (seesEverything || canManageBookings) return bookings;
    return bookings.filter(
      b => b.requesterId === currentUser.id || b.departmentId === currentUser.departmentId
    );
  }, [bookings, currentUser, seesEverything, canManageBookings]);

  const pendingMakeups = visibleMakeups.filter(m => m.status === 'IN_REVIEW').length;
  const pendingBookings = visibleBookings.filter(b => b.status === 'IN_REVIEW').length;
  const pendingLoans = loans.filter(l => l.status === 'REQUESTED').length;

  const tabs: Array<{ id: SubView; label: string; icon: typeof Repeat; badge: number }> = [
    { id: 'makeup', label: 'Đăng Ký Dạy Bù', icon: Repeat, badge: pendingMakeups },
    { id: 'booking', label: 'Đăng Ký Phòng', icon: DoorOpen, badge: pendingBookings },
    { id: 'timetable', label: 'Lịch Phòng', icon: CalendarRange, badge: 0 },
    { id: 'equipment', label: 'Mượn Thiết Bị', icon: Wrench, badge: pendingLoans },
  ];

  return (
    <div className="space-y-5">

      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
          Dạy Bù, Phòng &amp; Thiết Bị
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Đăng ký tiết dạy bù khi mất tiết, đặt phòng chức năng và mượn thiết bị.
          Hệ thống tự chặn trùng lịch giáo viên, lớp, phòng và tự tính số thiết bị còn rảnh.
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = subView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubView(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isActive ? 'bg-indigo-500 text-white' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {subView === 'makeup' && (
        <section className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { setEditingMakeup(null); setIsMakeupFormOpen(true); }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Đăng Ký Dạy Bù</span>
            </button>
          </div>

          {visibleMakeups.length === 0 ? (
            <EmptyState message="Chưa có đăng ký dạy bù nào." />
          ) : (
            visibleMakeups.map(makeup => (
              <MakeupCard
                key={makeup.id}
                makeup={makeup}
                isOwner={makeup.teacherId === currentUser?.id}
                canApprove={canApprove && makeup.teacherId !== currentUser?.id}
                onEdit={() => { setEditingMakeup(makeup); setIsMakeupFormOpen(true); }}
                onDecide={async (decision) => {
                  const comment = decision === 'REJECTED'
                    ? window.prompt('Lý do từ chối (tùy chọn):') ?? undefined
                    : undefined;
                  if (await decideMakeup(makeup.id, decision, comment)) {
                    showToast('success', decision === 'APPROVED' ? 'Đã duyệt đăng ký dạy bù.' : 'Đã từ chối.');
                  }
                }}
                onCancel={async () => {
                  if (await cancelMakeup(makeup.id)) showToast('success', 'Đã hủy đăng ký.');
                }}
                onComplete={async () => {
                  if (await completeMakeup(makeup.id)) showToast('success', 'Đã ghi nhận dạy bù xong.');
                }}
                onDelete={async () => {
                  if (await deleteMakeup(makeup.id)) showToast('success', 'Đã xóa đăng ký.');
                }}
              />
            ))
          )}
        </section>
      )}

      {subView === 'booking' && (
        <section className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsBookingFormOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Đăng Ký Phòng</span>
            </button>
          </div>

          {visibleBookings.length === 0 ? (
            <EmptyState message="Chưa có đăng ký phòng nào." />
          ) : (
            visibleBookings.map(booking => (
              <BookingCard
                key={booking.id}
                booking={booking}
                isOwner={booking.requesterId === currentUser?.id}
                canManage={canManageBookings}
                onDecide={async (decision) => {
                  const comment = decision === 'REJECTED'
                    ? window.prompt('Lý do từ chối (tùy chọn):') ?? undefined
                    : undefined;
                  if (await decideBooking(booking.id, decision, comment)) {
                    showToast('success', decision === 'CONFIRMED' ? 'Đã duyệt đăng ký phòng.' : 'Đã từ chối.');
                  }
                }}
                onCancel={async () => {
                  if (await cancelBooking(booking.id)) showToast('success', 'Đã hủy đăng ký phòng.');
                }}
              />
            ))
          )}
        </section>
      )}

      {subView === 'timetable' && <RoomTimetable />}

      {subView === 'equipment' && <EquipmentPanel />}

      {isMakeupFormOpen && (
        <MakeupFormModal
          editing={editingMakeup}
          onClose={() => { setIsMakeupFormOpen(false); setEditingMakeup(null); }}
        />
      )}
      {isBookingFormOpen && <BookingFormModal onClose={() => setIsBookingFormOpen(false)} />}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
      <p className="text-xs text-slate-500">{message}</p>
    </div>
  );
}


function MakeupCard({
  makeup, isOwner, canApprove,
  onEdit, onDecide, onCancel, onComplete, onDelete,
}: {
  makeup: MakeupClass;
  isOwner: boolean;
  canApprove: boolean;
  onEdit: () => void;
  onDecide: (decision: 'APPROVED' | 'REJECTED') => void;
  onCancel: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const status: MakeupStatus = makeup.status;

  return (
    <StatusRow
      tone={makeupTone(status)}
      statusLabel={MAKEUP_STATUS_LABELS[status].label}
      personName={makeup.teacherName}
      title={`Lớp ${makeup.className}`}
      titleMeta={`${makeup.teacherName}${makeup.subject ? ` · ${makeup.subject}` : ''}`}
      trailing={makeup.code}
      actions={
        <>
          {isOwner && status === 'IN_REVIEW' && (
            <>
              <button type="button" onClick={onEdit} className={rowButton.secondary}>Sửa</button>
              <button type="button" onClick={onCancel} className={rowButton.secondary}>Hủy</button>
            </>
          )}
          {isOwner && status === 'APPROVED' && (
            <button type="button" onClick={onComplete} className={rowButton.success}>
              <Check className="w-3.5 h-3.5" /> Đã dạy xong
            </button>
          )}
          {isOwner && (status === 'CANCELLED' || status === 'REJECTED') && (
            <button type="button" onClick={onDelete} className={rowButton.danger}>
              <Trash2 className="w-3.5 h-3.5" /> Xóa
            </button>
          )}
          {canApprove && status === 'IN_REVIEW' && (
            <>
              <button type="button" onClick={() => onDecide('REJECTED')} className={rowButton.danger}>
                <X className="w-3.5 h-3.5" /> Từ chối
              </button>
              <button type="button" onClick={() => onDecide('APPROVED')} className={rowButton.primary}>
                <Check className="w-3.5 h-3.5" /> Duyệt
              </button>
            </>
          )}
        </>
      }
    >
      {/* The two slots stay as a pair of tinted blocks: "which period was lost"
          and "when it will be taught" is the whole record, and separating them
          visually is what makes it readable at a glance. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
          <span className="block text-[10px] font-bold text-rose-700 uppercase tracking-wide">Tiết mất</span>
          <span className="text-slate-800">{formatSlot(makeup.missedSlot)}</span>
          <span className="block text-slate-500 mt-0.5">
            {MAKEUP_REASON_LABELS[makeup.reason]}
            {makeup.reasonNote ? ` — ${makeup.reasonNote}` : ''}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
          <span className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Tiết bù</span>
          <span className="text-slate-800">{formatSlot(makeup.makeupSlot)}</span>
          <span className="block text-slate-500 mt-0.5">
            {makeup.roomName ?? 'Dạy tại lớp'}
          </span>
        </div>
      </div>
    </StatusRow>
  );
}

function BookingCard({
  booking, isOwner, canManage, onDecide, onCancel,
}: {
  booking: RoomBooking;
  isOwner: boolean;
  canManage: boolean;
  onDecide: (decision: 'CONFIRMED' | 'REJECTED') => void;
  onCancel: () => void;
}) {
  const status: BookingStatus = booking.status;
  const isLive = status === 'CONFIRMED' || status === 'IN_REVIEW';

  return (
    <StatusRow
      tone={bookingTone(status)}
      statusLabel={BOOKING_STATUS_LABELS[status].label}
      personName={booking.requesterName}
      title={booking.roomName}
      titleMeta={booking.className ? `Lớp ${booking.className}` : undefined}
      trailing={booking.code}
      detail={
        <>
          {formatSlot(booking.slot)} · {booking.requesterName}
          <span className="block text-slate-500 mt-0.5">
            {BOOKING_PURPOSE_LABELS[booking.purpose]}
            {booking.purposeNote ? ` — ${booking.purposeNote}` : ''}
          </span>
          {booking.decisionComment && (
            <span className="block text-slate-500 mt-0.5 italic">
              Ghi chú duyệt: {booking.decisionComment}
            </span>
          )}
        </>
      }
      actions={
        <>
          {(isOwner || canManage) && isLive && (
            <button type="button" onClick={onCancel} className={rowButton.secondary}>Hủy đặt</button>
          )}
          {canManage && status === 'IN_REVIEW' && (
            <>
              <button type="button" onClick={() => onDecide('REJECTED')} className={rowButton.danger}>
                <X className="w-3.5 h-3.5" /> Từ chối
              </button>
              <button type="button" onClick={() => onDecide('CONFIRMED')} className={rowButton.primary}>
                <Check className="w-3.5 h-3.5" /> Duyệt
              </button>
            </>
          )}
        </>
      }
    />
  );
}

