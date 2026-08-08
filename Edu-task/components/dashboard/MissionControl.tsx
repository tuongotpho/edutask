'use client';

import React, { useMemo, useState } from 'react';
import { Activity, EyeOff, Eye, Radio } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  METRIC_GROUP_LABELS,
  METRIC_GROUP_ORDER,
  MetricDefinition,
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

const TONE_STYLES: Record<MetricTone, { dot: string; value: string; card: string }> = {
  CRITICAL: { dot: 'bg-rose-500', value: 'text-rose-700', card: 'bg-rose-50/60 border-rose-200' },
  WARNING: { dot: 'bg-amber-500', value: 'text-amber-700', card: 'bg-amber-50/60 border-amber-200' },
  INFO: { dot: 'bg-sky-500', value: 'text-sky-700', card: 'bg-sky-50/60 border-sky-200' },
  GOOD: { dot: 'bg-emerald-500', value: 'text-emerald-700', card: 'bg-emerald-50/60 border-emerald-200' },
  NEUTRAL: { dot: 'bg-slate-400', value: 'text-slate-700', card: 'bg-slate-50 border-slate-200' },
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
      <div className="bg-slate-900 rounded-3xl p-6 shadow-sm text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-400" />
              Màn Hình Điều Hành
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              {schoolName} · {weekdayLabel(today)} {formatDateVi(today)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold">
              {alerts.length === 0 ? 'Ổn định' : `${alerts.length} mục cần lưu ý`}
            </div>
            <p className="text-[11px] text-slate-400">
              {coverage.ready}/{coverage.total} chỉ số đã có dữ liệu
            </p>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {alerts.map(({ definition, outcome }) => (
              <button
                key={definition.key}
                type="button"
                onClick={() => definition.linkTab && onNavigate?.(slugToTab(definition.linkTab))}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  definition.linkTab ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
                } ${
                  outcome.state === 'READY' && outcome.tone === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-100 border border-amber-500/40'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  outcome.state === 'READY' && outcome.tone === 'CRITICAL' ? 'bg-rose-400' : 'bg-amber-400'
                }`} />
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
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5"
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

        return (
          <section key={group} className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              {METRIC_GROUP_LABELS[group]}
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
      <div className="p-3.5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Đang xây dựng</span>
        </div>
        <div className="text-2xl font-extrabold text-slate-300 mt-1">—</div>
        <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{definition.label}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{outcome.note}</div>
      </div>
    );
  }

  if (outcome.state === 'EMPTY') {
    // A count of zero is good news and shows a green dot; an unmeasured rate is
    // neither good nor bad, so it stays grey and shows a dash.
    const isRealZero = outcome.zeroIsMeaningful === true;
    return (
      <Wrapper clickable={clickable} definition={definition} onNavigate={onNavigate}
        className="p-3.5 rounded-2xl border border-slate-200 bg-white text-left w-full">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isRealZero ? 'bg-emerald-400' : 'bg-slate-300'}`} />
        </div>
        <div className="text-2xl font-extrabold text-slate-400 mt-1">{isRealZero ? '0' : '—'}</div>
        <div className="text-[11px] font-semibold text-slate-700 mt-0.5">{definition.label}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{outcome.note}</div>
      </Wrapper>
    );
  }

  const style = TONE_STYLES[outcome.tone];

  return (
    <Wrapper clickable={clickable} definition={definition} onNavigate={onNavigate}
      className={`p-3.5 rounded-2xl border text-left w-full transition-all ${style.card} ${
        clickable ? 'hover:shadow-sm hover:-translate-y-0.5' : ''
      }`}>
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      </div>
      <div className={`text-2xl font-extrabold mt-1 ${style.value}`}>{formatValue(outcome)}</div>
      <div className="text-[11px] font-semibold text-slate-800 mt-0.5">{definition.label}</div>
      {outcome.detail && <div className="text-[10px] text-slate-500 mt-0.5">{outcome.detail}</div>}
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
