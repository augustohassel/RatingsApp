import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import confetti from 'canvas-confetti';
import { db } from '../../db';
import {
  ChatMessage,
  DAILY_MOOD_TOPIC_ID,
  EvaluationEntry,
} from '../../types';
import { parseQuickMoodCommand } from '../../utils/commandParser';
import {
  sendChatMessage,
  getAiSettings,
} from '../../services/aiService';
import { createIsoFromLocalDate, toLocalDateString } from '../../utils/calculator';
import { DraftEvaluationCard } from './DraftEvaluationCard';
import {
  Send,
  Sparkles,
  Trash2,
  Settings as SettingsIcon,
  Bot,
  User,
  Heart,
  Briefcase,
  TrendingUp,
  Mic,
  MicOff,
} from 'lucide-react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';


interface ChatViewProps {
  onOpenSettings: () => void;
  onNavigateToHistory: (topicId?: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ onOpenSettings, onNavigateToHistory }) => {
  const messages = useLiveQuery(() => db.chatMessages.orderBy('timestamp').toArray(), []) || [];
  const topics = useLiveQuery(() => db.topics.toArray(), []) || [];

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isSupported: isSpeechSupported,
    isListening,
    error: speechError,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    onResult: (text) => {
      setInputText((prev) => {
        if (!prev) return text;
        if (prev.endsWith(' ')) return `${prev}${text}`;
        return `${prev} ${text}`;
      });
    },
  });



  const aiSettings = getAiSettings();
  const hasAiConfigured = Boolean(aiSettings.apiKey?.trim() || (aiSettings.provider === 'openai' && aiSettings.baseUrl?.trim()));

  const customTopics = topics.filter((t) => t.id !== DAILY_MOOD_TOPIC_ID);
  const currentFocusedTopic = customTopics.find((t) => t.id === selectedTopicId);

  // Auto-scroll al final del chat
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length, isLoading]);

  // Mensaje de bienvenida inicial si el chat está vacío
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'msg-welcome',
        role: 'assistant',
        content: `👋 **¡Hola! Bienvenido a tu espacio reflexivo.**

Soy tu asistente local de RatingsApp. Puedes usarme de dos formas:

1. **Check-in rápido (100% Offline)**:
   Escribe directamente cómo te sientes hoy, por ejemplo:
   - *"hoy me siento un 8"*
   - *"nota de hoy 9: logré cerrar el proyecto"*
   - *"sensación del día 7.5 - algo cansado pero contento"*
   Se registrará de inmediato en tu sensación diaria sin consumir red.

2. **Evaluación reflexiva guiada (BYOK)**:
   Cuéntame sobre tu jornada (ej. en Trabajo o Natación) y te ayudaré a desglosar las notas y justificaciones de cada criterio para generar un borrador editable.`,
        timestamp: Date.now(),
      };
      db.chatMessages.add(welcomeMessage);
    }
  }, [messages.length]);

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : inputText;
    const trimmed = rawText.trim();
    if (!trimmed || isLoading) return;

    setInputText('');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    await db.chatMessages.add(userMsg);

    // 1. Probar si coincide con el parser de comandos rápidos (Offline)
    const quickResult = parseQuickMoodCommand(trimmed);
    if (quickResult.isMatch && typeof quickResult.score === 'number') {
      const todayStr = toLocalDateString(new Date());
      const isoDate = createIsoFromLocalDate(todayStr, new Date());
      const score = quickResult.score;

      const newMoodEntry: EvaluationEntry = {
        id: `mood-${Date.now()}`,
        topicId: DAILY_MOOD_TOPIC_ID,
        date: isoDate,
        items: [
          {
            itemId: 'dm-1',
            name: 'Sensación general',
            weight: 10,
            percentage: 100,
            score: score,
            contribution: score,
          },
        ],
        totalWeight: 10,
        finalScore: score,
        notes: quickResult.notes,
        createdAt: Date.now(),
      };

      await db.evaluations.add(newMoodEntry);

      if (score >= 7) {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#10b981', '#6366f1', '#ec4899'],
        });
      }

      const replyContent = `✨ **¡Sensación diaria guardada con éxito!**
- **Nota registrada**: **${score} / 10**
${quickResult.notes ? `- **Reflexión**: _"${quickResult.notes}"_\n` : ''}
El registro ya impactó en tu historial y en tu matriz anual de bienestar.`;

      const botMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: replyContent,
        timestamp: Date.now() + 1,
      };

      await db.chatMessages.add(botMsg);
      return;
    }

    // 2. Si no es comando rápido y no hay IA configurada, orientar al usuario
    if (!hasAiConfigured) {
      const botMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: `Para mantener conversaciones abiertas y evaluar ámbitos guiados por IA, necesitas configurar tu propia API Key (Google Gemini, OpenAI o endpoint local Ollama) en **Ajustes > Asistente IA (BYOK)**.

💡 **Recordatorio**: Para registrar tu sensación diaria sin ninguna clave ni conexión a internet, prueba con frases como:
- *"hoy me siento un 8"*
- *"sensación 7.5: buen día"*`,
        timestamp: Date.now() + 1,
      };
      await db.chatMessages.add(botMsg);
      return;
    }

    // 3. Invocar Asistente IA con BYOK
    setIsLoading(true);
    try {
      const historyForAi = [...messages, userMsg];
      const response = await sendChatMessage(
        historyForAi,
        trimmed,
        customTopics,
        currentFocusedTopic
      );

      const botMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: response.text,
        timestamp: Date.now() + 1,
        draftEvaluation: response.draft,
      };

      await db.chatMessages.add(botMsg);
    } catch (err) {
      const errorText = (err as Error).message || 'Error al comunicarse con el asistente de IA.';
      const botMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `⚠️ **Ocurrió un inconveniente al consultar la IA**:
${errorText}

Por favor verifica tu conexión y la configuración de tu clave en Ajustes.`,
        timestamp: Date.now() + 1,
      };
      await db.chatMessages.add(botMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDraft = async (messageId: string, evaluation: EvaluationEntry) => {
    await db.evaluations.add(evaluation);

    // Actualizar el mensaje para marcar el draft como confirmado
    const msg = await db.chatMessages.get(messageId);
    if (msg && msg.draftEvaluation) {
      await db.chatMessages.update(messageId, {
        draftEvaluation: { ...msg.draftEvaluation, confirmed: true },
      });
    }
  };

  const handleClearChat = async () => {
    if (window.confirm('¿Deseas vaciar el historial de conversación? Esta acción no borra tus notas ni tu historial de evaluaciones.')) {
      await db.chatMessages.clear();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-lg mx-auto pb-20">
      {/* Barra superior de contexto y acciones */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-0.5">
          <button
            onClick={() => setSelectedTopicId('')}
            className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-all ${
              selectedTopicId === ''
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            General
          </button>
          {customTopics.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTopicId(t.id)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-all ${
                selectedTopicId === t.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onNavigateToHistory(selectedTopicId || undefined)}
            title="Ver Historial"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <button
            onClick={handleClearChat}
            title="Vaciar conversación"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSettings}
            title="Configurar Asistente IA"
            className={`p-1.5 rounded-lg transition-colors ${
              hasAiConfigured
                ? 'text-indigo-400 hover:bg-slate-800/80'
                : 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Historial de Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex gap-2.5 max-w-[92%] ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm ${
                  isUser
                    ? 'bg-indigo-600'
                    : 'bg-gradient-to-tr from-violet-600 to-indigo-500'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div className="space-y-1">
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-md ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </div>

                {/* Tarjeta interactiva de borrador si el asistente la generó */}
                {m.draftEvaluation && (
                  <DraftEvaluationCard
                    draft={m.draftEvaluation}
                    onConfirm={(evaluation) => handleConfirmDraft(m.id, evaluation)}
                  />
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-2.5 mr-auto max-w-[90%]">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shrink-0 text-white shadow-sm">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
              <span className="text-xs text-slate-400 ml-1 font-medium">Pensando...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sugerencias Rápidas */}
      <div className="px-4 py-1.5 flex gap-2 overflow-x-auto custom-scrollbar shrink-0">
        <button
          onClick={() => handleSendMessage('hoy me siento un 8')}
          className="text-[11px] bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>hoy me siento un 8</span>
        </button>
        <button
          onClick={() => handleSendMessage('hoy me siento un 6: cansado y con poco sueño')}
          className="text-[11px] bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors flex items-center gap-1"
        >
          <Heart className="w-3 h-3 text-pink-400" />
          <span>me siento 6: cansado</span>
        </button>
        <button
          onClick={() => handleSendMessage('Quiero evaluar mi jornada laboral de hoy')}
          className="text-[11px] bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors flex items-center gap-1"
        >
          <Briefcase className="w-3 h-3 text-indigo-400" />
          <span>Evaluar jornada laboral</span>
        </button>
      </div>

      {/* Barra de Entrada / Input Móvil */}
      <div className="px-4 pt-1 pb-2 shrink-0 space-y-1">
        {isListening && (
          <div className="flex items-center gap-2 text-[11px] text-rose-400 font-medium px-2 py-0.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Escuchando... Di algo como "hoy me siento un 8" o cuéntame tu día</span>
          </div>
        )}
        {speechError && (
          <div className="text-[11px] text-amber-400/90 px-2 py-0.5">
            ⚠️ {speechError}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isListening) stopListening();
            handleSendMessage();
          }}
          className="relative flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-1.5 focus-within:border-indigo-500/80 transition-colors shadow-lg gap-1"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (isListening) stopListening();
                handleSendMessage();
              }
            }}
            placeholder={
              isListening
                ? 'Escuchando tu voz...'
                : hasAiConfigured
                ? 'Escribe o dicta tu sensación del día...'
                : 'Registra tu sensación (ej: "hoy me siento un 8")...'
            }
            className="w-full bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 px-3 py-1.5 focus:outline-none resize-none max-h-24 custom-scrollbar"
          />

          {isSpeechSupported && (
            <button
              type="button"
              onClick={() => {
                if (isListening) {
                  stopListening();
                } else {
                  startListening();
                }
              }}
              title={isListening ? 'Detener dictado por voz' : 'Dictar por voz'}
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                  : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white flex items-center justify-center shrink-0 disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
};
