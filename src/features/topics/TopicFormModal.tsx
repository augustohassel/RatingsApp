import React, { useState } from 'react';
import { Topic, TopicItemDefinition } from '../../types';
import { db } from '../../db';
import { AutoResizeTextarea } from '../../components/common/AutoResizeTextarea';
import { TopicIcon, AVAILABLE_TOPIC_ICONS } from '../../components/common/TopicIcon';
import { X, Plus, Minus, Trash2, Check } from 'lucide-react';

interface TopicFormModalProps {
  topic?: Topic | null;
  onClose: () => void;
  onSaved: () => void;
}

export const TOPIC_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#0d9488', // Teal
  '#10b981', // Emerald
  '#84cc16', // Lime
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#d946ef', // Fuchsia
  '#8b5cf6', // Violet
];

export const TopicFormModal: React.FC<TopicFormModalProps> = ({
  topic,
  onClose,
  onSaved,
}) => {
  const isEditing = !!topic;
  const [name, setName] = useState(topic?.name || '');
  const [description, setDescription] = useState(topic?.description || '');
  const [color, setColor] = useState(topic?.color || '#6366f1');
  const [icon, setIcon] = useState(topic?.icon || 'Briefcase');
  const [items, setItems] = useState<TopicItemDefinition[]>(
    topic?.items || [
      { id: 'it-1', name: 'Primer Criterio', explanation: 'Descripción o ayuda memoria', defaultWeight: 8 },
      { id: 'it-2', name: 'Segundo Criterio', explanation: 'Descripción o ayuda memoria', defaultWeight: 7 },
    ]
  );

  const colors = TOPIC_COLORS;

  const handleAddItem = () => {
    const newItem: TopicItemDefinition = {
      id: `it-${Date.now()}`,
      name: '',
      explanation: '',
      defaultWeight: 5,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (index: number, field: keyof TopicItemDefinition, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor ingresa un nombre para el ámbito.');
      return;
    }

    const filteredItems = items
      .filter((it) => it.name.trim().length > 0)
      .map((it) => ({
        ...it,
        name: it.name.trim(),
        explanation: it.explanation?.trim() || '',
        defaultWeight: Math.min(10, Math.max(1, Number(it.defaultWeight) || 5)),
      }));

    if (filteredItems.length === 0) {
      alert('Debe tener al menos un criterio con nombre.');
      return;
    }

    const topicData: Topic = {
      id: topic?.id || `topic-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      color,
      icon,
      items: filteredItems,
      createdAt: topic?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    if (isEditing) {
      await db.topics.put(topicData);
    } else {
      await db.topics.add(topicData);
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-lg max-h-[90vh] rounded-3xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              data-testid="topic-header-icon"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md transition-colors"
              style={{ backgroundColor: color }}
            >
              <TopicIcon name={icon} className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">
              {isEditing ? 'Editar Ámbito' : 'Nuevo Ámbito de Evaluación'}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Basic Info */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Nombre del ámbito
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Finanzas, Idiomas, Pareja..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Descripción (opcional)
              </label>
              <AutoResizeTextarea
                minRows={1}
                placeholder="Breve propósito o notas..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Color de identificación
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      color === c ? 'scale-110 border-white ring-2 ring-white/20' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Icon picker */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Ícono
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {AVAILABLE_TOPIC_ICONS.map((item) => {
                  const isSelected = icon === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      title={item.label}
                      aria-label={`Ícono ${item.name}`}
                      onClick={() => setIcon(item.name)}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-400 scale-105 shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/30'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <TopicIcon name={item.name} className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Criteria Items List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Criterios de Ponderación ({items.length})
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Criterio
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 tabular-nums">
                      #{idx + 1}
                    </span>
                    <AutoResizeTextarea
                      minRows={1}
                      placeholder="Nombre del criterio (ej: Salario)"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                      className="flex-1 bg-transparent text-xs font-semibold text-white focus:outline-none focus:border-b focus:border-indigo-500 py-0.5 leading-snug"
                    />

                    {/* Stepper táctil para peso (1 a 10) */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 font-medium select-none">Peso:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Disminuir peso de ${item.name || `criterio ${idx + 1}`}`}
                          disabled={item.defaultWeight <= 1}
                          onClick={() =>
                            handleUpdateItem(idx, 'defaultWeight', Math.max(1, (item.defaultWeight || 1) - 1))
                          }
                          className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-200 transition-all"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span
                          className="w-6 text-center text-xs font-bold text-white tabular-nums select-none"
                          data-testid={`weight-value-${idx}`}
                        >
                          {item.defaultWeight}
                        </span>
                        <button
                          type="button"
                          aria-label={`Aumentar peso de ${item.name || `criterio ${idx + 1}`}`}
                          disabled={item.defaultWeight >= 10}
                          onClick={() =>
                            handleUpdateItem(idx, 'defaultWeight', Math.min(10, (item.defaultWeight || 10) + 1))
                          }
                          className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-200 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        aria-label={`Eliminar criterio ${idx + 1}`}
                        className="text-slate-600 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <AutoResizeTextarea
                    minRows={1}
                    placeholder="Explicación / ayuda memoria (ej: Comparativa con el mercado)"
                    value={item.explanation || ''}
                    onChange={(e) => handleUpdateItem(idx, 'explanation', e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 leading-relaxed"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Footer Submit Button */}
          <div className="pt-3">
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Check className="w-4 h-4" />
              {isEditing ? 'Guardar Cambios' : 'Crear Ámbito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
