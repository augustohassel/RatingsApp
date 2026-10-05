import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportBackup, importBackup, resetDatabase } from '../../db';
import {
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  FileSpreadsheet,
  Trash2,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const topicsCount = useLiveQuery(() => db.topics.count(), []) || 0;
  const evalsCount = useLiveQuery(() => db.evaluations.count(), []) || 0;

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const handleExportJSON = async () => {
    try {
      const json = await exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ratingsapp-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Copia de seguridad descargada exitosamente en JSON.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al exportar los datos.' });
    }
  };

  const handleExportCSV = async () => {
    try {
      const evaluations = await db.evaluations.toArray();
      const topics = await db.topics.toArray();
      const topicMap = new Map(topics.map((t) => [t.id, t.name]));

      // CSV Header
      let csv = 'Fecha,Ambito,Nota Final,Suma Pesos,Notas del Dia,Criterio,Explicacion,Ponderacion,Porcentaje,Nota Nominal,Aporte\n';

      for (const ev of evaluations) {
        const topicName = topicMap.get(ev.topicId) || 'Ambito';
        const dateStr = new Date(ev.date).toLocaleDateString('es-ES');
        const cleanNotes = (ev.notes || '').replace(/"/g, '""');

        for (const it of ev.items) {
          const cleanExplanation = (it.explanation || '').replace(/"/g, '""');
          csv += `"${dateStr}","${topicName}","${ev.finalScore.toFixed(2)}","${ev.totalWeight}","${cleanNotes}","${it.name}","${cleanExplanation}","${it.weight}","${it.percentage}%","${it.score}","${it.contribution.toFixed(2)}"\n`;
        }
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ratingsapp-evaluaciones-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Planilla CSV exportada para Excel / Google Sheets.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al generar el archivo CSV.' });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const res = await importBackup(content);
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleReset = async () => {
    if (
      confirm(
        '¿Restablecer la aplicación al estado inicial? Se mantendrán las plantillas de Trabajo y Natación y se restaurarán los valores por defecto.'
      )
    ) {
      await resetDatabase();
      setMessage({ type: 'success', text: 'Base de datos restaurada al estado inicial con éxito.' });
    }
  };

  const handleClearAll = async () => {
    if (
      confirm(
        '¡ATENCIÓN! ¿Estás seguro de que deseas eliminar TODOS los datos locales? Esta acción es irreversible.'
      )
    ) {
      await db.transaction('rw', db.topics, db.evaluations, async () => {
        await db.topics.clear();
        await db.evaluations.clear();
      });
      setMessage({ type: 'success', text: 'Se han eliminado todos los datos locales.' });
    }
  };

  return (
    <div className="space-y-5 pb-28 max-w-md mx-auto px-4 pt-2">
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-indigo-400" />
          <span>Configuración & Datos</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Tus datos se almacenan exclusivamente en este navegador.
        </p>
      </div>

      {/* Notification banner */}
      {message && (
        <div
          className={`p-3 rounded-2xl text-xs flex items-center justify-between border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Storage info card */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Almacenamiento Local</span>
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> IndexedDB Activo
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Ámbitos
            </span>
            <span className="text-lg font-bold text-white">{topicsCount}</span>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Evaluaciones
            </span>
            <span className="text-lg font-bold text-indigo-400">{evalsCount}</span>
          </div>
        </div>
      </div>

      {/* Backup and export actions */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Copias de Seguridad & Exportación
        </h3>

        <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-2.5">
          <button
            onClick={handleExportJSON}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-white text-xs font-semibold flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-400" />
              Exportar Backup Completo (JSON)
            </span>
            <span className="text-[10px] text-slate-400">Restaurable</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-white text-xs font-semibold flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Exportar para Excel / Google Sheets (CSV)
            </span>
            <span className="text-[10px] text-slate-400">Planilla</span>
          </button>

          <label className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-white text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors">
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" />
              Restaurar Backup desde JSON
            </span>
            <span className="text-[10px] text-slate-400">Seleccionar</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-rose-400/80 uppercase tracking-wider">
          Zona de Mantenimiento
        </h3>

        <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-2">
          <button
            onClick={handleReset}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              Restablecer plantilla inicial (Google Sheets)
            </span>
          </button>

          <button
            onClick={handleClearAll}
            className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              Borrar todos los datos locales
            </span>
          </button>
        </div>
      </div>

      {/* Privacy Guarantee */}
      <div className="rounded-2xl bg-indigo-950/20 border border-indigo-500/20 p-4 space-y-1.5 text-center">
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <h4 className="text-xs font-bold text-white">Privacidad 100% Garantizada</h4>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Esta aplicación opera de forma totalmente local en tu dispositivo mediante IndexedDB. Ningún dato se envía ni se almacena en ningún servidor.
        </p>
      </div>
    </div>
  );
};
