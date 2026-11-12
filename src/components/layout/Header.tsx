import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, MessageSquare, Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { syncManager, SyncStatusSnapshot } from '../../services/cloudSync/syncService';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onOpenChat?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title = 'RatingsApp', subtitle, onOpenChat }) => {
  const [syncState, setSyncState] = useState<SyncStatusSnapshot>(() => syncManager.getSnapshot());

  useEffect(() => {
    setSyncState(syncManager.getSnapshot());
    return syncManager.subscribe(() => {
      setSyncState(syncManager.getSnapshot());
    });
  }, []);

  const renderStatusLine = () => {
    if (!syncState.isConnected) {
      return (
        <div className="flex items-center gap-1 text-[11px] text-emerald-400/90 font-medium">
          <ShieldCheck className="w-3 h-3" />
          <span>100% Local y Privado</span>
        </div>
      );
    }

    if (syncState.status === 'syncing') {
      return (
        <div className="flex items-center gap-1 text-[11px] text-indigo-300 font-medium">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Local · Sincronizando Drive...</span>
        </div>
      );
    }

    if (syncState.status === 'offline') {
      return (
        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
          <CloudOff className="w-3 h-3" />
          <span>Local · Offline{syncState.hasPendingChanges ? ' (pendiente)' : ''}</span>
        </div>
      );
    }

    if (syncState.status === 'error') {
      return (
        <div
          className="flex items-center gap-1 text-[11px] text-amber-400 font-medium"
          title={syncState.lastError?.message}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>Local · Sync Drive pendiente</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-[11px] text-emerald-400/90 font-medium">
        <Cloud className="w-3 h-3" />
        <span>
          Local · {syncState.hasPendingChanges ? 'Drive (cambios pendientes)' : 'Drive sincronizado'}
        </span>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-slate-800/80 px-4 py-3 sm:px-6">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-xs text-slate-400">{subtitle}</p>
            ) : (
              renderStatusLine()
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenChat && (
            <button
              onClick={onOpenChat}
              title="Abrir Chat Reflexivo"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-indigo-400 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}
          <span 
            className="text-[10px] font-mono font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60 shadow-sm"
            title={`Versión instalada: v${__APP_VERSION__}`}
          >
            v{__APP_VERSION__}
          </span>
        </div>
      </div>
    </header>
  );
};

