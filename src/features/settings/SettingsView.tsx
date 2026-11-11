import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportBackup, importBackup, resetDatabase, clearAllDatabase } from '../../db';
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
  Bot,
  Key,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getAiSettings, saveAiSettings, testAiConnection } from '../../services/aiService';
import { AiSettings } from '../../types';
import { syncManager, SyncStatusSnapshot } from '../../services/cloudSync/syncService';
import {
  getConfiguredGoogleClientId,
  setGoogleClientIdOverride,
} from '../../services/cloudSync/googleDriveProvider';

export const SettingsView: React.FC = () => {
  const topicsCount = useLiveQuery(() => db.topics.count(), []) || 0;
  const evalsCount = useLiveQuery(() => db.evaluations.count(), []) || 0;

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const [aiSettings, setAiSettings] = useState<AiSettings>(() => getAiSettings());
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [testAiResult, setTestAiResult] = useState<{ success: boolean; message: string } | null>(
    null
  );

  const [syncState, setSyncState] = useState<SyncStatusSnapshot>(() => syncManager.getSnapshot());
  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [showAdvancedSync, setShowAdvancedSync] = useState(false);
  const [customClientId, setCustomClientId] = useState(() => getConfiguredGoogleClientId());

  useEffect(() => {
    setSyncState(syncManager.getSnapshot());
    return syncManager.subscribe(() => {
      setSyncState(syncManager.getSnapshot());
    });
  }, []);

  const runSyncAction = async (action: () => Promise<{ success: boolean; message: string }>) => {
    setIsSyncBusy(true);
    try {
      const res = await action();
      setMessage({ type: res.success ? 'success' : 'error', text: res.message });
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handleConnectDrive = () => runSyncAction(() => syncManager.connectAndSync('select_account'));

  const handleSyncNow = () => runSyncAction(() => syncManager.syncNow({ interactive: true }));

  const handleDisconnectDrive = async () => {
    if (
      confirm(
        '¿Desconectar tu cuenta de Google Drive de este dispositivo? Tus datos locales en IndexedDB y tu archivo en Drive permanecerán intactos.'
      )
    ) {
      await syncManager.disconnect();
      setMessage({ type: 'success', text: 'Cuenta de Google Drive desconectada de este dispositivo.' });
    }
  };

  const handleOverwriteRemote = async () => {
    if (
      confirm(
        '¿Subir y sobrescribir el respaldo en Google Drive con tus datos locales actuales? Esta acción reemplazará el contenido remoto.'
      )
    ) {
      await runSyncAction(() => syncManager.overwriteRemoteWithLocal());
    }
  };

  const handleRestoreFromRemote = async () => {
    if (
      confirm(
        '¿Restaurar desde Google Drive? Se reemplazarán tus ámbitos y evaluaciones locales actuales por los del respaldo en Drive.'
      )
    ) {
      await runSyncAction(() => syncManager.restoreFromRemote());
    }
  };

  const handleSaveClientIdOverride = () => {
    setGoogleClientIdOverride(customClientId);
    syncManager.notify();
    setMessage({
      type: 'success',
      text: customClientId.trim()
        ? 'Client ID de Google guardado localmente.'
        : 'Se restauró el Client ID por defecto.',
    });
  };

  const formatSyncDate = (iso?: string) => {
    if (!iso) return 'Nunca';
    try {
      return new Date(iso).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const handleSaveAiSettings = () => {
    saveAiSettings(aiSettings);
    setMessage({ type: 'success', text: 'Configuración de Asistente IA guardada exitosamente.' });
  };

  const handleTestAi = async () => {
    setIsTestingAi(true);
    setTestAiResult(null);
    try {
      const result = await testAiConnection(aiSettings);
      setTestAiResult(result);
    } finally {
      setIsTestingAi(false);
    }
  };


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

        if (!ev.items || ev.items.length === 0) {
          csv += `"${dateStr}","${topicName}","${ev.finalScore.toFixed(2)}","${ev.totalWeight}","${cleanNotes}","Sensación general","","10","100%","${ev.finalScore}","${ev.finalScore.toFixed(2)}"\n`;
        } else {
          for (const it of ev.items) {
            const cleanExplanation = (it.explanation || '').replace(/"/g, '""');
            csv += `"${dateStr}","${topicName}","${ev.finalScore.toFixed(2)}","${ev.totalWeight}","${cleanNotes}","${it.name}","${cleanExplanation}","${it.weight}","${it.percentage}%","${it.score}","${it.contribution.toFixed(2)}"\n`;
          }
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
        '¡ATENCIÓN! ¿Estás seguro de que deseas eliminar TODOS los datos locales? Esta acción dejará la aplicación en blanco para que puedas armar tus ámbitos y criterios de cero.'
      )
    ) {
      await clearAllDatabase();
      setMessage({
        type: 'success',
        text: 'Se han eliminado todos los datos. La aplicación está lista para crear todo desde cero.',
      });
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
          Tus datos viven localmente en este navegador y podés sincronizarlos opcionalmente con tu propio Google Drive.
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

      {/* Cloud Sync (Google Drive Zero-Backend) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-indigo-400" />
            <span>Sincronización Personal (Google Drive)</span>
          </h3>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
            Zero-Backend
          </span>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3.5">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Respaldá y combiná tus ámbitos y evaluaciones entre dispositivos usando tu propia carpeta{' '}
            <span className="font-mono text-slate-300">RatingsApp/</span> en Google Drive (permiso acotado{' '}
            <span className="font-mono text-slate-300">drive.file</span>). Tus claves BYOK y mensajes de chat nunca se suben.
          </p>

          {/* Estado de conexión y pendientes */}
          <div className="bg-slate-900/70 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Estado</span>
              {syncState.status === 'offline' ? (
                <span className="text-slate-300 font-semibold flex items-center gap-1">
                  <CloudOff className="w-3.5 h-3.5 text-slate-400" /> Modo Offline
                </span>
              ) : syncState.isConnected ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {syncState.accountEmail || 'Conectada'}
                </span>
              ) : (
                <span className="text-slate-400 font-medium">Desconectada</span>
              )}
            </div>

            {syncState.isConnected && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Última sincronización</span>
                  <span className="text-slate-200 font-medium">
                    {formatSyncDate(syncState.lastSyncAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Cambios locales</span>
                  <span
                    className={`font-medium ${
                      syncState.hasPendingChanges ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {syncState.hasPendingChanges ? 'Pendientes de sincronizar' : 'Al día'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Alerta accionable si hay error de sync */}
          {syncState.lastError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{syncState.lastError.message}</span>
              </div>
              {(syncState.lastError.code === 'TOKEN_EXPIRED' ||
                syncState.lastError.code === 'FORBIDDEN' ||
                syncState.lastError.code === 'AUTH_DENIED' ||
                syncState.lastError.code === 'AUTH_REQUIRED') && (
                <button
                  type="button"
                  onClick={handleConnectDrive}
                  disabled={isSyncBusy}
                  className="w-full py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold transition-colors"
                >
                  Reautenticar con Google
                </button>
              )}
              {(syncState.lastError.code === 'NOT_FOUND' ||
                syncState.lastError.code === 'INVALID_BACKUP') && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleOverwriteRemote}
                    disabled={isSyncBusy}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-200 font-semibold transition-colors"
                  >
                    Recrear respaldo en Drive
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectDrive}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                  >
                    Desconectar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Acciones principales */}
          {!syncState.isConnected ? (
            <button
              type="button"
              onClick={handleConnectDrive}
              disabled={isSyncBusy || !syncState.isConfigured}
              className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-colors"
            >
              <Cloud className="w-4 h-4" />
              <span>
                {isSyncBusy
                  ? 'Conectando...'
                  : syncState.isConfigured
                  ? 'Conectar con Google Drive'
                  : 'Configurá un Client ID para conectar'}
              </span>
            </button>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncBusy || syncState.status === 'syncing'}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-colors"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isSyncBusy || syncState.status === 'syncing' ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {isSyncBusy || syncState.status === 'syncing'
                      ? 'Sincronizando...'
                      : 'Sincronizar ahora'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectDrive}
                  disabled={isSyncBusy}
                  title="Desconectar Google Drive"
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              </div>

              {/* Toggle auto-sync oportunista */}
              <label className="flex items-center justify-between gap-3 bg-slate-900/50 rounded-xl px-3 py-2 border border-slate-800/80 cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Auto-sincronización en primer plano
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Sincroniza al abrir la app o guardar cambios cuando hay red y sesión vigente.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={syncState.autoSyncEnabled}
                  onChange={(e) => syncManager.setAutoSyncEnabled(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer shrink-0"
                />
              </label>
            </div>
          )}

          {/* Opciones avanzadas y recuperación explícita */}
          <div className="pt-1 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowAdvancedSync((prev) => !prev)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-400 hover:text-slate-200 py-1 transition-colors"
            >
              <span>Recuperación y opciones avanzadas</span>
              {showAdvancedSync ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showAdvancedSync && (
              <div className="space-y-3 pt-2.5">
                {syncState.isConnected && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleOverwriteRemote}
                      disabled={isSyncBusy}
                      className="py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-[11px] font-semibold transition-colors disabled:opacity-50"
                    >
                      Subir y sobrescribir nube
                    </button>
                    <button
                      type="button"
                      onClick={handleRestoreFromRemote}
                      disabled={isSyncBusy}
                      className="py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-300 text-[11px] font-semibold transition-colors disabled:opacity-50"
                    >
                      Restaurar desde nube
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300 block">
                    Google OAuth Client ID (Opcional / Avanzado)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customClientId}
                      onChange={(e) => setCustomClientId(e.target.value)}
                      placeholder="123456-abc.apps.googleusercontent.com"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSaveClientIdOverride}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Assistant Settings (BYOK) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span>Asistente Conversacional (IA / BYOK)</span>
          </h3>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
            Zero-Backend
          </span>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-4">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Traé tu propia clave de API (Bring Your Own Key) para habilitar el asistente reflexivo guiado. La clave se almacena exclusivamente en este navegador y viaja directo al proveedor sin intermediarios.
          </p>

          {/* Selector de Proveedor */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Proveedor de IA</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setAiSettings((prev) => ({
                    ...prev,
                    provider: 'gemini',
                    modelName: prev.provider === 'gemini' ? prev.modelName : 'gemini-1.5-flash',
                  }))
                }
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  aiSettings.provider === 'gemini'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Google Gemini
              </button>
              <button
                type="button"
                onClick={() =>
                  setAiSettings((prev) => ({
                    ...prev,
                    provider: 'openai',
                    modelName: prev.provider === 'openai' ? prev.modelName : 'gpt-4o-mini',
                  }))
                }
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  aiSettings.provider === 'openai'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                OpenAI / Compatible
              </button>
            </div>
          </div>

          {/* Input API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>API Key {aiSettings.provider === 'openai' && aiSettings.baseUrl ? '(Opcional si es Ollama)' : ''}</span>
              </label>
              {aiSettings.provider === 'gemini' && (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-medium"
                >
                  Obtener gratis en Google AI Studio
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={aiSettings.apiKey}
                onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                placeholder={
                  aiSettings.provider === 'gemini'
                    ? 'AIzaSy...'
                    : 'sk-proj-...'
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Nombre de Modelo */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              <span>Modelo</span>
            </label>
            <input
              type="text"
              value={aiSettings.modelName}
              onChange={(e) => setAiSettings({ ...aiSettings, modelName: e.target.value })}
              placeholder={aiSettings.provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini'}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Base URL (Para OpenAI / Ollama) */}
          {aiSettings.provider === 'openai' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                <span>Base URL (Opcional para Ollama o local)</span>
              </label>
              <input
                type="text"
                value={aiSettings.baseUrl || ''}
                onChange={(e) => setAiSettings({ ...aiSettings, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1 (o http://localhost:11434/v1)"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          )}

          {/* Feedback de prueba */}
          {testAiResult && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                testAiResult.success
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              }`}
            >
              {testAiResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{testAiResult.message}</span>
            </div>
          )}

          {/* Acciones Probar y Guardar */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleTestAi}
              disabled={isTestingAi}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isTestingAi ? 'Probando...' : 'Probar Conexión'}
            </button>
            <button
              type="button"
              onClick={handleSaveAiSettings}
              className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-colors"
            >
              Guardar Configuración
            </button>
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
          Esta aplicación opera de forma local-first mediante IndexedDB sin backend del desarrollador. Si activás la sincronización opcional, tus ámbitos y evaluaciones viajan directo a tu propio Google Drive (nunca tus claves de IA ni chats).
        </p>
      </div>

      {/* App Version Info */}
      <div className="pt-2 pb-6 text-center">
        <p className="text-[11px] font-mono text-slate-500">
          RatingsApp <span className="text-slate-400 font-semibold">v{__APP_VERSION__}</span> • PWA Local
        </p>
      </div>
    </div>
  );
};
