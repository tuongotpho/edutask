'use client';

import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Edit2,
  Filter,
  PlusCircle,
  RotateCcw,
  Search,
  Trash2,
  User,
  UserCheck,
  X,
  AlertCircle,
  MapPin,
  FileText
} from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  GiftedLesson,
  GiftedProgram,
  GiftedProgramStatus,
  GIFTED_PROGRAM_STATUS_LABELS,
  GIFTED_LESSON_STATUS_LABELS
} from '@/Edu-task/types/gifted';
import { formatDateVi, toDateString } from '@/Edu-task/lib/schedule';
import { canManageGifted } from '@/Edu-task/lib/permissions';
import { GiftedProgramModal } from './GiftedProgramModal';
import { GiftedLessonModal } from './GiftedLessonModal';

const inputClass =
  'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200';

export function GiftedTab() {
  const {
    currentUser,
    activeRole,
    giftedPrograms,
    users,
    createGiftedProgram,
    updateGiftedProgram,
    setGiftedProgramStatus,
    deleteGiftedProgram,
    addGiftedLesson,
    updateGiftedLesson,
    removeGiftedLesson,
    completeGiftedLesson,
    reopenGiftedLesson,
    showToast,
  } = useApp();

  const canManage = canManageGifted(currentUser, activeRole);

  // Selected Program ID for detail view
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [onlyMyLessonsFilter, setOnlyMyLessonsFilter] = useState<boolean>(false);

  // Program Form Modal State
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<GiftedProgram | null>(null);
  const [programForm, setProgramForm] = useState({
    title: '',
    subject: 'Toán',
    grade: 'Khối 9',
    description: '',
    coordinatorId: currentUser?.id || '',
    startDate: toDateString(new Date()),
    endDate: toDateString(new Date(Date.now() + 90 * 86400000)),
    status: 'IN_PROGRESS' as GiftedProgramStatus,
  });

  // Lesson Form Modal State
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<GiftedLesson | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: '',
    teacherId: currentUser?.id || '',
    scheduledDate: toDateString(new Date()),
    durationPeriods: 2,
    roomName: '',
    description: '',
  });

  // Completion Note Modal State
  const [completingLessonId, setCompletingLessonId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  // Selected program object
  const selectedProgram = useMemo(
    () => giftedPrograms.find(p => p.id === selectedProgramId) || null,
    [giftedPrograms, selectedProgramId]
  );

  // Filtered Programs list
  const filteredPrograms = useMemo(() => {
    return giftedPrograms.filter(p => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesSubject = p.subject.toLowerCase().includes(q);
        const matchesCoordinator = p.coordinatorName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSubject && !matchesCoordinator) return false;
      }
      if (subjectFilter !== 'ALL' && p.subject !== subjectFilter) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (onlyMyLessonsFilter) {
        const teachesInProgram = p.lessons.some(l => l.teacherId === currentUser?.id);
        const coordinatesProgram = p.coordinatorId === currentUser?.id;
        if (!teachesInProgram && !coordinatesProgram) return false;
      }
      return true;
    });
  }, [giftedPrograms, searchQuery, subjectFilter, statusFilter, onlyMyLessonsFilter, currentUser]);

  // Unique Subjects for Filter Dropdown
  const subjectsList = useMemo(() => {
    const set = new Set<string>();
    giftedPrograms.forEach(p => { if (p.subject) set.add(p.subject); });
    return Array.from(set);
  }, [giftedPrograms]);

  // Handle Program Creation/Editing
  const handleOpenNewProgram = () => {
    setEditingProgram(null);
    setProgramForm({
      title: '',
      subject: 'Toán',
      grade: 'Khối 9',
      description: '',
      coordinatorId: currentUser?.id || '',
      startDate: toDateString(new Date()),
      endDate: toDateString(new Date(Date.now() + 90 * 86400000)),
      status: 'IN_PROGRESS',
    });
    setIsProgramModalOpen(true);
  };

  const handleOpenEditProgram = (prog: GiftedProgram) => {
    setEditingProgram(prog);
    setProgramForm({
      title: prog.title,
      subject: prog.subject,
      grade: prog.grade || '',
      description: prog.description || '',
      coordinatorId: prog.coordinatorId,
      startDate: prog.startDate,
      endDate: prog.endDate,
      status: prog.status,
    });
    setIsProgramModalOpen(true);
  };

  const handleSubmitProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programForm.title.trim()) {
      showToast('error', 'Vui lòng nhập tên chương trình bồi dưỡng.');
      return;
    }

    if (editingProgram) {
      const ok = await updateGiftedProgram(editingProgram.id, programForm);
      if (ok) setIsProgramModalOpen(false);
    } else {
      const created = await createGiftedProgram(programForm);
      if (created) {
        setIsProgramModalOpen(false);
        setSelectedProgramId(created.id);
      }
    }
  };

  // Handle Lesson Creation/Editing
  const handleOpenNewLesson = () => {
    setEditingLesson(null);
    setLessonForm({
      title: '',
      teacherId: currentUser?.id || '',
      scheduledDate: toDateString(new Date()),
      durationPeriods: 2,
      roomName: '',
      description: '',
    });
    setIsLessonModalOpen(true);
  };

  const handleOpenEditLesson = (lesson: GiftedLesson) => {
    setEditingLesson(lesson);
    setLessonForm({
      title: lesson.title,
      teacherId: lesson.teacherId,
      scheduledDate: lesson.scheduledDate || toDateString(new Date()),
      durationPeriods: lesson.durationPeriods || 1,
      roomName: lesson.roomName || '',
      description: lesson.description || '',
    });
    setIsLessonModalOpen(true);
  };

  const handleSubmitLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) return;

    if (!lessonForm.title.trim()) {
      showToast('error', 'Vui lòng nhập tên tiết/chuyên đề.');
      return;
    }

    if (editingLesson) {
      const ok = await updateGiftedLesson(selectedProgram.id, editingLesson.id, lessonForm);
      if (ok) setIsLessonModalOpen(false);
    } else {
      const ok = await addGiftedLesson(selectedProgram.id, lessonForm);
      if (ok) setIsLessonModalOpen(false);
    }
  };

  // Complete lesson workflow
  const handleStartCompleteLesson = (lessonId: string) => {
    setCompletingLessonId(lessonId);
    setCompletionNote('');
  };

  const handleConfirmCompleteLesson = async () => {
    if (!selectedProgram || !completingLessonId) return;
    const ok = await completeGiftedLesson(selectedProgram.id, completingLessonId, completionNote);
    if (ok) {
      setCompletingLessonId(null);
      setCompletionNote('');
    }
  };

  // Stats calculation
  const overallStats = useMemo(() => {
    let totalPrograms = giftedPrograms.length;
    let totalLessons = 0;
    let completedLessons = 0;
    giftedPrograms.forEach(p => {
      totalLessons += p.lessons.length;
      completedLessons += p.lessons.filter(l => l.status === 'COMPLETED').length;
    });
    const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    return { totalPrograms, totalLessons, completedLessons, percent };
  }, [giftedPrograms]);

  return (
    <div className="space-y-8 pb-12">
      {/* Standard Header Card */}
      <div className="bg-white rounded-[5px] border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              Bồi Dưỡng Học Sinh Giỏi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý các chuyên đề bồi dưỡng đội tuyển HSG, phân công giảng dạy chi tiết và theo dõi tiến độ hoàn thành.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {overallStats.totalLessons > 0 && (
              <div className="px-3 py-1.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
                <div className="text-xs font-extrabold text-indigo-900">
                  {overallStats.completedLessons}/{overallStats.totalLessons} bài hoàn thành
                </div>
                <div className="text-[10px] text-indigo-600 font-semibold">
                  Tiến độ chung: {overallStats.percent}%
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleOpenNewProgram}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5 transition-all"
            >
              <PlusCircle className="w-4 h-4 text-indigo-400" />
              <span>Tạo Chương Trình</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View: List or Program Detail */}
      {selectedProgram ? (
        /* PROGRAM DETAIL VIEW */
        <div className="space-y-6">
          {/* Back Navigation Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedProgramId(null)}
              className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Quay lại danh sách chương trình</span>
            </button>

            {(() => {
              const isCoordinator = selectedProgram.coordinatorId === currentUser?.id;
              const canManageProgram = canManage || isCoordinator;
              if (!canManageProgram) return null;
              
              return (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenEditProgram(selectedProgram)}
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Chỉnh sửa thông tin</span>
                  </button>

                  <button
                    onClick={async () => {
                      if (confirm(`Bạn có chắc chắn muốn xóa chương trình "${selectedProgram.title}"?`)) {
                        const ok = await deleteGiftedProgram(selectedProgram.id);
                        if (ok) setSelectedProgramId(null);
                      }
                    }}
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-xl border border-rose-200 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Program Header Card */}
          <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                    {selectedProgram.subject}
                  </span>
                  {selectedProgram.grade && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {selectedProgram.grade}
                    </span>
                  )}
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${GIFTED_PROGRAM_STATUS_LABELS[selectedProgram.status].bg} ${GIFTED_PROGRAM_STATUS_LABELS[selectedProgram.status].color}`}>
                    {GIFTED_PROGRAM_STATUS_LABELS[selectedProgram.status].label}
                  </span>
                </div>
                <h1 className="text-xl font-extrabold text-slate-900">{selectedProgram.title}</h1>
                {selectedProgram.description && (
                  <p className="text-xs text-slate-600 max-w-2xl">{selectedProgram.description}</p>
                )}
              </div>

              {/* Progress Donut/Bar Card */}
              {(() => {
                const total = selectedProgram.lessons.length;
                const completed = selectedProgram.lessons.filter(l => l.status === 'COMPLETED').length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-[5px] p-4 min-w-[220px]">
                    <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                      <span className="text-slate-700">Tiến độ thực hiện</span>
                      <span className="text-indigo-600">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2 text-[11px] text-slate-500">
                      <span>Hoàn thành: <strong>{completed}</strong> tiết</span>
                      <span>Tổng: <strong>{total}</strong> tiết</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center space-x-2 text-slate-600">
                <UserCheck className="w-4 h-4 text-indigo-500" />
                <span>Phụ trách chính: <strong className="text-slate-800">{selectedProgram.coordinatorName}</strong></span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <Calendar className="w-4 h-4 text-amber-500" />
                <span>Thời gian: <strong className="text-slate-800">{formatDateVi(selectedProgram.startDate)} - {formatDateVi(selectedProgram.endDate)}</strong></span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <BookOpen className="w-4 h-4 text-emerald-500" />
                <span>Tổ chuyên môn: <strong className="text-slate-800">{selectedProgram.departmentName || 'Nhà trường'}</strong></span>
              </div>
            </div>
          </div>

          {/* Lessons Table Section */}
          <div className="bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Danh Sách Tiết Học / Chuyên Đề</h3>
                <p className="text-xs text-slate-500">Phân công người dạy và theo dõi tiến độ hoàn thành từng chuyên đề</p>
              </div>

              {(canManage || selectedProgram.coordinatorId === currentUser?.id) && (
                <button
                  onClick={handleOpenNewLesson}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl inline-flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Thêm Tiết / Chuyên Đề</span>
                </button>
              )}
            </div>

            {selectedProgram.lessons.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-[5px] border border-dashed border-slate-200">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Chưa có tiết/chuyên đề nào trong chương trình này</p>
                <p className="text-xs text-slate-400 mt-1">Bấm "Thêm Tiết / Chuyên Đề" ở trên để phân công danh sách tiết học</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[5px] border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-3 px-4 w-12 text-center">STT</th>
                      <th className="py-3 px-4">Tên Tiết / Chuyên Đề</th>
                      <th className="py-3 px-4">Giáo Viên Phụ Trách</th>
                      <th className="py-3 px-4">Ngày Học Dự Kiến</th>
                      <th className="py-3 px-4">Địa Điểm</th>
                      <th className="py-3 px-4 text-center">Trạng Thái</th>
                      <th className="py-3 px-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedProgram.lessons.map((lesson) => {
                      const isCompleted = lesson.status === 'COMPLETED';
                      const isMyLesson = lesson.teacherId === currentUser?.id;
                      const isCoordinator = selectedProgram.coordinatorId === currentUser?.id;
                      const canManageProgram = canManage || isCoordinator;
                      const canCompleteLesson = isMyLesson || canManageProgram;

                      return (
                        <tr
                          key={lesson.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isCompleted ? 'bg-emerald-50/30 text-slate-600' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center font-extrabold text-slate-400">
                            {lesson.order}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{lesson.title}</div>
                            {lesson.description && (
                              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{lesson.description}</div>
                            )}
                            {lesson.note && (
                              <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 mt-1">
                                💬 <strong>Ghi chú hoàn thành:</strong> {lesson.note}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{lesson.teacherName}</span>
                            </div>
                            {isMyLesson && (
                              <span className="inline-block mt-0.5 text-[9px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                Tiết của bạn
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {lesson.scheduledDate ? (
                              <div className="flex items-center space-x-1 text-slate-700">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{formatDateVi(lesson.scheduledDate)}</span>
                                {lesson.durationPeriods ? (
                                  <span className="text-[10px] text-slate-400">({lesson.durationPeriods} tiết)</span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Chưa xếp ngày</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {lesson.roomName ? (
                              <div className="flex items-center space-x-1 text-slate-700">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{lesson.roomName}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {isCompleted ? (
                              <div>
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Đã xong</span>
                                </span>
                                {lesson.completedAt && (
                                  <div className="text-[9px] text-slate-400 mt-0.5" title={`Xác nhận bởi ${lesson.completedByUserName || 'N/A'}`}>
                                    {lesson.completedAt.slice(0, 16)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Chưa dạy</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1">
                            {!isCompleted ? (
                              canCompleteLesson && (
                                <button
                                  onClick={() => handleStartCompleteLesson(lesson.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 inline-flex items-center space-x-1 text-[11px]"
                                  title="Bấm để hoàn thành tiết dạy này"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Hoàn thành</span>
                                </button>
                              )
                            ) : (
                              canCompleteLesson && (
                                <button
                                  onClick={() => reopenGiftedLesson(selectedProgram.id, lesson.id)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2 py-1 rounded-lg transition-all text-[10px] inline-flex items-center space-x-1"
                                  title="Đánh dấu chưa học"
                                >
                                  <RotateCcw className="w-3 h-3 text-slate-500" />
                                  <span>Mở lại</span>
                                </button>
                              )
                            )}

                            {canManageProgram && (
                              <>
                                <button
                                  onClick={() => handleOpenEditLesson(lesson)}
                                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
                                  title="Sửa thông tin tiết học"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    if (confirm(`Bạn có muốn xóa tiết "${lesson.title}" khỏi danh sách?`)) {
                                      removeGiftedLesson(selectedProgram.id, lesson.id);
                                    }
                                  }}
                                  className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                                  title="Xóa tiết học"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* PROGRAM LIST VIEW */
        <div className="space-y-6">
          {/* Filters & Control Bar */}
          <div className="bg-white rounded-[5px] border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Search Bar */}
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên chương trình, môn học, giáo viên phụ trách..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`${inputClass} pl-9`}
                />
              </div>

              {/* Subject Filter */}
              <div>
                <select
                  value={subjectFilter}
                  onChange={e => setSubjectFilter(e.target.value)}
                  className={inputClass}
                >
                  <option value="ALL">Tất cả môn học</option>
                  {subjectsList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="Toán">Toán</option>
                  <option value="Vật lý">Vật lý</option>
                  <option value="Hóa học">Hóa học</option>
                  <option value="Sinh học">Sinh học</option>
                  <option value="Tin học">Tin học</option>
                  <option value="Ngữ văn">Ngữ văn</option>
                  <option value="Tiếng Anh">Tiếng Anh</option>
                  <option value="Lịch sử">Lịch sử</option>
                  <option value="Địa lý">Địa lý</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className={inputClass}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="IN_PROGRESS">Đang triển khai</option>
                  <option value="COMPLETED">Hoàn thành</option>
                  <option value="DRAFT">Dự thảo</option>
                  <option value="ARCHIVED">Lưu trữ</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyMyLessonsFilter}
                  onChange={e => setOnlyMyLessonsFilter(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Chỉ hiển thị chương trình có tôi tham gia dạy / phụ trách</span>
              </label>

              <div className="text-xs text-slate-500">
                Hiển thị <strong>{filteredPrograms.length}</strong> / <strong>{giftedPrograms.length}</strong> chương trình
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredPrograms.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[5px] border border-slate-200 p-8 shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 -z-10"></div>
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Award className="w-10 h-10 text-blue-500" />
              </div>
              <h3 className="text-lg font-black text-slate-800">Không tìm thấy chương trình bồi dưỡng nào</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                Thử thay đổi bộ lọc tìm kiếm hoặc nhấn vào nút bên dưới để tạo mới chương trình bồi dưỡng.
              </p>
              <button
                onClick={handleOpenNewProgram}
                className="mt-6 inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-[0_8px_20px_rgba(37,99,235,0.3)] transition-all hover:-translate-y-1 active:scale-95"
              >
                <PlusCircle className="w-5 h-5" />
                <span>Tạo Chương Trình Mới</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredPrograms.map((program) => {
                const totalLessons = program.lessons.length;
                const completedLessons = program.lessons.filter(l => l.status === 'COMPLETED').length;
                const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
                const myPendingLessonsInProgram = program.lessons.filter(l => l.teacherId === currentUser?.id && l.status === 'PENDING').length;

                return (
                  <div
                    key={program.id}
                    onClick={() => setSelectedProgramId(program.id)}
                    className="relative bg-white rounded-[5px] border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-5 group overflow-hidden"
                  >
                    {/* Decorative Background Blob */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                            {program.subject}
                          </span>
                          {program.grade && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {program.grade}
                            </span>
                          )}
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${GIFTED_PROGRAM_STATUS_LABELS[program.status].bg} ${GIFTED_PROGRAM_STATUS_LABELS[program.status].color}`}>
                          {GIFTED_PROGRAM_STATUS_LABELS[program.status].label}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {program.title}
                      </h3>

                      {program.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">{program.description}</p>
                      )}
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      {/* Coordinator & Period */}
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <div className="flex items-center space-x-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>Phụ trách: <strong>{program.coordinatorName}</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatDateVi(program.startDate)} - {formatDateVi(program.endDate)}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Tiến độ bài dạy</span>
                          <span className="font-black text-blue-600">{completedLessons}/{totalLessons} <span className="font-medium text-slate-400">({progressPct}%)</span></span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-1000 ease-out relative"
                            style={{ width: `${progressPct}%` }}
                          >
                            <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-l from-white/40 to-transparent"></div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Footer Tags */}
                      <div className="flex items-center justify-between pt-1">
                        {myPendingLessonsInProgram > 0 ? (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            ⚠️ Bạn còn {myPendingLessonsInProgram} tiết chưa dạy
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400">
                            {totalLessons === 0 ? 'Chưa có lịch tiết dạy' : 'Tất cả tiết dạy ổn định'}
                          </span>
                        )}

                        <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform inline-flex items-center">
                          Xem tiết dạy →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Create/Edit Program */}
      <GiftedProgramModal
        isOpen={isProgramModalOpen}
        editingProgram={editingProgram}
        programForm={programForm}
        users={users}
        onClose={() => setIsProgramModalOpen(false)}
        onChangeForm={setProgramForm}
        onSubmit={handleSubmitProgram}
      />

      {/* MODAL 2: Add/Edit Lesson */}
      <GiftedLessonModal
        isOpen={isLessonModalOpen}
        editingLesson={editingLesson}
        lessonForm={lessonForm}
        users={users}
        onClose={() => setIsLessonModalOpen(false)}
        onChangeForm={setLessonForm}
        onSubmit={handleSubmitLesson}
      />

      {/* MODAL 3: Confirm Complete Lesson with Note */}
      {completingLessonId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[5px] max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-2 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="text-base font-extrabold text-slate-900">Xác Nhận Hoàn Thành Tiết Dạy</h3>
            </div>

            <p className="text-xs text-slate-600">
              Bạn có chắc chắn muốn xác nhận đã hoàn thành giảng dạy tiết/chuyên đề này?
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú / Nhận xét tiết học (Không bắt buộc)</label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Học sinh nắm bài tốt, hoàn thành 10 bài tập chuyên đề..."
                value={completionNote}
                onChange={e => setCompletionNote(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCompletingLessonId(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmCompleteLesson}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-xs inline-flex items-center space-x-1"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Hoàn Thành</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
