import React, { useState, useMemo } from 'react';
import { EvaluationEntry, DailyAggregatedScore } from '../../types';
import {
  aggregateDailyScores,
  calculateMonthlyAverages,
  getMoodHeatmapColor,
  MONTH_NAMES_ES,
} from '../../utils/calculator';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
  MessageSquare,
  Clock,
  Trash2,
} from 'lucide-react';

import { db } from '../../db';

interface MoodWrappedMatrixProps {
  evaluations: EvaluationEntry[];
  onEvaluationDeleted?: () => void;
}

export const MoodWrappedMatrix: React.FC<MoodWrappedMatrixProps> = ({
  evaluations,
  onEvaluationDeleted,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDayData, setSelectedDayData] = useState<DailyAggregatedScore | null>(null);

  // Daily aggregations
  const dailyScores = useMemo(() => {
    return aggregateDailyScores(evaluations);
  }, [evaluations]);

  // Lookup map: 'YYYY-MM-DD' -> DailyAggregatedScore
  const dailyMap = useMemo(() => {
    const map = new Map<string, DailyAggregatedScore>();
    for (const d of dailyScores) {
      map.set(d.dateStr, d);
    }
    return map;
  }, [dailyScores]);

  // Monthly averages for the selected year
  const monthlyAverages = useMemo(() => {
    return calculateMonthlyAverages(dailyScores, selectedYear);
  }, [dailyScores, selectedYear]);

  // Overall stats for the year
  const yearStats = useMemo(() => {
    const yearDays = dailyScores.filter((d) => d.year === selectedYear);
    if (yearDays.length === 0) return { avg: null, count: 0, daysWithData: 0 };
    const sum = yearDays.reduce((acc, d) => acc + d.averageScore, 0);
    const totalEntries = yearDays.reduce((acc, d) => acc + d.count, 0);
    return {
      avg: Math.round((sum / yearDays.length) * 100) / 100,
      count: totalEntries,
      daysWithData: yearDays.length,
    };
  }, [dailyScores, selectedYear]);

  // Check if day is valid for month/year
  const isValidDay = (year: number, monthIndex: number, day: number): boolean => {
    const date = new Date(year, monthIndex, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === monthIndex &&
      date.getDate() === day
    );
  };

  const handleDeleteEntry = async (id: string) => {
    if (confirm('¿Eliminar esta medición de la sensación diaria?')) {
      await db.evaluations.delete(id);
      if (selectedDayData) {
        const remaining = selectedDayData.entries.filter((e) => e.id !== id);
        if (remaining.length === 0) {
          setSelectedDayData(null);
        } else {
          const sum = remaining.reduce((a, b) => a + b.finalScore, 0);
          setSelectedDayData({
            ...selectedDayData,
            entries: remaining,
            count: remaining.length,
            averageScore: Math.round((sum / remaining.length) * 100) / 100,
            notes: remaining.map((e) => e.notes?.trim()).filter((n): n is string => Boolean(n)),
          });
        }
      }
      onEvaluationDeleted?.();
    }
  };

  return (
    <div className="space-y-4">
      {/* Year Selector and Header */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-pink-400">
              Mood Wrapped
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 font-semibold">
              365 Días
            </span>
          </div>
          <h3 className="text-base font-black text-white mt-0.5">
            Matriz Anual de Bienestar
          </h3>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl p-1">
          <button
            onClick={() => setSelectedYear((prev) => prev - 1)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Año anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 font-black text-sm text-white tabular-nums">
            {selectedYear}
          </span>
          <button
            onClick={() => setSelectedYear((prev) => prev + 1)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Año siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Year Overview Stats */}
      {yearStats.daysWithData > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="glass-card rounded-xl p-2.5 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Promedio Anual
            </span>
            <span className="text-base font-black text-emerald-400 tabular-nums">
              {yearStats.avg?.toFixed(2)}
            </span>
          </div>
          <div className="glass-card rounded-xl p-2.5 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Días Registrados
            </span>
            <span className="text-base font-black text-white tabular-nums">
              {yearStats.daysWithData}
            </span>
          </div>
          <div className="glass-card rounded-xl p-2.5 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Total Cargas
            </span>
            <span className="text-base font-black text-indigo-400 tabular-nums">
              {yearStats.count}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span>Escala térmica:</span>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-rose-500 inline-block" />
            <span className="text-[10px]">1-4</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            <span className="text-[10px]">5-6</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
            <span className="text-[10px]">7-8</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            <span className="text-[10px]">9-10</span>
          </div>
        </div>
      </div>

      {/* Scrollable Matrix Table */}
      <div className="glass-card rounded-2xl p-3 sm:p-4 border border-slate-800 shadow-xl overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-center min-w-[340px]">
          <thead>
            <tr>
              <th className="text-[10px] font-bold text-slate-500 uppercase pb-1 pr-1 w-6 text-right">
                Día
              </th>
              {MONTH_NAMES_ES.map((month) => (
                <th
                  key={month}
                  className="text-[11px] font-bold text-slate-300 uppercase pb-1"
                >
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <tr key={day}>
                <td className="text-[10px] font-semibold text-slate-500 pr-1 text-right select-none">
                  {day}
                </td>
                {MONTH_NAMES_ES.map((_, monthIndex) => {
                  const valid = isValidDay(selectedYear, monthIndex, day);
                  if (!valid) {
                    return (
                      <td
                        key={monthIndex}
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-slate-950/40 opacity-20 pointer-events-none"
                      />
                    );
                  }

                  const mStr = String(monthIndex + 1).padStart(2, '0');
                  const dStr = String(day).padStart(2, '0');
                  const dateStr = `${selectedYear}-${mStr}-${dStr}`;
                  const dayData = dailyMap.get(dateStr);

                  if (dayData) {
                    const color = getMoodHeatmapColor(dayData.averageScore);
                    const hasNotes = dayData.notes.length > 0;
                    const displayVal =
                      dayData.averageScore % 1 === 0
                        ? dayData.averageScore.toString()
                        : dayData.averageScore.toFixed(1);

                    return (
                      <td key={monthIndex}>
                        <button
                          type="button"
                          onClick={() => setSelectedDayData(dayData)}
                          className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-md ${color.bg} ${color.text} text-[10px] sm:text-[11px] flex items-center justify-center transition-transform hover:scale-110 focus:outline-none shadow-sm active:scale-95`}
                          title={`${day} de ${MONTH_NAMES_ES[monthIndex]}: ${dayData.averageScore} (${dayData.count} registros)`}
                        >
                          <span className="tabular-nums font-bold leading-none">
                            {displayVal}
                          </span>
                          {hasNotes && (
                            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-white ring-1 ring-slate-900" />
                          )}
                        </button>
                      </td>
                    );
                  }

                  return (
                    <td key={monthIndex}>
                      <div
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-slate-900/60 border border-slate-800/60 text-slate-700 flex items-center justify-center text-[10px]"
                        title={`${day} de ${MONTH_NAMES_ES[monthIndex]}: Sin registros`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Monthly Averages Row (∅) */}
            <tr className="border-t-2 border-slate-700">
              <td className="text-[11px] font-black text-pink-400 pr-1 text-right pt-2 select-none">
                ∅
              </td>
              {monthlyAverages.map((m) => {
                if (m.averageScore !== null) {
                  const color = getMoodHeatmapColor(m.averageScore);
                  return (
                    <td key={m.monthIndex} className="pt-2">
                      <div
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md ${color.bg} ${color.text} text-[10px] font-black flex items-center justify-center shadow-md`}
                        title={`Promedio ${m.monthName}: ${m.averageScore} (${m.count} días evaluados)`}
                      >
                        {m.averageScore % 1 === 0
                          ? m.averageScore
                          : m.averageScore.toFixed(1)}
                      </div>
                    </td>
                  );
                }

                return (
                  <td key={m.monthIndex} className="pt-2">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-slate-900/80 border border-slate-800 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                      -
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Day Details Modal / Popover */}
      {selectedDayData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-sm rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center border border-pink-500/30">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">
                    {selectedDayData.day} de {MONTH_NAMES_ES[selectedDayData.month]} de {selectedDayData.year}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {selectedDayData.count} {selectedDayData.count === 1 ? 'registro' : 'registros en el día'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    getMoodHeatmapColor(selectedDayData.averageScore).bg
                  } ${getMoodHeatmapColor(selectedDayData.averageScore).text}`}
                >
                  Promedio: {selectedDayData.averageScore.toFixed(2)}
                </div>
                <button
                  onClick={() => setSelectedDayData(null)}
                  className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Entries of the day */}
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {selectedDayData.entries.map((entry) => {
                const dateObj = new Date(entry.date);

                const timeStr = dateObj.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={entry.id}
                    className="glass-card rounded-2xl p-3 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Hora: <strong>{timeStr}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-slate-800 text-white border border-slate-700">
                          {entry.finalScore} / 10
                        </span>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Eliminar este registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {entry.notes && (
                      <div className="bg-slate-900/80 rounded-xl p-2.5 text-xs text-slate-300 italic border border-slate-800/80 flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-pink-400 flex-shrink-0 mt-0.5" />
                        <span className="leading-relaxed whitespace-pre-wrap break-words">
                          "{entry.notes}"
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/60 text-right">
              <button
                onClick={() => setSelectedDayData(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
