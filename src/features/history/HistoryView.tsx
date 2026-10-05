import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { EvaluationEntry } from '../../types';
import { ScoreBadge } from '../../components/common/ScoreBadge';
import { EvaluationDetailModal } from './EvaluationDetailModal';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Calendar, ChevronRight, TrendingUp, Sparkles, Filter, Plus } from 'lucide-react';

interface HistoryViewProps {
  initialTopicId?: string;
  onNewEvaluation: (topicId: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  initialTopicId,
  onNewEvaluation,
}) => {
  const topics = useLiveQuery(() => db.topics.toArray(), []) || [];
  const evaluations =
    useLiveQuery(() => db.evaluations.orderBy('date').toArray(), []) || [];

  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialTopicId || 'all');
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationEntry | null>(null);

  // Filtered evaluations
  const filteredEvaluations = useMemo(() => {
    if (selectedTopicId === 'all') return evaluations;
    return evaluations.filter((e) => e.topicId === selectedTopicId);
  }, [evaluations, selectedTopicId]);

  // Chart data formatted
  const chartData = useMemo(() => {
    return filteredEvaluations.map((item) => {
      const d = new Date(item.date);
      const formattedDate = `${d.getDate()}/${d.getMonth() + 1}`;
      return {
        dateStr: formattedDate,
        fullDate: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
        score: item.finalScore,
        id: item.id,
      };
    });
  }, [filteredEvaluations]);

  // Statistics
  const stats = useMemo(() => {
    if (filteredEvaluations.length === 0) return { avg: 0, max: 0, min: 0 };
    const scores = filteredEvaluations.map((e) => e.finalScore);
    const sum = scores.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round((sum / scores.length) * 100) / 100,
      max: Math.max(...scores),
      min: Math.min(...scores),
    };
  }, [filteredEvaluations]);

  const activeTopic = topics.find((t) => t.id === selectedTopicId);

  return (
    <div className="space-y-5 pb-28 max-w-md mx-auto px-4 pt-2">
      {/* Header & Filter */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          <span>Evolución Histórica</span>
        </h2>
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            className="bg-transparent text-xs text-white font-medium focus:outline-none"
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

      {/* Metrics Row */}
      {filteredEvaluations.length > 0 && (
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
              {filteredEvaluations.length}
            </span>
          </div>
        </div>
      )}

      {/* Interactive Evolution Chart */}
      {chartData.length > 0 ? (
        <div className="glass-card rounded-3xl p-4 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-semibold text-slate-300">
              Tendencia de Calificaciones (1-10)
            </span>
            <span className="text-[11px] text-indigo-400 font-medium">
              {chartData.length} mediciones
            </span>
          </div>

          <div className="h-48 w-full -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stop-color="#6366f1" stop-opacity={0.5} />
                    <stop offset="95%" stop-color="#6366f1" stop-opacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
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
                        <div className="glass-panel p-2.5 rounded-xl border border-indigo-500/30 text-xs shadow-xl">
                          <p className="font-bold text-white">{data.fullDate}</p>
                          <p className="text-indigo-400 font-semibold mt-0.5">
                            Nota: {data.score.toFixed(2)} / 10
                          </p>
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
          <p className="text-sm font-semibold text-white">Sin datos para este ámbito</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Realizá tu primera evaluación para comenzar a graficar la evolución.
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
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Historial de Evaluaciones ({filteredEvaluations.length})
        </h3>

        <div className="space-y-2">
          {filteredEvaluations
            .slice()
            .reverse()
            .map((evalEntry) => {
              const topic = topics.find((t) => t.id === evalEntry.topicId);
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
                        {new Date(evalEntry.date).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {evalEntry.notes ? (
                      <p className="text-xs text-slate-300 italic whitespace-pre-wrap break-words mt-1 leading-relaxed">
                        "{evalEntry.notes}"
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {evalEntry.items.length} criterios evaluados (Suma pesos: {evalEntry.totalWeight})
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

      {/* Detail Modal */}
      {selectedEvaluation && (
        <EvaluationDetailModal
          evaluation={selectedEvaluation}
          topic={topics.find((t) => t.id === selectedEvaluation.topicId)}
          onClose={() => setSelectedEvaluation(null)}
          onDeleted={() => setSelectedEvaluation(null)}
        />
      )}
    </div>
  );
};
