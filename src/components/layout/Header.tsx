import React from 'react';
import { Sparkles, ShieldCheck, MessageSquare } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onOpenChat?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title = 'RatingsApp', subtitle, onOpenChat }) => {
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
              <div className="flex items-center gap-1 text-[11px] text-emerald-400/90 font-medium">
                <ShieldCheck className="w-3 h-3" />
                <span>100% Local y Privado</span>
              </div>
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

