import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { EvaluationEntry, DailyAggregatedScore, DAILY_MOOD_TOPIC_ID } from '../../types';
import {
  aggregateDailyScores,
  calculateMonthlyAverages,
  getMoodHeatmapColor,
  createIsoFromLocalDate,
  MONTH_NAMES_ES,
} from '../../utils/calculator';
import { AutoResizeTextarea } from '../../components/common/AutoResizeTextarea';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
  MessageSquare,
  Clock,
  Trash2,
  Plus,
  Pencil,
  Sparkles,
  Check,
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

  // Retrospective add modal state
  const [addEntryTarget, setAddEntryTarget] = useState<{
    dateStr: string;
    day: number;
    monthIndex: number;
    year: number;
  } | null>(null);
  const [newScore, setNewScore] = useState<number | null>(null);
  const [newNote, setNewNote] = useState<string>('');
  const [isSavingNew, setIsSavingNew] = useState(false);

  // Inline edit state inside day details modal
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(8);
  const [editNote, setEditNote] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  // Automatically keep selectedDayData synchronized with reactive dailyMap
  useEffect(() => {
    if (selectedDayData) {
      const fresh = dailyMap.get(selectedDayData.dateStr);
      setSelectedDayData(fresh || null);
    }
  }, [dailyMap]);

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

  const isFutureDay = (year: number, monthIndex: number, day: number): boolean => {
    const today = new Date();
    const cellDate = new Date(year, monthIndex, day);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return cellDate > todayMidnight;
  };

  const handleDeleteEntry = async (id: string) => {
    if (confirm('¿Eliminar esta medición de la sensación diaria?')) {
      await db.evaluations.delete(id);
      onEvaluationDeleted?.();
    }
  };

  const handleOpenAddModal = (dateStr: string, day: number, monthIndex: number, year: number) => {
    setAddEntryTarget({ dateStr, day, monthIndex, year });
    setNewScore(null);
    setNewNote('');
  };

  const handleSaveNewEntry = async () => {
    if (!addEntryTarget || newScore === null) return;
    setIsSavingNew(true);
    try {
      const isoDate = createIsoFromLocalDate(addEntryTarget.dateStr);
      const newEntry: EvaluationEntry = {
        id: `mood-${Date.now()}`,
        topicId: DAILY_MOOD_TOPIC_ID,
        date: isoDate,
        items: [
          {
            itemId: 'dm-1',
            name: 'Sensación general',
            weight: 10,
            percentage: 100,
            score: newScore,
            contribution: newScore,
          },
        ],
        totalWeight: 10,
        finalScore: newScore,
        notes: newNote.trim() || undefined,
        createdAt: Date.now(),
      };
      await db.evaluations.add(newEntry);
      if (newScore >= 7) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      }
      setAddEntryTarget(null);
      setNewScore(null);
      setNewNote('');
    } catch (err) {
      console.error('Error al guardar sensación retrospectiva:', err);
      alert('Error al guardar la sensación.');
    } finally {
      setIsSavingNew(false);
    }
  };

  const handleStartEdit = (entry: EvaluationEntry) => {
    setEditingEntryId(entry.id);
    setEditScore(entry.finalScore);
    setEditNote(entry.notes || '');
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
  };

  const handleSaveEdit = async (entryId: string) => {
    setIsSavingEdit(true);
    try {
      const entry = selectedDayData?.entries.find((e) => e.id === entryId);
      if (!entry) return;
      const updatedItems =
        entry.items && entry.items.length > 0
          ? [{ ...entry.items[0], score: editScore, contribution: editScore }]
          : [
              {
                itemId: 'dm-1',
                name: 'Sensación general',
                weight: 10,
                percentage: 100,
                score: editScore,
                contribution: editScore,
              },
            ];

      await db.evaluations.update(entryId, {
        finalScore: editScore,
        items: updatedItems,
        notes: editNote.trim() || undefined,
      });

      setEditingEntryId(null);
    } catch (err) {
      console.error('Error al actualizar sensación:', err);
      alert('Error al actualizar la sensación.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const getButtonScoreClass = (score: number, currentSelected: number | null) => {
    const isSelected = currentSelected === score;
    let base =
      'h-8 rounded-lg font-bold text-xs transition-all flex items-center justify-center border ';
    if (isSelected) {
      if (score >= 9) return base + 'bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-400 scale-105';
      if (score >= 7) return base + 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400 scale-105';
      if (score >= 5) return base + 'bg-amber-500 text-slate-950 font-black border-amber-400 ring-2 ring-amber-400 scale-105';
      if (score >= 3) return base + 'bg-orange-500 text-white border-orange-400 ring-2 ring-orange-400 scale-105';
      return base + 'bg-rose-500 text-white border-rose-400 ring-2 ring-rose-400 scale-105';
    }
    if (score >= 9) return base + 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/50';
    if (score >= 7) return base + 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/40';
    if (score >= 5) return base + 'bg-amber-950/30 text-amber-400 border-amber-800/40 hover:bg-amber-900/40';
    if (score >= 3) return base + 'bg-orange-950/30 text-orange-400 border-orange-800/40 hover:bg-orange-900/40';
    return base + 'bg-rose-950/30 text-rose-400 border-rose-800/40 hover:bg-rose-900/40';
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

                  const isFuture = isFutureDay(selectedYear, monthIndex, day);
                  if (isFuture) {
                    return (
                      <td key={monthIndex}>
                        <div
                          className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-slate-950/30 border border-slate-900 text-slate-800 flex items-center justify-center text-[10px]"
                          title={`${day} de ${MONTH_NAMES_ES[monthIndex]}: Fecha futura`}
                        />
                      </td>
                    );
                  }

                  return (
                    <td key={monthIndex}>
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(dateStr, day, monthIndex, selectedYear)}
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800/60 hover:border-pink-500/50 text-slate-700 hover:text-pink-300 flex items-center justify-center text-[10px] transition-all group active:scale-95"
                        title={`${day} de ${MONTH_NAMES_ES[monthIndex]}: Clic para agregar registro`}
                      >
                        <span className="opacity-0 group-hover:opacity-100 font-bold leading-none text-[11px]">+</span>
                      </button>
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

                if (editingEntryId === entry.id) {
                  return (
                    <div
                      key={entry.id}
                      className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-3 space-y-2.5 animate-fade-in"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                          Modificar medición
                        </span>
                        <span className="text-[11px] text-indigo-300">
                          Hora: <strong>{timeStr}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-10 gap-1">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setEditScore(s)}
                            className={getButtonScoreClass(s, editScore)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>

                      <AutoResizeTextarea
                        minRows={2}
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Reflexión o nota de este momento..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                      />

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(entry.id)}
                          disabled={isSavingEdit}
                          className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          {isSavingEdit ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  );
                }

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
                          type="button"
                          onClick={() => handleStartEdit(entry)}
                          className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Editar este registro"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
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

              {/* Add another measurement to this day */}
              <button
                type="button"
                onClick={() => {
                  handleOpenAddModal(
                    selectedDayData.dateStr,
                    selectedDayData.day,
                    selectedDayData.month,
                    selectedDayData.year
                  );
                }}
                className="w-full py-2.5 border border-dashed border-slate-700 hover:border-pink-500/50 rounded-xl text-slate-400 hover:text-pink-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors bg-slate-900/40"
              >
                <Plus className="w-3.5 h-3.5" />
                Sumar otra medición a este día
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/60 text-right">
              <button
                onClick={() => {
                  setSelectedDayData(null);
                  setEditingEntryId(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Entry Retrospective Modal */}
      {addEntryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-sm rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center border border-pink-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Registrar Sensación</h4>
                  <p className="text-[11px] text-slate-400">
                    {addEntryTarget.day} de {MONTH_NAMES_ES[addEntryTarget.monthIndex]} de {addEntryTarget.year}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddEntryTarget(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Sensación general (1 al 10):
                </label>
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNewScore(s)}
                      className={getButtonScoreClass(s, newScore)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-pink-400" />
                  Reflexión o contexto (opcional):
                </label>
                <AutoResizeTextarea
                  minRows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="¿Qué influyó en tu sensación este día?"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500 leading-relaxed"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddEntryTarget(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNewEntry}
                disabled={newScore === null || isSavingNew}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-pink-600/20 disabled:opacity-50"
              >
                {isSavingNew ? 'Guardando...' : 'Guardar medición'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
