import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { EvaluationEntry } from '../../types';
import { ScoreBadge } from '../../components/common/ScoreBadge';
import { EvaluationDetailModal } from './EvaluationDetailModal';
import { MoodWrappedMatrix } from './MoodWrappedMatrix';
import { aggregateDailyScores } from '../../utils/calculator';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Calendar,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Filter,
  Plus,
  Grid,
  Clock,
  MessageSquare,
} from 'lucide-react';

export type HistoryViewMode = 'timeline' | 'matrix';
export type TimeRangeOption = '7d' | '30d' | '90d' | '1y' | 'all';

interface HistoryViewProps {
  initialTopicId?: string;
  initialViewMode?: HistoryViewMode;
  onNewEvaluation: (topicId: string) => void;
  onEditEvaluation?: (evaluation: EvaluationEntry) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  initialTopicId,
  initialViewMode = 'timeline',
  onNewEvaluation,
  onEditEvaluation,
}) => {
  const topics = useLiveQuery(() => db.topics.toArray(), []) || [];
  const evaluations =
    useLiveQuery(() => db.evaluations.orderBy('date').toArray(), []) || [];

  const [viewMode, setViewMode] = useState<HistoryViewMode>(initialViewMode);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialTopicId || 'all');
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('30d');
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationEntry | null>(null);

  // Update selected topic if prop changes
  React.useEffect(() => {
    if (initialTopicId) {
      setSelectedTopicId(initialTopicId);
    }
  }, [initialTopicId]);

  React.useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // Topic filtered evaluations
  const filteredEvaluations = useMemo(() => {
    if (selectedTopicId === 'all') return evaluations;
    return evaluations.filter((e) => e.topicId === selectedTopicId);
  }, [evaluations, selectedTopicId]);

  // Time range filtered evaluations
  const timeRangeFilteredEvaluations = useMemo(() => {
    if (timeRange === 'all') return filteredEvaluations;
    const now = new Date();
    const cutoff = new Date();
    if (timeRange === '7d') cutoff.setDate(now.getDate() - 7);
    else if (timeRange === '30d') cutoff.setDate(now.getDate() - 30);
    else if (timeRange === '90d') cutoff.setDate(now.getDate() - 90);
    else if (timeRange === '1y') cutoff.setFullYear(now.getFullYear() - 1);

    return filteredEvaluations.filter((e) => new Date(e.date) >= cutoff);
  }, [filteredEvaluations, timeRange]);

  // Daily aggregated chart data
  const chartData = useMemo(() => {
    const dailyAggs = aggregateDailyScores(timeRangeFilteredEvaluations);
    return dailyAggs.map((d) => {
      return {
        dateStr: `${d.day}/${d.month + 1}`,
        fullDate: d.date.toLocaleDateString('es-ES', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        score: d.averageScore,
        count: d.count,
        hasNotes: d.notes.length > 0,
        notes: d.notes,
        entries: d.entries,
      };
    });
  }, [timeRangeFilteredEvaluations]);

  // Overall statistics for the filtered evaluations
  const stats = useMemo(() => {
    if (timeRangeFilteredEvaluations.length === 0) return { avg: 0, max: 0, min: 0 };
    const scores = timeRangeFilteredEvaluations.map((e) => e.finalScore);
    const sum = scores.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round((sum / scores.length) * 100) / 100,
      max: Math.max(...scores),
      min: Math.min(...scores),
    };
  }, [timeRangeFilteredEvaluations]);

  const activeTopic = topics.find((t) => t.id === selectedTopicId);

  // Custom dot on chart curve highlighting days with notes
  const renderCustomDot = (props: any): React.ReactElement<SVGElement> => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload) {
      return <g key={`dot-fallback-${Math.random()}`} />;
    }

    if (payload.hasNotes) {
      return (
        <g
          key={`dot-notes-${payload.dateStr}-${cx}`}
          className="cursor-pointer"
          onClick={() => {
            if (payload.entries && payload.entries.length > 0) {
              setSelectedEvaluation(payload.entries[0]);
            }
          }}
        >
          <circle cx={cx} cy={cy} r={6} fill="#ec4899" stroke="#ffffff" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={2.5} fill="#ffffff" />
        </g>
      );
    }

    return (
      <circle
        key={`dot-${payload.dateStr}-${cx}`}
        cx={cx}
        cy={cy}
        r={3}
        fill="#818cf8"
        className="cursor-pointer"
        onClick={() => {
          if (payload.entries && payload.entries.length > 0) {
            setSelectedEvaluation(payload.entries[0]);
          }
        }}
      />
    );
  };


  return (
    <div className="space-y-5 pb-28 max-w-md mx-auto px-4 pt-2">
      {/* View Mode Toggle & Filter Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          {/* View switcher tabs */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Evolución</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'matrix'
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Mood Wrapped</span>
            </button>
          </div>

          {/* Topic Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 max-w-[170px]">
            <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="bg-transparent text-xs text-white font-medium focus:outline-none truncate w-full"
            >
              <option value="all">Todos los ámbitos</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MATRIX VIEW */}
      {viewMode === 'matrix' ? (
        <MoodWrappedMatrix
          evaluations={filteredEvaluations}
          onEvaluationDeleted={() => {}}
        />
      ) : (
        /* TIMELINE VIEW */
        <div className="space-y-4">
          {/* Time Range Selector */}
          <div className="flex items-center justify-between text-xs px-0.5">
            <span className="font-semibold text-slate-400">Ventana temporal:</span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-xl">
              {(
                [
                  { id: '7d', label: '7 días' },
                  { id: '30d', label: '30 días' },
                  { id: '90d', label: '90 días' },
                  { id: '1y', label: '1 año' },
                  { id: 'all', label: 'Todo' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTimeRange(tab.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    timeRange === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metrics Row */}
          {timeRangeFilteredEvaluations.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              <div className="glass-card rounded-2xl p-3 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                  Promedio
                </span>
                <span className="text-lg font-black text-white tabular-nums">
                  {stats.avg.toFixed(2)}
                </span>
              </div>
              <div className="glass-card rounded-2xl p-3 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                  Nota Máx
                </span>
                <span className="text-lg font-black text-emerald-400 tabular-nums">
                  {stats.max.toFixed(2)}
                </span>
              </div>
              <div className="glass-card rounded-2xl p-3 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                  Registros
                </span>
                <span className="text-lg font-black text-indigo-400 tabular-nums">
                  {timeRangeFilteredEvaluations.length}
                </span>
              </div>
            </div>
          )}

          {/* Interactive Evolution Chart */}
          {chartData.length > 0 ? (
            <div className="glass-card rounded-3xl p-4 border border-slate-800 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-semibold text-slate-300">
                  Evolución Diaria (Promedio)
                </span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] text-pink-400">
                    <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" /> Con notas
                  </span>
                  <span className="text-[11px] text-indigo-400 font-medium">
                    {chartData.length} días
                  </span>
                </div>
              </div>

              <div className="h-52 w-full -ml-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis
                      dataKey="dateStr"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 10]}
                      ticks={[2, 4, 6, 8, 10]}
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="glass-panel p-3 rounded-xl border border-indigo-500/40 text-xs shadow-2xl max-w-xs space-y-1.5 animate-fade-in pointer-events-none">
                              <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-1">
                                <span className="font-bold text-white">{data.fullDate}</span>
                                {data.count > 1 && (
                                  <span className="text-[10px] text-slate-400">
                                    {data.count} registros
                                  </span>
                                )}
                              </div>
                              <p className="text-indigo-400 font-bold text-sm">
                                Nota: {data.score.toFixed(2)} / 10
                              </p>
                              {data.notes && data.notes.length > 0 && (
                                <div className="pt-1 space-y-1">
                                  <span className="text-[10px] uppercase font-bold text-pink-400 flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    Reflexiones:
                                  </span>
                                  {data.notes.map((n: string, i: number) => (
                                    <p
                                      key={i}
                                      className="text-slate-300 italic text-[11px] leading-snug break-words bg-slate-900/60 p-1.5 rounded-lg border border-slate-800"
                                    >
                                      "{n}"
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#818cf8"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#scoreGradient)"
                      dot={renderCustomDot}
                      activeDot={{ r: 7, fill: '#ec4899', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-3xl p-8 border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-white">Sin datos para este rango</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Realizá una nueva evaluación o check-in para comenzar a graficar la evolución.
              </p>
              {activeTopic && (
                <button
                  onClick={() => onNewEvaluation(activeTopic.id)}
                  className="mt-2 py-2 px-4 rounded-xl bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Calificar {activeTopic.name}
                </button>
              )}
            </div>
          )}

          {/* Historical List */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Historial de Evaluaciones ({timeRangeFilteredEvaluations.length})
            </h3>

            <div className="space-y-2">
              {timeRangeFilteredEvaluations
                .slice()
                .reverse()
                .map((evalEntry) => {
                  const topic = topics.find((t) => t.id === evalEntry.topicId);
                  const dateObj = new Date(evalEntry.date);
                  const timeStr = dateObj.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={evalEntry.id}
                      onClick={() => setSelectedEvaluation(evalEntry)}
                      className="glass-card rounded-2xl p-4 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white truncate">
                            {topic?.name || 'Evaluación'}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {dateObj.toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {timeStr}
                          </span>
                        </div>

                        {evalEntry.notes ? (
                          <p className="text-xs text-slate-300 italic whitespace-pre-wrap break-words mt-1 leading-relaxed">
                            "{evalEntry.notes}"
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {evalEntry.items.length === 1 && evalEntry.items[0]?.name === 'Sensación general'
                              ? 'Registro simple de sensación general'
                              : `${evalEntry.items.length} criterios evaluados (Suma pesos: ${evalEntry.totalWeight})`}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <ScoreBadge score={evalEntry.finalScore} size="md" />
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedEvaluation && (
        <EvaluationDetailModal
          evaluation={selectedEvaluation}
          topic={topics.find((t) => t.id === selectedEvaluation.topicId)}
          onClose={() => setSelectedEvaluation(null)}
          onDeleted={() => setSelectedEvaluation(null)}
          onEdit={onEditEvaluation}
        />
      )}
    </div>
  );
};
