import React, { useState, useMemo } from 'react';
import { ChatDraftEvaluation, EvaluationEntry } from '../../types';
import { calculateWeightedRating, createIsoFromLocalDate, toLocalDateString } from '../../utils/calculator';
import { CircularGauge } from '../../components/common/CircularGauge';
import { ScoreBadge } from '../../components/common/ScoreBadge';
import confetti from 'canvas-confetti';
import { CheckCircle2, Calendar, Sparkles, MessageSquareQuote, Check, RotateCcw } from 'lucide-react';

interface DraftEvaluationCardProps {
  draft: ChatDraftEvaluation;
  onConfirm: (confirmedEntry: EvaluationEntry) => Promise<void>;
  onStartNewSession?: () => void;
}

export const DraftEvaluationCard: React.FC<DraftEvaluationCardProps> = ({ draft, onConfirm, onStartNewSession }) => {
  const [items, setItems] = useState(draft.items);
  const [notes, setNotes] = useState(draft.notes || '');
  const [dateStr, setDateStr] = useState(draft.dateStr || toLocalDateString(new Date()));
  const [isConfirmed, setIsConfirmed] = useState(draft.confirmed || false);
  const [isSaving, setIsSaving] = useState(false);

  const calculation = useMemo(() => {
    return calculateWeightedRating(
      items.map((it) => ({
        itemId: it.itemId,
        name: it.name,
        explanation: it.explanation,
        weight: it.weight,
        score: it.score,
      }))
    );
  }, [items]);

  const handleScoreChange = (itemId: string, newScore: number) => {
    if (isConfirmed) return;
    setItems((prev) =>
      prev.map((it) => (it.itemId === itemId ? { ...it, score: newScore } : it))
    );
  };

  const handleConfirmSave = async () => {
    if (isConfirmed || isSaving) return;
    setIsSaving(true);

    try {
      const isoDate = createIsoFromLocalDate(dateStr, new Date());
      const newEntry: EvaluationEntry = {
        id: `eval-${Date.now()}`,
        topicId: draft.topicId,
        date: isoDate,
        items: calculation.items,
        totalWeight: calculation.totalWeight,
        finalScore: calculation.finalScore,
        notes: notes.trim() || undefined,
        createdAt: Date.now(),
      };

      await onConfirm(newEntry);
      setIsConfirmed(true);

      if (calculation.finalScore >= 7) {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#10b981', '#6366f1', '#ec4899'],
        });
      }
    } catch (err) {
      console.error('Error al confirmar evaluación:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl bg-slate-900/90 border border-indigo-500/30 overflow-hidden shadow-xl text-slate-100">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 px-4 py-3 border-b border-indigo-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                Borrador de Evaluación
              </span>
              {isConfirmed && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded-full font-semibold">
                  <Check className="w-3 h-3" /> Guardado
                </span>
              )}
            </div>
            <h4 className="font-bold text-sm text-white">{draft.topicName}</h4>
          </div>
        </div>

        <div className="text-right">
          <ScoreBadge score={calculation.finalScore} size="sm" showLabel={false} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Resumen Gauge y Puntuación */}
        <div className="flex items-center justify-around bg-slate-950/60 rounded-xl p-3 border border-slate-800">
          <div className="flex items-center gap-3">
            <CircularGauge score={calculation.finalScore} size={64} strokeWidth={6} />
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Nota Ponderada</p>
              <p className="text-lg font-black text-white">{calculation.finalScore.toFixed(2)}</p>
              <p className="text-[10px] text-slate-500">Suma pesos: {calculation.totalWeight}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={dateStr}
              disabled={isConfirmed}
              onChange={(e) => setDateStr(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Desglose de Criterios con Sliders ajustables */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            Criterios y Notas Propuestas (Ajustables)
          </p>
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {items.map((it) => (
              <div
                key={it.itemId}
                className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-200">{it.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">(peso: {it.weight})</span>
                    </div>
                    {it.justification && (
                      <p className="text-[11px] text-indigo-300/90 italic mt-0.5 flex items-start gap-1">
                        <MessageSquareQuote className="w-3 h-3 shrink-0 mt-0.5 text-indigo-400" />
                        <span>{it.justification}</span>
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-bold text-white bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 font-mono">
                      {it.score}
                    </span>
                  </div>
                </div>

                {!isConfirmed && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-slate-500 font-mono">1</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={it.score}
                      onChange={(e) => handleScoreChange(it.itemId, parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">10</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Reflexiones / Notas */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            Reflexión / Comentarios
          </label>
          <textarea
            value={notes}
            disabled={isConfirmed}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones de la jornada..."
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60 resize-none"
          />
        </div>

        {/* Botón de Confirmación */}
        {!isConfirmed ? (
          <button
            onClick={handleConfirmSave}
            disabled={isSaving}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Confirmar y Guardar en Historial'}</span>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              <span>Evaluación guardada exitosamente en tu base de datos local.</span>
            </div>
            {onStartNewSession && (
              <button
                type="button"
                onClick={onStartNewSession}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Iniciar nueva conversación limpia</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

