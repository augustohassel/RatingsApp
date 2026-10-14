import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import confetti from 'canvas-confetti';
import { db } from '../../db';
import { DAILY_MOOD_TOPIC_ID, EvaluationEntry } from '../../types';
import { toLocalDateString, createIsoFromLocalDate } from '../../utils/calculator';
import { ScoreBadge } from '../../components/common/ScoreBadge';
import { AutoResizeTextarea } from '../../components/common/AutoResizeTextarea';
import {
  Heart,
  Sparkles,
  Check,
  Calendar,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  History,
  Grid,
} from 'lucide-react';

interface QuickCheckInCardProps {
  onViewMoodWrapped: () => void;
  onViewHistory: (topicId?: string) => void;
}

export const QuickCheckInCard: React.FC<QuickCheckInCardProps> = ({
  onViewMoodWrapped,
  onViewHistory,
}) => {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Today and selected date for daily mood
  const todayStr = toLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const isSelectedDateToday = selectedDate === todayStr;

  const dailyEvals =
    useLiveQuery(
      () =>
        db.evaluations
          .where('topicId')
          .equals(DAILY_MOOD_TOPIC_ID)
          .toArray(),
      []
    ) || [];

  const selectedDateEntries = React.useMemo(() => {
    return dailyEvals.filter((e) => toLocalDateString(e.date) === selectedDate);
  }, [dailyEvals, selectedDate]);

  const selectedDateAverage = React.useMemo(() => {
    if (selectedDateEntries.length === 0) return null;
    const sum = selectedDateEntries.reduce((acc, e) => acc + e.finalScore, 0);
    return Math.round((sum / selectedDateEntries.length) * 100) / 100;
  }, [selectedDateEntries]);

  const handleScoreSelect = (score: number) => {
    setSelectedScore(score);
  };

  const handleSave = async () => {
    if (selectedScore === null) return;
    setIsSaving(true);

    try {
      const isoDate = createIsoFromLocalDate(selectedDate, new Date());
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
            score: selectedScore,
            contribution: selectedScore,
          },
        ],
        totalWeight: 10,
        finalScore: selectedScore,
        notes: note.trim() || undefined,
        createdAt: Date.now(),
      };

      await db.evaluations.add(newEntry);

      if (selectedScore >= 7) {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#10b981', '#6366f1', '#ec4899'],
        });
      }

      setJustSaved(true);
      setSelectedScore(null);
      setNote('');
      setIsNoteExpanded(false);

      setTimeout(() => {
        setJustSaved(false);
      }, 3000);
    } catch (err) {
      console.error('Error al guardar check-in:', err);
      alert('Error al guardar la sensación del día.');
    } finally {
      setIsSaving(false);
    }
  };

  const getScoreButtonClass = (score: number) => {
    const isSelected = selectedScore === score;
    let base =
      'h-9 rounded-xl font-bold text-xs transition-all duration-150 flex items-center justify-center border ';

    if (isSelected) {
      if (score >= 9) return base + 'bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-400 scale-105 shadow-md shadow-emerald-500/40';
      if (score >= 7) return base + 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400 scale-105 shadow-md shadow-emerald-600/40';
      if (score >= 5) return base + 'bg-amber-500 text-slate-950 font-black border-amber-400 ring-2 ring-amber-400 scale-105 shadow-md shadow-amber-500/40';
      if (score >= 3) return base + 'bg-orange-500 text-white border-orange-400 ring-2 ring-orange-400 scale-105 shadow-md shadow-orange-500/40';
      return base + 'bg-rose-500 text-white border-rose-400 ring-2 ring-rose-400 scale-105 shadow-md shadow-rose-500/40';
    }

    if (score >= 9) return base + 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/50 hover:border-emerald-700';
    if (score >= 7) return base + 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/40 hover:border-emerald-700';
    if (score >= 5) return base + 'bg-amber-950/30 text-amber-400 border-amber-800/40 hover:bg-amber-900/40 hover:border-amber-700';
    if (score >= 3) return base + 'bg-orange-950/30 text-orange-400 border-orange-800/40 hover:bg-orange-900/40 hover:border-orange-700';
    return base + 'bg-rose-950/30 text-rose-400 border-rose-800/40 hover:bg-rose-900/40 hover:border-rose-700';
  };

  const getScoreMoodText = (score: number) => {
    if (score >= 9) return 'Excelente / Pleno ✨';
    if (score >= 7) return 'Bien / Motivado 👍';
    if (score >= 5) return 'Normal / Regular 😐';
    if (score >= 3) return 'Bajo / Cansado 🌧️';
    return 'Muy bajo / Difícil ⚡';
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 border border-indigo-500/30 p-5 shadow-xl space-y-4">
      {/* Decorative ambient orb */}
      <div className="absolute -top-10 -right-10 w-28 h-28 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center">
            <Heart className="w-4 h-4 fill-pink-500/40" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 leading-tight">
              <span>{isSelectedDateToday ? 'Check-in de Hoy' : 'Check-in Retrospectivo'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pink-500/20 text-pink-300 font-semibold uppercase tracking-wider">
                {isSelectedDateToday ? 'Rápido' : 'Fecha pasada'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {isSelectedDateToday
                ? '¿Cómo está tu sensación general hoy? (1 al 10)'
                : `Registrar sensación para el ${selectedDate} (1 al 10)`}
            </p>
          </div>
        </div>

        {selectedDateAverage !== null && (
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isSelectedDateToday ? 'Promedio hoy' : 'Promedio día'}
            </span>
            <ScoreBadge score={selectedDateAverage} size="sm" />
          </div>
        )}
      </div>

      {/* Date Selector Row */}
      <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800/80 rounded-2xl px-3 py-1.5 text-xs">
        <span className="text-slate-300 flex items-center gap-1.5 font-medium">
          <Calendar className="w-3.5 h-3.5 text-pink-400" />
          <span>Fecha de la medición:</span>
        </span>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            max={todayStr}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-500 font-semibold"
          />
          {!isSelectedDateToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className="text-[10px] text-pink-300 hover:text-white font-semibold px-2 py-1 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 transition-colors"
              title="Volver a hoy"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* Feedback banner if saved recently */}
      {justSaved && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            {isSelectedDateToday
              ? '¡Sensación de hoy registrada con éxito! Podés sumar otro registro más tarde si cambia tu día.'
              : `¡Sensación del ${selectedDate} registrada con éxito!`}
          </span>
        </div>
      )}

      {/* 1-10 Buttons Grid */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => handleScoreSelect(score)}
              className={getScoreButtonClass(score)}
            >
              {score}
            </button>
          ))}
        </div>

        {selectedScore !== null && (
          <div className="flex items-center justify-between text-xs px-1 pt-1 animate-fade-in">
            <span className="text-slate-300 font-medium">
              Nota seleccionada: <strong className="text-white text-sm">{selectedScore}</strong>
            </span>
            <span className="text-indigo-400 font-semibold text-[11px]">
              {getScoreMoodText(selectedScore)}
            </span>
          </div>
        )}
      </div>

      {/* Optional Note accordion */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setIsNoteExpanded(!isNoteExpanded)}
          className="text-xs text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1.5 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
          <span>{isNoteExpanded ? 'Ocultar comentario' : 'Agregar nota o reflexión del día (opcional)'}</span>
          {isNoteExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {isNoteExpanded && (
          <div className="animate-fade-in">
            <AutoResizeTextarea
              minRows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="¿Qué influyó en tu sensación hoy? (hitos, emociones, contexto...)"
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500 leading-relaxed"
            />
          </div>
        )}
      </div>

      {/* Save Button */}
      {selectedScore !== null && (
        <div className="animate-fade-in pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 via-indigo-600 to-indigo-500 hover:from-pink-500 hover:to-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {isSaving
              ? 'Guardando...'
              : `Registrar sensación (${selectedScore}/10)${isSelectedDateToday ? '' : ` para ${selectedDate}`}`}
          </button>
        </div>
      )}

      {/* Multiple loads today info & Quick links */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div>
          {selectedDateEntries.length > 0 ? (
            <span className="flex items-center gap-1 text-slate-300">
              <Calendar className="w-3 h-3 text-indigo-400" />
              {selectedDateEntries.length} {selectedDateEntries.length === 1 ? 'registro' : 'registros'} {isSelectedDateToday ? 'hoy' : 'en esta fecha'}
            </span>
          ) : (
            <span className="text-slate-500 italic">
              Sin registros {isSelectedDateToday ? 'hoy todavía' : 'para esta fecha'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onViewMoodWrapped}
            className="text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-1 transition-colors"
          >
            <Grid className="w-3 h-3" />
            <span>Mood Wrapped 365</span>
          </button>
          <button
            type="button"
            onClick={() => onViewHistory(DAILY_MOOD_TOPIC_ID)}
            className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
          >
            <History className="w-3 h-3" />
            <span>Histórico</span>
          </button>
        </div>
      </div>
    </div>
  );
};
