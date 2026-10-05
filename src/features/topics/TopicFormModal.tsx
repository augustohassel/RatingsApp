import React, { useState } from 'react';
import { Topic, TopicItemDefinition } from '../../types';
import { db } from '../../db';
import { AutoResizeTextarea } from '../../components/common/AutoResizeTextarea';
import { X, Plus, Trash2, Check, Sparkles, Briefcase, Activity, Heart, Target, BookOpen, Smile } from 'lucide-react';

interface TopicFormModalProps {
  topic?: Topic | null;
  onClose: () => void;
  onSaved: () => void;
}

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

  const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

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

    const filteredItems = items.filter((it) => it.name.trim().length > 0);
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
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ backgroundColor: color }}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">
              {isEditing ? 'Editar Ámbito' : 'Nuevo Ámbito de Evaluación'}
            </h3>
          </div>
          <button
            onClick={onClose}
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
              <div className="flex items-center gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      color === c ? 'scale-110 border-white' : 'border-transparent'
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
              <div className="flex items-center gap-2">
                {[
                  { name: 'Briefcase', icon: Briefcase },
                  { name: 'Activity', icon: Activity },
                  { name: 'Heart', icon: Heart },
                  { name: 'Target', icon: Target },
                  { name: 'BookOpen', icon: BookOpen },
                  { name: 'Smile', icon: Smile },
                ].map((item) => {
                  const IconComp = item.icon;
                  const isSelected = icon === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setIcon(item.name)}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-400 scale-105 shadow-md shadow-indigo-600/30'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Peso:</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={item.defaultWeight}
                        onChange={(e) =>
                          handleUpdateItem(idx, 'defaultWeight', Number(e.target.value))
                        }
                        className="w-12 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-center font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
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
