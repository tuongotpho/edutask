'use client';

import React, { useMemo, useState } from 'react';
import {
  Award,
  ClipboardCheck,
  Edit,
  HeartHandshake,
  PlusCircle,
  Search,
  Trash2,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  COMMENDATION_CATEGORIES,
  CONDUCT_CATEGORY_LABELS,
  CONDUCT_KIND_LABELS,
  ConductCategory,
  ConductKind,
  GENDER_LABELS,
  Gender,
  Student,
  VIOLATION_CATEGORIES,
} from '@/Edu-task/types/student';
import { formatDateVi, sortClasses, toDateString } from '@/Edu-task/lib/schedule';
import { matchesSearch } from '@/Edu-task/lib/utils';
import {
  conductInMonth,
  studentsNeedingSupport,
  summariseConduct,
  summariseConductByClass,
  summariseDay,
} from '@/Edu-task/lib/studentStats';
import {
  canManageStudents,
  canRecordConduct,
  canRecordStudentAttendance,
} from '@/Edu-task/lib/permissions';
import { ConfirmModal } from '@/Edu-task/components/common/ConfirmModal';
import { RollCallPanel } from './RollCallPanel';

/**
 * Học sinh.
 *
 * Four views for four different jobs: taking the register (daily, by the
 * homeroom teacher), recording conduct (during any lesson, by any teacher),
 * the monthly thi đua roll-up (leadership), and the roster itself (the office).
 * Collapsing them into one screen would put the office's data-entry form in
 * front of a teacher who has ninety seconds between lessons.
 */

type SubView = 'roll' | 'conduct' | 'summary' | 'roster';

const inputClass =
  'w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20';

export function StudentsTab() {
  const {
    currentUser, activeRole, students, classes, studentAttendance, conduct,
    createStudent, updateStudent, deleteStudent, recordConduct, deleteConduct,
    showToast,
  } = useApp();

  const today = toDateString(new Date());
  const canManage = canManageStudents(currentUser, activeRole);
  const canRoll = canRecordStudentAttendance(currentUser, activeRole);
  const canConduct = canRecordConduct(currentUser, activeRole);

  const [subView, setSubView] = useState<SubView>(canRoll ? 'roll' : 'conduct');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [editing, setEditing] = useState<Student | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Student | null>(null);

  const activeClasses = useMemo(() => sortClasses(classes).filter(c => c.isActive), [classes]);
  const dayStats = useMemo(() => summariseDay(studentAttendance, today), [studentAttendance, today]);
  const monthConduct = useMemo(() => conductInMonth(conduct, month), [conduct, month]);
  const perStudent = useMemo(() => summariseConduct(monthConduct), [monthConduct]);
  const perClass = useMemo(() => summariseConductByClass(monthConduct), [monthConduct]);
  const supportList = useMemo(() => studentsNeedingSupport(students), [students]);

  const filteredStudents = useMemo(
    () =>
      students.filter(
        s =>
          (!classFilter || s.classId === classFilter) &&
          matchesSearch(search, s.fullName, s.code, s.className)
      ),
    [students, classFilter, search]
  );

  const tabs: Array<{ id: SubView; label: string; icon: typeof Users; show: boolean }> = [
    { id: 'roll', label: 'Điểm Danh', icon: ClipboardCheck, show: canRoll },
    { id: 'conduct', label: 'Vi Phạm & Khen Thưởng', icon: Award, show: canConduct },
    { id: 'summary', label: 'Tổng Hợp Tháng', icon: TriangleAlert, show: true },
    { id: 'roster', label: 'Hồ Sơ Học Sinh', icon: Users, show: true },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Học Sinh</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Điểm danh hằng ngày, ghi nhận vi phạm và khen thưởng, theo dõi học sinh cần hỗ trợ.
            </p>
          </div>
          {dayStats.classesRecorded > 0 && (
            <div className="px-3 py-2 rounded-2xl bg-sky-50 border border-sky-200 text-center">
              <div className="text-xl font-extrabold text-sky-900">
                {dayStats.presentRate === null ? '—' : `${dayStats.presentRate}%`}
              </div>
              <div className="text-[10px] font-semibold text-sky-700">
                đi học hôm nay · vắng {dayStats.absentCount}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {tabs.filter(t => t.show).map(tab => {
            const Icon = tab.icon;
            const isActive = subView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubView(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {subView === 'roll' && canRoll && <RollCallPanel />}

      {subView === 'conduct' && canConduct && (
        <ConductSection
          students={students}
          onSubmit={async data => {
            if (await recordConduct(data)) showToast('success', 'Đã ghi nhận.');
          }}
          records={conduct.slice(0, 40)}
          currentUserId={currentUser?.id}
          onDelete={async id => {
            if (await deleteConduct(id)) showToast('success', 'Đã xóa bản ghi.');
          }}
        />
      )}

      {subView === 'summary' && (
        <section className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">Tổng Hợp Nề Nếp Học Sinh</h3>
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {monthConduct.length} bản ghi trong tháng · điểm thi đua = khen thưởng trừ vi phạm.
            </p>
          </div>

          {perClass.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Thi Đua Giữa Các Lớp</h3>
              </div>
              <div className="p-4 space-y-2">
                {perClass.map(row => (
                  <div key={row.classId} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-800">{row.className}</span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-rose-700">{row.violationCount} vi phạm</span>
                      <span className="text-emerald-700">{row.commendationCount} khen</span>
                      <span className={`font-extrabold ${row.netPoints >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {row.netPoints > 0 ? '+' : ''}{row.netPoints}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {perStudent.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Theo Học Sinh</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Xếp theo điểm thi đua từ thấp lên — em cần quan tâm nhất ở trên cùng.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left font-bold text-slate-700">Học sinh</th>
                      <th className="p-3 text-left font-bold text-slate-700">Lớp</th>
                      <th className="p-3 text-center font-bold text-slate-700">Vi phạm</th>
                      <th className="p-3 text-center font-bold text-slate-700">Khen thưởng</th>
                      <th className="p-3 text-center font-bold text-slate-700">Điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perStudent.slice(0, 30).map(row => (
                      <tr key={row.studentId} className="border-t border-slate-100">
                        <td className="p-3 font-bold text-slate-800">{row.studentName}</td>
                        <td className="p-3 text-slate-500">{row.className}</td>
                        <td className="p-3 text-center text-rose-700">{row.violationCount || '—'}</td>
                        <td className="p-3 text-center text-emerald-700">{row.commendationCount || '—'}</td>
                        <td className={`p-3 text-center font-extrabold ${row.netPoints >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {row.netPoints > 0 ? '+' : ''}{row.netPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {supportList.length > 0 && (
            <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-amber-100 bg-amber-50/50">
                <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4" />
                  Học Sinh Cần Hỗ Trợ ({supportList.length})
                </h3>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Thông tin riêng tư — chỉ dùng cho việc hỗ trợ các em.
                </p>
              </div>
              <div className="p-4 space-y-2">
                {supportList.map(student => (
                  <div key={student.id} className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-800">{student.fullName}</span>
                      <span className="text-[10px] text-slate-500">{student.className}</span>
                    </div>
                    {student.supportNote && (
                      <p className="text-[11px] text-slate-600 mt-0.5">{student.supportNote}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {monthConduct.length === 0 && supportList.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
              <p className="text-xs text-slate-500">Tháng này chưa có bản ghi nào.</p>
            </div>
          )}
        </section>
      )}

      {subView === 'roster' && (
        <section className="space-y-3">
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm theo tên, mã học sinh…"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
                className="p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="">Tất cả lớp</option>
                {activeClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {canManage && (
                <button
                  type="button"
                  onClick={() => { setEditing(null); setIsFormOpen(true); }}
                  className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Thêm Học Sinh</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {filteredStudents.length} / {students.length} học sinh
              {!canManage && ' · chỉ văn thư và Ban Giám Hiệu được sửa hồ sơ'}
            </p>
          </div>

          {isFormOpen && canManage && (
            <StudentForm
              editing={editing}
              classes={activeClasses}
              onCancel={() => { setIsFormOpen(false); setEditing(null); }}
              onSubmit={async data => {
                const ok = editing
                  ? await updateStudent(editing.id, data)
                  : !!(await createStudent(data));
                if (ok) {
                  showToast('success', editing ? 'Đã cập nhật hồ sơ.' : 'Đã thêm học sinh.');
                  setIsFormOpen(false);
                  setEditing(null);
                }
              }}
            />
          )}

          {filteredStudents.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
              <p className="text-xs text-slate-500">
                {students.length === 0 ? 'Chưa có học sinh nào trong danh sách.' : 'Không tìm thấy học sinh phù hợp.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredStudents.map(student => (
                <div
                  key={student.id}
                  className={`p-3 rounded-2xl border ${
                    student.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{student.fullName}</span>
                        <span className="text-[10px] text-slate-500">{student.className}</span>
                        {student.needsSupport && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold">
                            Cần hỗ trợ
                          </span>
                        )}
                        {!student.isActive && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[9px] font-bold">
                            Đã nghỉ
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {student.code && `${student.code} · `}
                        {student.gender ? GENDER_LABELS[student.gender] : ''}
                        {student.parentPhone && ` · PH: ${student.parentPhone}`}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-0.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => { setEditing(student); setIsFormOpen(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                          aria-label={`Sửa ${student.fullName}`}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(student)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                          aria-label={`Xóa ${student.fullName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {pendingDelete && (
        <ConfirmModal
          isOpen
          title="Xóa hồ sơ học sinh?"
          message={`Hồ sơ "${pendingDelete.fullName}" sẽ bị xóa vĩnh viễn. Với học sinh đã chuyển trường hoặc ra trường, hãy bỏ tick "Đang học" thay vì xóa — cách đó giữ lại toàn bộ hồ sơ điểm danh và nề nếp.`}
          confirmText="Xóa hồ sơ"
          onConfirm={async () => {
            const target = pendingDelete;
            setPendingDelete(null);
            if (await deleteStudent(target.id)) showToast('success', 'Đã xóa hồ sơ học sinh.');
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

// --- Conduct ----------------------------------------------------------------

function ConductSection({
  students, records, currentUserId, onSubmit, onDelete,
}: {
  students: Student[];
  records: Array<import('@/Edu-task/types/student').ConductRecord>;
  currentUserId?: string;
  onSubmit: (data: {
    studentId: string; kind: ConductKind; category: ConductCategory;
    description: string; points: number; date: string;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const today = toDateString(new Date());
  const [kind, setKind] = useState<ConductKind>('VIOLATION');
  const [studentId, setStudentId] = useState('');
  const [category, setCategory] = useState<ConductCategory>('UNIFORM');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(1);
  const [date, setDate] = useState(today);

  // Categories follow the kind, so a violation can never be filed under
  // "Việc tốt" by leaving a stale selection behind.
  const categories = kind === 'VIOLATION' ? VIOLATION_CATEGORIES : COMMENDATION_CATEGORIES;

  const activeStudents = useMemo(
    () => students.filter(s => s.isActive).sort(
      (a, b) => a.className.localeCompare(b.className, 'vi', { numeric: true })
        || a.fullName.localeCompare(b.fullName, 'vi')
    ),
    [students]
  );

  return (
    <div className="space-y-3">
      <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Ghi Nhận Mới</h3>

        <div className="flex gap-1.5">
          {(['VIOLATION', 'COMMENDATION'] as ConductKind[]).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setKind(option);
                setCategory(option === 'VIOLATION' ? VIOLATION_CATEGORIES[0] : COMMENDATION_CATEGORIES[0]);
              }}
              className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                kind === option
                  ? `${CONDUCT_KIND_LABELS[option].bg} ${CONDUCT_KIND_LABELS[option].color}`
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {CONDUCT_KIND_LABELS[option].label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Học sinh *</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)} className={inputClass}>
              <option value="">— Chọn học sinh —</option>
              {activeStudents.map(s => (
                <option key={s.id} value={s.id}>{s.className} · {s.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Loại</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as ConductCategory)}
              className={inputClass}
            >
              {categories.map(c => (
                <option key={c} value={c}>{CONDUCT_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ngày xảy ra</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung *</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={kind === 'VIOLATION' ? 'Không mặc đồng phục thể dục' : 'Nhặt được của rơi trả lại'}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Điểm thi đua ({kind === 'VIOLATION' ? 'trừ' : 'cộng'})
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={points}
              onChange={e => setPoints(Math.max(0, Number(e.target.value) || 0))}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!studentId || !description.trim()}
            onClick={() => {
              onSubmit({ studentId, kind, category, description, points, date });
              setStudentId('');
              setDescription('');
            }}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-bold text-xs"
          >
            Ghi Nhận
          </button>
        </div>
      </section>

      <section className="space-y-2">
        {records.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
            <p className="text-xs text-slate-500">Chưa có bản ghi nào.</p>
          </div>
        ) : (
          records.map(record => {
            const config = CONDUCT_KIND_LABELS[record.kind];
            return (
              <article key={record.id} className={`p-3 rounded-2xl border ${config.bg}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{record.studentName}</span>
                      <span className="text-[10px] text-slate-500">{record.className}</span>
                      <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold ${config.bg} ${config.color}`}>
                        {config.label} {record.points > 0 && `${record.kind === 'VIOLATION' ? '−' : '+'}${record.points}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 mt-0.5">
                      {CONDUCT_CATEGORY_LABELS[record.category]} — {record.description}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {formatDateVi(record.date)} · {record.recordedByName}
                    </p>
                  </div>
                  {record.recordedById === currentUserId && (
                    <button
                      type="button"
                      onClick={() => onDelete(record.id)}
                      className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400 hover:text-rose-600 flex-shrink-0"
                      aria-label="Xóa bản ghi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

// --- Roster form ------------------------------------------------------------

function StudentForm({
  editing, classes, onCancel, onSubmit,
}: {
  editing: Student | null;
  classes: Array<{ id: string; name: string }>;
  onCancel: () => void;
  onSubmit: (data: {
    code: string; fullName: string; classId: string;
    dateOfBirth?: string; gender?: Gender;
    parentName?: string; parentPhone?: string;
    needsSupport: boolean; supportNote?: string; isActive: boolean;
  }) => void;
}) {
  const [code, setCode] = useState(editing?.code ?? '');
  const [fullName, setFullName] = useState(editing?.fullName ?? '');
  const [classId, setClassId] = useState(editing?.classId ?? classes[0]?.id ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(editing?.dateOfBirth ?? '');
  const [gender, setGender] = useState<Gender | ''>(editing?.gender ?? '');
  const [parentName, setParentName] = useState(editing?.parentName ?? '');
  const [parentPhone, setParentPhone] = useState(editing?.parentPhone ?? '');
  const [needsSupport, setNeedsSupport] = useState(editing?.needsSupport ?? false);
  const [supportNote, setSupportNote] = useState(editing?.supportNote ?? '');
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
      <h3 className="text-sm font-bold text-slate-900">
        {editing ? 'Sửa Hồ Sơ Học Sinh' : 'Thêm Học Sinh'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên *</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Mã học sinh</label>
          <input value={code} onChange={e => setCode(e.target.value)} className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Lớp *</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} className={inputClass}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Giới tính</label>
          <select value={gender} onChange={e => setGender(e.target.value as Gender | '')} className={inputClass}>
            <option value="">— Không ghi —</option>
            {(Object.keys(GENDER_LABELS) as Gender[]).map(g => (
              <option key={g} value={g}>{GENDER_LABELS[g]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Ngày sinh</label>
          <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <p className="text-[11px] text-slate-600">
          <strong>Liên hệ phụ huynh</strong> — chỉ dùng khi cần liên lạc về học sinh.
          Mọi cán bộ, giáo viên đều xem được, nên chỉ nhập thông tin thật sự cần thiết.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Họ tên phụ huynh</label>
            <input value={parentName} onChange={e => setParentName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
            <input value={parentPhone} onChange={e => setParentPhone(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={needsSupport}
          onChange={e => setNeedsSupport(e.target.checked)}
          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 mt-0.5"
        />
        <span className="text-xs text-slate-700">
          <strong>Học sinh cần hỗ trợ</strong>
          <span className="block text-[11px] text-slate-500">
            Hoàn cảnh, sức khoẻ, học lực… Ghi vừa đủ để người phụ trách biết cách giúp,
            tránh ghi những điều có thể theo em suốt các năm học.
          </span>
        </span>
      </label>

      {needsSupport && (
        <textarea
          value={supportNote}
          onChange={e => setSupportNote(e.target.value)}
          rows={2}
          placeholder="Ghi chú hỗ trợ"
          className={inputClass}
        />
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={e => setIsActive(e.target.checked)}
          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
        />
        <span className="text-xs font-bold text-slate-700">Đang học tại trường</span>
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5">
          <X className="w-4 h-4" /> Hủy
        </button>
        <button
          type="button"
          disabled={!fullName.trim() || !classId}
          onClick={() => onSubmit({
            code, fullName, classId,
            dateOfBirth: dateOfBirth || undefined,
            gender: gender || undefined,
            parentName, parentPhone,
            needsSupport, supportNote, isActive,
          })}
          className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-bold text-xs"
        >
          {editing ? 'Lưu Thay Đổi' : 'Thêm Học Sinh'}
        </button>
      </div>
    </div>
  );
}
