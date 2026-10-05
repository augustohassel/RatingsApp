import React, { useState, useEffect } from 'react';
import { initializeDatabase } from './db';
import { Header } from './components/layout/Header';
import { BottomNav, NavTab } from './components/layout/BottomNav';
import { DashboardView } from './features/dashboard/DashboardView';
import { EvaluatorView } from './features/evaluator/EvaluatorView';
import { HistoryView } from './features/history/HistoryView';
import { TopicManagerView } from './features/topics/TopicManagerView';
import { SettingsView } from './features/settings/SettingsView';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [activeTopicId, setActiveTopicId] = useState<string | undefined>(undefined);
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    initializeDatabase().then(() => {
      setIsDbReady(true);
    });
  }, []);

  const handleStartEvaluation = (topicId: string) => {
    setActiveTopicId(topicId);
    setCurrentTab('evaluator');
  };

  const handleViewHistory = (topicId?: string) => {
    setActiveTopicId(topicId);
    setCurrentTab('history');
  };

  const handleEvaluationSaved = (topicId: string) => {
    setActiveTopicId(topicId);
    setCurrentTab('history');
  };

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium tracking-wide">Iniciando RatingsApp...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-lg mx-auto">
        {currentTab === 'dashboard' && (
          <DashboardView
            onStartEvaluation={handleStartEvaluation}
            onViewHistory={handleViewHistory}
            onOpenTopics={() => setCurrentTab('topics')}
          />
        )}

        {currentTab === 'evaluator' && (
          <EvaluatorView
            initialTopicId={activeTopicId}
            onEvaluationSaved={handleEvaluationSaved}
          />
        )}

        {currentTab === 'history' && (
          <HistoryView
            initialTopicId={activeTopicId}
            onNewEvaluation={handleStartEvaluation}
          />
        )}

        {currentTab === 'topics' && (
          <TopicManagerView
            onSelectTopicToEvaluate={handleStartEvaluation}
          />
        )}

        {currentTab === 'settings' && <SettingsView />}
      </main>

      <BottomNav currentTab={currentTab} onSelectTab={setCurrentTab} />
    </div>
  );
};

export default App;
