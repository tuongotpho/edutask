'use client';

import React, { useMemo, useState } from 'react';
import { EyeOff, Eye, Radio, Users, Briefcase, BookOpen, GraduationCap, Building2, Settings2, ArrowRight } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  METRIC_GROUP_LABELS,
  METRIC_GROUP_ORDER,
  MetricDefinition,
  MetricGroup,
  MetricOutcome,
  MetricTone,
} from '@/Edu-task/types/dashboard';
import {
  METRIC_DEFINITIONS,
  buildMetricContext,
  metricCoverage,
  resolveMetric,
} from '@/Edu-task/lib/dashboardMetrics';
import { formatDateVi, toDateString, weekdayLabel } from '@/Edu-task/lib/schedule';
import { TabType } from '@/Edu-task/components/layout/Sidebar';
import { TAB_SLUGS } from '@/Edu-task/lib/tabRouting';

/**
 * The principal's operations screen.
 *
 * Every tile is rendered from the registry in `lib/dashboardMetrics.ts` — this
 * component knows how to draw a metric, never which metrics exist. Adding an
 * indicator is a registry entry, not a change here.
 *
 * Indicators whose module has not been built are shown, greyed, with the reason
 * they are empty. That is the deliberate choice: the alternative is either
 * hiding them (so the roadmap is invisible and the screen looks finished when
 * it is not) or filling them with zeros (so a placeholder is indistinguishable
 * from a measurement). A principal must never have to wonder which of the two
 * they are looking at.
 */

const TONE_STYLES: Record<MetricTone, {
  dot: string; value: string; card: string; glow: string;
  accent: string; hoverBg: string; hoverArrow: string;
}> = {
  CRITICAL: {
    dot: 'bg-rose-500', value: 'text-rose-700',
    card: 'bg-gradient-to-br from-rose-50/80 to-red-50/60 border-rose-200',
    glow: 'group-hover:shadow-rose-100/60',
    accent: 'bg-gradient-to-r from-rose-400 to-red-400',
    hoverBg: 'bg-rose-50', hoverArrow: 'group-hover:text-rose-500',
  },
  WARNING: {
    dot: 'bg-amber-500', value: 'text-amber-700',
    card: 'bg-gradient-to-br from-amber-50/80 to-orange-50/60 border-amber-200',
    glow: 'group-hover:shadow-amber-100/60',
    accent: 'bg-gradient-to-r from-amber-400 to-orange-400',
    hoverBg: 'bg-amber-50', hoverArrow: 'group-hover:text-amber-500',
  },
  INFO: {
    dot: 'bg-sky-500', value: 'text-sky-700',
    card: 'bg-gradient-to-br from-sky-50/80 to-blue-50/60 border-sky-200',
    glow: 'group-hover:shadow-sky-100/60',
    accent: 'bg-gradient-to-r from-sky-400 to-blue-400',
    hoverBg: 'bg-sky-50', hoverArrow: 'group-hover:text-sky-500',
  },
  GOOD: {
    dot: 'bg-emerald-500', value: 'text-emerald-700',
    card: 'bg-gradient-to-br from-emerald-50/80 to-green-50/60 border-emerald-200',
    glow: 'group-hover:shadow-emerald-100/60',
    accent: 'bg-gradient-to-r from-emerald-400 to-green-400',
    hoverBg: 'bg-emerald-50', hoverArrow: 'group-hover:text-emerald-500',
  },
  NEUTRAL: {
    dot: 'bg-slate-400', value: 'text-slate-700',
    card: 'bg-gradient-to-br from-slate-50 to-gray-50/60 border-slate-200',
    glow: 'group-hover:shadow-slate-100/60',
    accent: 'bg-gradient-to-r from-slate-300 to-gray-300',
    hoverBg: 'bg-slate-50', hoverArrow: 'group-hover:text-slate-500',
  },
};

/** Icon for each metric group section header. */
const GROUP_ICONS: Record<MetricGroup, React.ElementType> = {
  STAFF: Users,
  WORK: Briefcase,
  PROFESSIONAL: BookOpen,
  STUDENT: GraduationCap,
  FACILITY: Building2,
  OPERATION: Settings2,
};

interface MissionControlProps {
  onNavigate?: (tab: TabType) => void;
}

export function MissionControl({ onNavigate }: MissionControlProps) {
  const {
    schoolName, users, leaves, tasks,
    attendance, bookings, makeups, meetings, plans, rooms, equipment, loans,
    classes, students, studentAttendance, conduct,
  } = useApp();

  const [showPlanned, setShowPlanned] = useState(false);

  const today = toDateString(new Date());

  const context = useMemo(
    () => buildMetricContext({
      users, leaves, tasks, attendance, bookings, makeups, meetings, plans, rooms, equipment, loans,
      classes, students, studentAttendance, conduct,
    }),
    [
      users, leaves, tasks, attendance, bookings, makeups, meetings, plans, rooms, equipment, loans,
      classes, students, studentAttendance, conduct,
    ]
  );

  const resolved = useMemo(
    () => METRIC_DEFINITIONS.map(definition => ({ definition, outcome: resolveMetric(definition, context) })),
    [context]
  );

  const coverage = metricCoverage();

  // Anything red or amber, surfaced above the fold: the point of the screen is
  // to answer "is anything wrong" without scrolling six groups.
  const alerts = resolved.filter(
    ({ outcome }) => outcome.state === 'READY' && (outcome.tone === 'CRITICAL' || outcome.tone === 'WARNING')
  );

  return (
    <div className="space-y-5">
      <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 shadow-xl text-white overflow-hidden">
        {/* Decorative ambient orbs */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              <span className="relative">
                <Radio className="w-5 h-5 text-indigo-400" />
                {/* Animated live indicator */}
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                </span>
              </span>
              Màn Hình Điều Hành
            </h2>
            <p className="text-xs text-slate-300/80 mt-1">
              {schoolName} · {weekdayLabel(today)} {formatDateVi(today)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold flex items-center justify-end gap-2">
              {alerts.length === 0
                ? <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    Ổn định
                  </>
                : <>
                    <span className="relative flex-shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 block" />
                      <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping opacity-75" />
                    </span>
                    {alerts.length} mục cần lưu ý
                  </>
              }
            </div>
            <p className="text-[11px] text-slate-400">
              {coverage.ready}/{coverage.total} chỉ số đã có dữ liệu
            </p>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="relative z-10 mt-4 flex flex-wrap gap-2">
            {alerts.map(({ definition, outcome }) => (
              <button
                key={definition.key}
                type="button"
                onClick={() => definition.linkTab && onNavigate?.(slugToTab(definition.linkTab))}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all duration-200 ${
                  definition.linkTab ? 'hover:opacity-80 hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'
                } ${
                  outcome.state === 'READY' && outcome.tone === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 backdrop-blur-sm'
                    : 'bg-amber-500/20 text-amber-100 border border-amber-500/40 backdrop-blur-sm'
                }`}
              >
                <span className="relative">
                  <span className={`w-1.5 h-1.5 rounded-full block ${
                    outcome.state === 'READY' && outcome.tone === 'CRITICAL' ? 'bg-rose-400' : 'bg-amber-400'
                  }`} />
                  <span className={`absolute inset-0 w-1.5 h-1.5 rounded-full animate-ping opacity-60 ${
                    outcome.state === 'READY' && outcome.tone === 'CRITICAL' ? 'bg-rose-400' : 'bg-amber-400'
                  }`} />
                </span>
                {definition.label}: {outcome.state === 'READY' ? formatValue(outcome) : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowPlanned(!showPlanned)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all duration-200 hover:shadow-sm"
        >
          {showPlanned ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span>
            {showPlanned ? 'Ẩn chỉ số chưa có dữ liệu' : `Hiện ${coverage.total - coverage.ready} chỉ số đang xây dựng`}
          </span>
        </button>
      </div>

      {METRIC_GROUP_ORDER.map(group => {
        const inGroup = resolved.filter(({ definition }) => definition.group === group);
        const visible = showPlanned
          ? inGroup
          : inGroup.filter(({ outcome }) => outcome.state !== 'NOT_AVAILABLE');
        if (visible.length === 0) return null;

        const GroupIcon = GROUP_ICONS[group];

        return (
          <section key={group} className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <GroupIcon className="w-3.5 h-3.5 text-slate-400" />
              {METRIC_GROUP_LABELS[group]}
              <span className="text-[10px] font-semibold text-slate-400 normal-case tracking-normal">
                ({visible.length} chỉ số)
              </span>
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {visible.map(({ definition, outcome }) => (
                <MetricTile
                  key={definition.key}
                  definition={definition}
                  outcome={outcome}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function formatValue(outcome: Extract<MetricOutcome, { state: 'READY' }>): string {
  return outcome.unit === 'PERCENT' ? `${outcome.value}%` : String(outcome.value);
}

/** Tab slugs are what metric definitions carry; the sidebar speaks TabType. */
function slugToTab(slug: string): TabType {
  const entry = Object.entries(TAB_SLUGS).find(([, value]) => value === slug);
  return (entry?.[0] as TabType) ?? (slug as TabType);
}

function MetricTile({
  definition, outcome, onNavigate,
}: {
  definition: MetricDefinition;
  outcome: MetricOutcome;
  onNavigate?: (tab: TabType) => void;
}) {
  const clickable = !!definition.linkTab && outcome.state !== 'NOT_AVAILABLE';

  if (outcome.state === 'NOT_AVAILABLE') {
    return (
      <div className="relative p-4 rounded-2xl border border-dashed border-slate-300 bg-white overflow-hidden">
        {/* Subtle diagonal stripe pattern for "under construction" */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)',
        }} />
        <div className="relative">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Đang xây dựng</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-300 mt-2">—</div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">{definition.label}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{outcome.note}</div>
        </div>
      </div>
    );
  }

  if (outcome.state === 'EMPTY') {
    const isRealZero = outcome.zeroIsMeaningful === true;
    return (
      <Wrapper clickable={clickable} definition={definition} onNavigate={onNavigate}
        className="group relative p-4 rounded-2xl border border-slate-200 bg-white text-left w-full transition-all duration-300 overflow-hidden hover:shadow-lg hover:shadow-slate-100/60 hover:-translate-y-0.5">
        {/* Accent bar — green for real zero, grey otherwise */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] ${isRealZero ? 'bg-gradient-to-r from-emerald-400 to-green-400' : 'bg-slate-200'}`} />
        <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isRealZero ? 'bg-emerald-400' : 'bg-slate-300'}`} />
            {isRealZero && <span className="text-[9px] font-bold text-emerald-600 uppercase">Tốt</span>}
          </div>
          <div className={`text-2xl font-extrabold mt-2 ${isRealZero ? 'text-emerald-600' : 'text-slate-400'}`}>{isRealZero ? '0' : '—'}</div>
          <div className="text-[11px] font-semibold text-slate-700 mt-1">{definition.label}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{outcome.note}</div>
        </div>
      </Wrapper>
    );
  }

  const style = TONE_STYLES[outcome.tone];
  const isUrgent = outcome.tone === 'CRITICAL' || outcome.tone === 'WARNING';

  return (
    <Wrapper clickable={clickable} definition={definition} onNavigate={onNavigate}
      className={`group relative p-4 rounded-2xl border text-left w-full transition-all duration-300 overflow-hidden ${style.card} ${
        clickable ? `hover:shadow-xl ${style.glow} hover:-translate-y-1` : ''
      }`}>
      {/* Accent bar matching tone */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${style.accent}`} />
      {/* Decorative hover shape */}
      <div className={`absolute -bottom-6 -right-6 w-20 h-20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${style.hoverBg}`} />

      <div className="relative">
        <div className="flex items-center gap-1.5">
          {isUrgent ? (
            <span className="relative">
              <span className={`w-2 h-2 rounded-full block ${style.dot}`} />
              <span className={`absolute inset-0 w-2 h-2 rounded-full ${style.dot} animate-ping opacity-60`} />
            </span>
          ) : (
            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
          )}
          {isUrgent && (
            <span className={`text-[9px] font-bold uppercase ${
              outcome.tone === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'
            }`}>
              {outcome.tone === 'CRITICAL' ? 'Cần xử lý' : 'Lưu ý'}
            </span>
          )}
        </div>
        <div className={`text-2xl font-extrabold mt-2 tracking-tight ${style.value}`}>{formatValue(outcome)}</div>
        <div className="text-[11px] font-semibold text-slate-800 mt-1">{definition.label}</div>
        {outcome.detail && <div className="text-[10px] text-slate-500 mt-0.5">{outcome.detail}</div>}

        {clickable && (
          <div className="flex items-center justify-end mt-2 pt-2 border-t border-black/5">
            <ArrowRight className={`w-3.5 h-3.5 text-slate-300 transition-all duration-200 ${style.hoverArrow} group-hover:translate-x-0.5`} />
          </div>
        )}
      </div>
    </Wrapper>
  );
}

function Wrapper({
  clickable, definition, onNavigate, className, children,
}: {
  clickable: boolean;
  definition: MetricDefinition;
  onNavigate?: (tab: TabType) => void;
  className: string;
  children: React.ReactNode;
}) {
  if (!clickable) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      onClick={() => definition.linkTab && onNavigate?.(slugToTab(definition.linkTab))}
      className={className}
    >
      {children}
    </button>
  );
}

