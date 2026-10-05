import React from 'react';
import { EvaluationEntry, Topic } from '../../types';
import { ScoreBadge } from '../../components/common/ScoreBadge';
import { X, Calendar, MessageSquare, Trash2, Award } from 'lucide-react';
import { db } from '../../db';

interface EvaluationDetailModalProps {
  evaluation: EvaluationEntry;
  topic?: Topic;
  onClose: () => void;
  onDeleted: () => void;
}

export const EvaluationDetailModal: React.FC<EvaluationDetailModalProps> = ({
  evaluation,
  topic,
  onClose,
  onDeleted,
}) => {
  const handleDelete = async () => {
    if (confirm('¿Estás seguro de que deseas eliminar esta evaluación del histórico?')) {
      await db.evaluations.delete(evaluation.id);
      onDeleted();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-lg max-h-[90vh] rounded-3xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">
                {topic?.name || 'Evaluación'}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                {new Date(evaluation.date).toLocaleDateString('es-ES', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ScoreBadge score={evaluation.finalScore} size="lg" showLabel />
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Notes if available */}
          {evaluation.notes && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Reflexiones de este día</span>
              </div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "{evaluation.notes}"
              </p>
            </div>
          )}

          {/* Breakdown Table / List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              <span>Criterio</span>
              <div className="flex items-center gap-4">
                <span>Peso / %</span>
                <span>Nota</span>
                <span>Aporte</span>
              </div>
            </div>

            <div className="space-y-1.5">
              {evaluation.items.map((item, idx) => (
                <div
                  key={item.itemId || idx}
                  className="bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{item.name}</p>
                    {item.explanation && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.explanation}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 text-right">
                    <div className="w-14">
                      <span className="text-white font-medium">{item.weight}</span>
                      <span className="text-[10px] text-slate-400 block">
                        ({item.percentage.toFixed(0)}%)
                      </span>
                    </div>

                    <div className="w-8">
                      <span className="text-emerald-400 font-bold">{item.score}</span>
                    </div>

                    <div className="w-12">
                      <span className="text-indigo-400 font-semibold">
                        +{item.contribution.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Row */}
            <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 flex items-center justify-between text-xs font-bold text-white mt-2">
              <span>Total Ponderado</span>
              <div className="flex items-center gap-4 text-right">
                <span className="w-14 text-slate-300">
                  {evaluation.totalWeight} pts (100%)
                </span>
                <span className="w-8">-</span>
                <span className="w-12 text-indigo-400 text-sm">
                  {evaluation.finalScore.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar del histórico
          </button>
          <button
            onClick={onClose}
            className="text-xs text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
