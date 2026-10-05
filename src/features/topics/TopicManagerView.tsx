import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Topic } from '../../types';
import { TopicFormModal } from './TopicFormModal';
import { Plus, Edit2, Trash2, Layers, Briefcase, Activity, CheckCircle2 } from 'lucide-react';

interface TopicManagerViewProps {
  onSelectTopicToEvaluate: (topicId: string) => void;
}

export const TopicManagerView: React.FC<TopicManagerViewProps> = ({
  onSelectTopicToEvaluate,
}) => {
  const topics = useLiveQuery(() => db.topics.toArray(), []) || [];
  const evaluations = useLiveQuery(() => db.evaluations.toArray(), []) || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  const handleEdit = (topic: Topic) => {
    setEditingTopic(topic);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingTopic(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (topicId: string, topicName: string) => {
    const topicEvalsCount = evaluations.filter((e) => e.topicId === topicId).length;
    const msg =
      topicEvalsCount > 0
        ? `¿Eliminar "${topicName}" y sus ${topicEvalsCount} evaluaciones históricas asociadas? Esta acción no se puede deshacer.`
        : `¿Eliminar el ámbito "${topicName}"?`;

    if (confirm(msg)) {
      await db.transaction('rw', db.topics, db.evaluations, async () => {
        await db.topics.delete(topicId);
        await db.evaluations.where('topicId').equals(topicId).delete();
      });
    }
  };

  return (
    <div className="space-y-4 pb-28 max-w-md mx-auto px-4 pt-2">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>Ámbitos de Evaluación</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configurá tus temas y los criterios que los componen.
          </p>
        </div>

        <button
          onClick={handleCreate}
          className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all"
        >
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {/* List of Topics */}
      <div className="space-y-3">
        {topics.map((topic) => {
          const evalCount = evaluations.filter((e) => e.topicId === topic.id).length;
          const totalDefaultWeights = topic.items.reduce((s, it) => s + (it.defaultWeight || 0), 0);

          return (
            <div
              key={topic.id}
              className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3 hover:border-slate-700 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
                    style={{ backgroundColor: topic.color || '#6366f1' }}
                  >
                    {topic.icon === 'Waves' ? (
                      <Activity className="w-5 h-5" />
                    ) : (
                      <Briefcase className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">
                      {topic.name}
                    </h3>
                    {topic.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{topic.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(topic)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Editar ámbito"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {topics.length > 1 && (
                    <button
                      onClick={() => handleDelete(topic.id, topic.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Eliminar ámbito"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Badges / Stats */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
                  {topic.items.length} criterios
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
                  Suma pesos base: {totalDefaultWeights}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
                  {evalCount} evaluaciones
                </span>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onSelectTopicToEvaluate(topic.id)}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-indigo-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Evaluar este ámbito
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <TopicFormModal
          topic={editingTopic}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};
