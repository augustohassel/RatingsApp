import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { EvaluationEntry } from '../../types';
import { ScoreBadge } from '../../components/common/ScoreBadge';
import { PlusCircle, TrendingUp, TrendingDown, Minus, Briefcase, Activity, Calendar, ArrowRight, Sparkles } from 'lucide-react';

interface DashboardViewProps {
  onStartEvaluation: (topicId: string) => void;
  onViewHistory: (topicId?: string) => void;
  onOpenTopics: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onStartEvaluation,
  onViewHistory,
  onOpenTopics,
}) => {
  const topics = useLiveQuery(() => db.topics.toArray(), []) || [];
  const evaluations = useLiveQuery(() => db.evaluations.orderBy('createdAt').reverse().toArray(), []) || [];

  // Group latest evaluations by topic
  const latestByTopic = React.useMemo(() => {
    const map = new Map<string, { current: EvaluationEntry; previous?: EvaluationEntry }>();
    for (const evalItem of evaluations) {
      if (!map.has(evalItem.topicId)) {
        map.set(evalItem.topicId, { current: evalItem });
      } else {
        const entry = map.get(evalItem.topicId)!;
        if (!entry.previous) {
          entry.previous = evalItem;
        }
      }
    }
    return map;
  }, [evaluations]);

  return (
    <div className="space-y-6 pb-24 max-w-md mx-auto px-4 pt-2">
      {/* Welcome & Motivational Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/20 p-5 shadow-xl">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Panel de Control</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            ¿Cómo te sentís hoy?
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Ponderá lo que realmente te importa y medí tu satisfacción actual sin filtros.
          </p>
        </div>
      </div>

      {/* Topics Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300 tracking-wide uppercase">
            Tus Ámbitos
          </h3>
          <button
            onClick={onOpenTopics}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Administrar ({topics.length})
          </button>
        </div>

        {topics.length === 0 ? (
          <div className="glass-card rounded-2xl p-6 border border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
              <PlusCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">No tienes ningún ámbito creado</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Empieza creando tu primer ámbito (ej: Trabajo, Deportes, Bienestar) para comenzar tus auto-evaluaciones ponderadas.
              </p>
            </div>
            <button
              onClick={onOpenTopics}
              className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 mx-auto shadow-md shadow-indigo-600/30 transition-all"
            >
              <PlusCircle className="w-4 h-4" /> Crear mi primer ámbito
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => {
            const topicEvals = latestByTopic.get(topic.id);
            const latest = topicEvals?.current;
            const previous = topicEvals?.previous;

            let diff = 0;
            if (latest && previous) {
              diff = Math.round((latest.finalScore - previous.finalScore) * 100) / 100;
            }

            return (
              <div
                key={topic.id}
                className="glass-card rounded-2xl p-4 border border-slate-800 hover:border-slate-700/80 transition-all duration-200"
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
                      <h4 className="font-semibold text-white text-base leading-tight">
                        {topic.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {topic.items?.length || 0} criterios de ponderación
                      </p>
                    </div>
                  </div>

                  {latest ? (
                    <div className="text-right">
                      <ScoreBadge score={latest.finalScore} size="md" />
                      {previous && (
                        <div className="flex items-center justify-end gap-1 mt-1 text-[11px] font-medium">
                          {diff > 0 ? (
                            <span className="text-emerald-400 flex items-center">
                              <TrendingUp className="w-3 h-3 mr-0.5" /> +{diff}
                            </span>
                          ) : diff < 0 ? (
                            <span className="text-rose-400 flex items-center">
                              <TrendingDown className="w-3 h-3 mr-0.5" /> {diff}
                            </span>
                          ) : (
                            <span className="text-slate-400 flex items-center">
                              <Minus className="w-3 h-3 mr-0.5" /> 0.0
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium italic">Sin registros</span>
                  )}
                </div>

                {latest && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Calendar className="w-3 h-3" />
                      Última nota: {new Date(latest.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                    <button
                      onClick={() => onViewHistory(topic.id)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                      Ver evolución <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="mt-3 pt-2">
                  <button
                    onClick={() => onStartEvaluation(topic.id)}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    {latest ? 'Nueva Calificación' : 'Comenzar Primera Calificación'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Recent Evaluations Feed */}
      {evaluations.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300 tracking-wide uppercase">
              Actividad Reciente
            </h3>
            <button
              onClick={() => onViewHistory()}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Ver todas ({evaluations.length})
            </button>
          </div>

          <div className="space-y-2">
            {evaluations.slice(0, 3).map((item) => {
              const topic = topics.find((t) => t.id === item.topicId);
              return (
                <div
                  key={item.id}
                  onClick={() => onViewHistory(item.topicId)}
                  className="glass-card rounded-xl p-3 border border-slate-800 hover:border-slate-700/80 transition-all cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-white truncate">
                        {topic?.name || 'Evaluación'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.date).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    {item.notes && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        "{item.notes}"
                      </p>
                    )}
                  </div>
                  <ScoreBadge score={item.finalScore} size="sm" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
