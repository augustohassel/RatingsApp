import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import confetti from 'canvas-confetti';
import { db } from '../../db';
import { calculateWeightedRating, RawItemInput } from '../../utils/calculator';
import { CircularGauge } from '../../components/common/CircularGauge';
import { Info, Plus, Trash2, CheckCircle2, ChevronDown, Calendar, MessageSquareQuote } from 'lucide-react';

interface EvaluatorViewProps {
  initialTopicId?: string;
  onEvaluationSaved: (topicId: string) => void;
}

export const EvaluatorView: React.FC<EvaluatorViewProps> = ({
  initialTopicId,
  onEvaluationSaved,
}) => {
  const topics = useLiveQuery(() => db.topics.toArray(), []) || [];
  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialTopicId || '');

  // Keep selectedTopicId in sync with props or first available topic
  useEffect(() => {
    if (initialTopicId) {
      setSelectedTopicId(initialTopicId);
    } else if (topics.length > 0 && !selectedTopicId) {
      setSelectedTopicId(topics[0].id);
    }
  }, [initialTopicId, topics, selectedTopicId]);

  const currentTopic = useMemo(() => {
    return topics.find((t) => t.id === selectedTopicId);
  }, [topics, selectedTopicId]);

  // Form state: items being rated
  const [items, setItems] = useState<RawItemInput[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [evaluationDate, setEvaluationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [expandedInfo, setExpandedInfo] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize items when currentTopic changes
  useEffect(() => {
    if (currentTopic) {
      const initialItems: RawItemInput[] = currentTopic.items.map((itemDef) => ({
        itemId: itemDef.id,
        name: itemDef.name,
        explanation: itemDef.explanation,
        weight: itemDef.defaultWeight || 5,
        score: 8, // Sensible starting score (or default 7/8)
      }));
      setItems(initialItems);
    }
  }, [currentTopic]);

  // Real-time calculation result
  const calculation = useMemo(() => {
    return calculateWeightedRating(items);
  }, [items]);

  const handleWeightChange = (index: number, newWeight: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], weight: newWeight };
      return copy;
    });
  };

  const handleScoreChange = (index: number, newScore: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], score: newScore };
      return copy;
    });
  };

  const handleToggleInfo = (itemId: string) => {
    setExpandedInfo((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleAddCustomItem = () => {
    const newItemId = `custom-${Date.now()}`;
    const newItem: RawItemInput = {
      itemId: newItemId,
      name: 'Nuevo Criterio',
      explanation: 'Criterio añadido en esta evaluación',
      weight: 5,
      score: 7,
    };
    setItems((prev) => [...prev, newItem]);
    setExpandedInfo((prev) => ({ ...prev, [newItemId]: true }));
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!currentTopic || items.length === 0) return;
    setIsSaving(true);

    try {
      const evalId = `eval-${Date.now()}`;
      await db.evaluations.add({
        id: evalId,
        topicId: currentTopic.id,
        date: new Date(evaluationDate).toISOString(),
        items: calculation.items,
        totalWeight: calculation.totalWeight,
        finalScore: calculation.finalScore,
        notes: notes.trim(),
        createdAt: Date.now(),
      });

      // Trigger celebration confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f59e0b'],
      });

      setTimeout(() => {
        setIsSaving(false);
        onEvaluationSaved(currentTopic.id);
      }, 500);
    } catch (err) {
      console.error('Error saving evaluation:', err);
      setIsSaving(false);
      alert('Hubo un error al guardar la evaluación.');
    }
  };

  if (!currentTopic) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>No se encontraron ámbitos de evaluación.</p>
      </div>
    );
  }

  return (
    <div className="pb-28 max-w-md mx-auto px-4 pt-2 space-y-4">
      {/* Topic Switcher Dropdown */}
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Ámbito:
        </label>
        <div className="relative flex-1">
          <select
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            className="w-full appearance-none bg-slate-900 border border-slate-700/80 rounded-xl py-2 px-3 pr-8 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Floating Sticky Live Gauge Card */}
      <div className="sticky top-14 z-20 glass-panel rounded-2xl p-4 border border-indigo-500/20 shadow-xl flex items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
            Cálculo en Vivo
          </span>
          <h3 className="text-sm font-bold text-white leading-tight mt-0.5">
            {currentTopic.name}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            {items.length} criterios • Suma pesos: <span className="text-white font-medium">{calculation.totalWeight}</span>
          </p>
        </div>
        <div className="flex-shrink-0">
          <CircularGauge score={calculation.finalScore} size={90} strokeWidth={8} />
        </div>
      </div>

      {/* Date and Context Settings */}
      <div className="glass-card rounded-xl p-3 border border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1.5 font-medium">
          <Calendar className="w-4 h-4 text-indigo-400" />
          Fecha de la evaluación:
        </span>
        <input
          type="date"
          value={evaluationDate}
          onChange={(e) => setEvaluationDate(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Criteria Scoring List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Ponderaciones y Calificaciones
          </h3>
          <span className="text-[11px] text-slate-400">Escala de 1 a 10</span>
        </div>

        {items.map((item, index) => {
          const calculatedItem = calculation.items[index];
          const isExpanded = !!expandedInfo[item.itemId];

          return (
            <div
              key={item.itemId}
              className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3 transition-all hover:border-slate-700/80"
            >
              {/* Item Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 tabular-nums">
                      #{index + 1}
                    </span>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) => {
                          const copy = [...prev];
                          copy[index] = { ...copy[index], name: val };
                          return copy;
                        });
                      }}
                      className="bg-transparent text-sm font-semibold text-white focus:outline-none focus:border-b focus:border-indigo-500 flex-1"
                    />
                    {item.explanation && (
                      <button
                        onClick={() => handleToggleInfo(item.itemId)}
                        className={`p-1 rounded-md text-xs transition-colors ${
                          isExpanded ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Ver explicación"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Explanation box */}
                  {(isExpanded || !item.explanation) && (
                    <div className="mt-1.5 text-xs text-slate-400 bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                      <input
                        type="text"
                        placeholder="Explicación / ayuda memoria..."
                        value={item.explanation || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItems((prev) => {
                            const copy = [...prev];
                            copy[index] = { ...copy[index], explanation: val };
                            return copy;
                          });
                        }}
                        className="w-full bg-transparent text-[11px] text-slate-300 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Delete button if extra item */}
                {items.length > 1 && (
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="text-slate-600 hover:text-rose-400 p-1 transition-colors"
                    title="Eliminar criterio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Slider 1: Ponderación (Importancia) */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">
                    Importancia (Ponderación):
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                      {calculatedItem ? calculatedItem.percentage.toFixed(1) : 0}% del total
                    </span>
                    <span className="text-white font-bold tabular-nums w-5 text-right">
                      {item.weight}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={item.weight}
                  onChange={(e) => handleWeightChange(index, Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Slider 2: Nota Actual (Valorización) */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">
                    Nota actual (Cómo me siento):
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-400/90 font-medium">
                      Aporte: +{calculatedItem ? calculatedItem.contribution.toFixed(2) : 0} pts
                    </span>
                    <span className="text-white font-bold tabular-nums w-5 text-right">
                      {item.score}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={item.score}
                  onChange={(e) => handleScoreChange(index, Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>
          );
        })}

        {/* Add custom criteria button */}
        <button
          onClick={handleAddCustomItem}
          className="w-full py-2.5 border border-dashed border-slate-700 hover:border-indigo-500/50 rounded-2xl text-slate-400 hover:text-indigo-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          Añadir otro criterio a esta evaluación
        </button>
      </div>

      {/* Reflections / Notes Box */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-2">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <MessageSquareQuote className="w-4 h-4 text-indigo-400" />
          Reflexiones y contexto del día (Opcional):
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Escribí aquí qué motivó estas notas hoy, situaciones relevantes o pensamientos..."
          className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving || items.length === 0}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
        >
          <CheckCircle2 className="w-5 h-5" />
          {isSaving ? 'Guardando...' : `Guardar Evaluación (${calculation.finalScore.toFixed(2)})`}
        </button>
      </div>
    </div>
  );
};
