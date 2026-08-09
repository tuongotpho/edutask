'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarCheck,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  FileText,
  PlusCircle,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  ATTENDANCE_MARKS,
  ATTENDANCE_MARK_LABELS,
  MEETING_KIND_LABELS,
  MEETING_STATUS_LABELS,
  Meeting,
} from '@/Edu-task/types/meeting';
import { formatDateVi, weekdayLabel } from '@/Edu-task/lib/schedule';
import {
  isMinutesOutstanding,
  meetingPunctualityRate,
  meetingsInMonth,
  summariseByPerson,
  summariseRoll,
} from '@/Edu-task/lib/meetingStats';
import { canManageMeetings } from '@/Edu-task/lib/permissions';
import { MeetingFormModal } from './MeetingFormModal';

/**
 * Cuộc họp & điểm danh.
 *
 * The roll call is the centre of this screen, not the meeting list: calling it
 * is a live activity done while people file into a room, so it has to be
 * reachable in one tap from the meeting and be all tap targets.
 */

type SubView = 'list' | 'summary';

export function MeetingsTab() {
  const {
    currentUser, activeRole, meetings,
    setMeetingStatus, saveMinutes, deleteMeeting, markRemainingPresent, showToast,
  } = useApp();

  const canManage = canManageMeetings(currentUser, activeRole);

  const [subView, setSubView] = useState<SubView>('list');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [minutesDraft, setMinutesDraft] = useState<{ id: string; text: string } | null>(null);

  const monthMeetings = useMemo(() => meetingsInMonth(meetings, month), [meetings, month]);
  const perPerson = useMemo(() => summariseByPerson(monthMeetings), [monthMeetings]);
  const punctuality = useMemo(() => meetingPunctualityRate(monthMeetings), [monthMeetings]);
  const outstandingMinutes = useMemo(
    () => meetings.filter(isMinutesOutstanding).length,
    [meetings]
  );

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[5px] border border-slate-200 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Cuộc Họp &amp; Điểm Danh</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Văn thư tạo cuộc họp, gửi giấy mời, điểm danh và chốt biên bản.
          {outstandingMinutes > 0 && (
            <span className="text-amber-700 font-semibold"> Còn {outstandingMinutes} biên bản chưa chốt.</span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {([['list', 'Danh Sách Cuộc Họp', CalendarCheck], ['summary', 'Tổng Hợp Tháng', BarChart3]] as const)
            .filter(([id]) => id === 'list' || canManage)
            .map(([id, label, Icon]) => {
              const isActive = subView === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSubView(id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-violet-400' : 'text-slate-400'}`} />
                  <span>{label}</span>
                </button>
              );
            })}

          {canManage && (
            <button
              type="button"
              onClick={() => { setEditing(null); setIsFormOpen(true); }}
              className="ml-auto px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tạo Cuộc Họp</span>
            </button>
          )}
        </div>
      </div>

      {subView === 'list' && (
        <section className="space-y-3">
          {meetings.length === 0 ? (
            <div className="bg-white rounded-[5px] border border-slate-200 p-10 text-center shadow-sm">
              <p className="text-xs text-slate-500">
                {canManage ? 'Chưa có cuộc họp nào.' : 'Bạn chưa được mời họp buổi nào.'}
              </p>
            </div>
          ) : (
            meetings.map(meeting => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                canManage={canManage}
                currentUserId={currentUser?.id}
                isExpanded={expandedId === meeting.id}
                onToggle={() => setExpandedId(expandedId === meeting.id ? null : meeting.id)}
                onEdit={() => { setEditing(meeting); setIsFormOpen(true); }}
                onStatus={async (status) => {
                  if (await setMeetingStatus(meeting.id, status)) {
                    showToast('success', status === 'CANCELLED' ? 'Đã hủy cuộc họp và báo cho thành phần dự họp.' : 'Đã cập nhật trạng thái.');
                  }
                }}
                onMarkRest={async () => {
                  if (await markRemainingPresent(meeting.id)) showToast('success', 'Đã đánh dấu những người còn lại là có mặt.');
                }}
                minutesDraft={minutesDraft?.id === meeting.id ? minutesDraft.text : null}
                onStartMinutes={() => setMinutesDraft({ id: meeting.id, text: meeting.minutes?.content ?? '' })}
                onChangeMinutes={(text) => setMinutesDraft({ id: meeting.id, text })}
                onCancelMinutes={() => setMinutesDraft(null)}
                onSaveMinutes={async () => {
                  if (minutesDraft && await saveMinutes(meeting.id, minutesDraft.text)) {
                    showToast('success', 'Đã chốt biên bản.');
                    setMinutesDraft(null);
                  }
                }}
                onDelete={async () => {
                  if (await deleteMeeting(meeting.id)) showToast('success', 'Đã xóa cuộc họp.');
                }}
              />
            ))
          )}
        </section>
      )}

      {subView === 'summary' && canManage && (
        <section className="space-y-4">
          <div className="bg-white rounded-[5px] border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">Tổng Hợp Dự Họp</h3>
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {monthMeetings.filter(m => m.status === 'COMPLETED').length} cuộc họp đã diễn ra ·{' '}
              {punctuality === null
                ? 'chưa điểm danh buổi nào'
                : `${punctuality}% lượt dự họp đúng giờ`}
              . Vắng có phép không tính vào cả tử số lẫn mẫu số.
            </p>
          </div>

          <div className="bg-white rounded-[5px] border border-slate-200 shadow-sm overflow-hidden">
            {perPerson.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 text-center">
                Tháng này chưa có cuộc họp nào được điểm danh.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left font-bold text-slate-700">Người dự</th>
                      <th className="p-3 text-left font-bold text-slate-700">Tổ</th>
                      <th className="p-3 text-center font-bold text-slate-700">Được mời</th>
                      <th className="p-3 text-center font-bold text-slate-700">Đi muộn</th>
                      <th className="p-3 text-center font-bold text-slate-700">Phút muộn</th>
                      <th className="p-3 text-center font-bold text-slate-700">Vắng KP</th>
                      <th className="p-3 text-center font-bold text-slate-700">Vắng CP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perPerson.map(row => (
                      <tr key={row.userId} className="border-t border-slate-100">
                        <td className="p-3 font-bold text-slate-800">{row.userName}</td>
                        <td className="p-3 text-slate-500">{row.departmentName}</td>
                        <td className="p-3 text-center">{row.meetingsCalled}</td>
                        <td className="p-3 text-center text-amber-700 font-bold">{row.lateCount || '—'}</td>
                        <td className="p-3 text-center">{row.totalMinutesLate || '—'}</td>
                        <td className="p-3 text-center text-rose-700 font-bold">{row.absentCount || '—'}</td>
                        <td className="p-3 text-center text-sky-700">{row.excusedCount || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {isFormOpen && (
        <MeetingFormModal
          editing={editing}
          onClose={() => { setIsFormOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function MeetingCard({
  meeting, canManage, currentUserId, isExpanded, onToggle, onEdit, onStatus, onMarkRest,
  minutesDraft, onStartMinutes, onChangeMinutes, onCancelMinutes, onSaveMinutes, onDelete,
}: {
  meeting: Meeting;
  canManage: boolean;
  currentUserId?: string;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onStatus: (status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED') => void;
  onMarkRest: () => void;
  minutesDraft: string | null;
  onStartMinutes: () => void;
  onChangeMinutes: (text: string) => void;
  onCancelMinutes: () => void;
  onSaveMinutes: () => void;
  onDelete: () => void;
}) {
  const { markAttendance, showToast } = useApp();
  const roll = summariseRoll(meeting.participants);
  const statusConfig = MEETING_STATUS_LABELS[meeting.status];
  const mine = meeting.participants.find(p => p.userId === currentUserId);

  return (
    <article className="bg-white rounded-[5px] border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <button type="button" onClick={onToggle} className="flex items-start gap-2 text-left min-w-0 flex-1">
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
              : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  {meeting.code}
                </span>
                <span className="text-sm font-bold text-slate-900">{meeting.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig.bg} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                {isMinutesOutstanding(meeting) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">
                    Chưa chốt biên bản
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {MEETING_KIND_LABELS[meeting.kind]} · {weekdayLabel(meeting.date)} {formatDateVi(meeting.date)} lúc {meeting.startTime}
                {meeting.location ? ` · ${meeting.location}` : ''}
              </p>
              <p className="text-[11px] text-slate-500">
                {roll.total} người được mời
                {roll.unmarked > 0
                  ? ` · ${roll.unmarked} chưa điểm danh`
                  : ` · ${roll.present} có mặt, ${roll.late} muộn, ${roll.absent} vắng KP, ${roll.excused} vắng CP`}
              </p>
            </div>
          </button>
        </div>

        {/* A participant's own mark, without having to open the roll. */}
        {mine?.mark && (
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold border ${
            ATTENDANCE_MARK_LABELS[mine.mark].bg} ${ATTENDANCE_MARK_LABELS[mine.mark].color}`}>
            Bạn: {ATTENDANCE_MARK_LABELS[mine.mark].label}
            {mine.mark === 'LATE' && mine.minutesLate ? ` ${mine.minutesLate} phút` : ''}
          </div>
        )}

        {meeting.agenda && <p className="text-[11px] text-slate-600">{meeting.agenda}</p>}

        {canManage && (
          <div className="flex flex-wrap gap-2 justify-end pt-1">
            {meeting.status === 'SCHEDULED' && (
              <>
                <button type="button" onClick={onEdit} className={secondaryBtn}>Sửa</button>
                <button type="button" onClick={() => onStatus('CANCELLED')} className={dangerBtn}>
                  <X className="w-3.5 h-3.5" /> Hủy họp
                </button>
                <button type="button" onClick={() => onStatus('COMPLETED')} className={primaryBtn}>
                  <CheckCheck className="w-3.5 h-3.5" /> Kết thúc họp
                </button>
              </>
            )}
            {meeting.status === 'CANCELLED' && (
              <button type="button" onClick={onDelete} className={dangerBtn}>
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </button>
            )}
            {meeting.status === 'COMPLETED' && !minutesDraft && (
              <button type="button" onClick={onStartMinutes} className={primaryBtn}>
                <FileText className="w-3.5 h-3.5" /> {meeting.minutes ? 'Sửa biên bản' : 'Chốt biên bản'}
              </button>
            )}
          </div>
        )}
      </div>

      {minutesDraft !== null && (
        <div className="px-4 pb-4 space-y-2">
          <textarea
            value={minutesDraft}
            onChange={e => onChangeMinutes(e.target.value)}
            rows={5}
            placeholder="Nội dung biên bản cuộc họp…"
            className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancelMinutes} className={secondaryBtn}>Hủy</button>
            <button type="button" onClick={onSaveMinutes} className={primaryBtn}>Lưu Biên Bản</button>
          </div>
        </div>
      )}

      {meeting.minutes && minutesDraft === null && (
        <div className="mx-4 mb-4 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide">
            Biên bản — {meeting.minutes.finalizedByName}
          </span>
          <p className="text-[11px] text-slate-700 mt-1 whitespace-pre-wrap">{meeting.minutes.content}</p>
        </div>
      )}

      {isExpanded && (
        <div className="border-t border-slate-100">
          <div className="p-4 flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-slate-700">Điểm danh</h4>
            {canManage && roll.unmarked > 0 && (
              <button type="button" onClick={onMarkRest} className={secondaryBtn}>
                Đánh dấu {roll.unmarked} người còn lại là có mặt
              </button>
            )}
          </div>

          <div className="px-4 pb-4 space-y-1.5 max-h-96 overflow-y-auto">
            {meeting.participants.map(participant => (
              <div
                key={participant.userId}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex-wrap"
              >
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-slate-800">{participant.userName}</span>
                  <span className="block text-[10px] text-slate-500">{participant.departmentName}</span>
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-1">
                    {ATTENDANCE_MARKS.map(mark => {
                      const config = ATTENDANCE_MARK_LABELS[mark];
                      const selected = participant.mark === mark;
                      return (
                        <button
                          key={mark}
                          type="button"
                          onClick={async () => {
                            if (await markAttendance(meeting.id, participant.userId, mark)) {
                              // No toast: the roll is called dozens of times in
                              // a row and a toast per person would bury the screen.
                            } else {
                              showToast('error', 'Không lưu được điểm danh.');
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                            selected ? `${config.bg} ${config.color}` : 'bg-white border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          {config.label}
                        </button>
                      );
                    })}
                    {participant.mark === 'LATE' && (
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={participant.minutesLate ?? 5}
                        onChange={e =>
                          markAttendance(meeting.id, participant.userId, 'LATE', {
                            minutesLate: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="w-16 p-1 rounded-lg border border-slate-200 text-[10px] font-bold"
                        aria-label={`Số phút muộn của ${participant.userName}`}
                      />
                    )}
                  </div>
                ) : (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    participant.mark
                      ? `${ATTENDANCE_MARK_LABELS[participant.mark].bg} ${ATTENDANCE_MARK_LABELS[participant.mark].color}`
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {participant.mark ? ATTENDANCE_MARK_LABELS[participant.mark].label : 'Chưa điểm danh'}
                    {participant.mark === 'LATE' && participant.minutesLate ? ` ${participant.minutesLate}′` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

const primaryBtn =
  'px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors';
const secondaryBtn =
  'px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] transition-colors';
const dangerBtn =
  'px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1 transition-colors';
