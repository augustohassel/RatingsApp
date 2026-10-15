import { AiSettings, ChatMessage, Topic, ChatDraftEvaluation, ChatDraftEvaluationItem } from '../types';

const STORAGE_KEY = 'ratingsapp_ai_settings';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'gemini',
  apiKey: '',
  modelName: 'gemini-1.5-flash',
  baseUrl: '',
};

export function getAiSettings(): AiSettings {
  if (typeof window === 'undefined') return DEFAULT_AI_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

import {
  buildSystemPrompt,
  BASE_ASSISTANT_INSTRUCTIONS,
  formatTopicsForSystemPrompt,
} from './prompts/systemPrompt';

export {
  buildSystemPrompt,
  BASE_ASSISTANT_INSTRUCTIONS,
  formatTopicsForSystemPrompt,
};

/**
 * Extrae y separa el bloque JSON de draftEvaluation si está presente en la respuesta del modelo
 */
export function extractDraftEvaluation(
  rawText: string,
  topics: Topic[]
): { cleanText: string; draft?: ChatDraftEvaluation } {
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = rawText.match(jsonBlockRegex);

  if (!match) {
    return { cleanText: rawText };
  }

  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed || !parsed.draftEvaluation) {
      return { cleanText: rawText };
    }

    const { topicId, scores, justifications, notes } = parsed.draftEvaluation;
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) {
      return { cleanText: rawText };
    }

    const draftItems: ChatDraftEvaluationItem[] = topic.items.map((itemDef) => {
      const suggestedScore = scores && typeof scores[itemDef.id] === 'number'
        ? Math.max(1, Math.min(10, scores[itemDef.id]))
        : 7;
      const justif = justifications && typeof justifications[itemDef.id] === 'string'
        ? justifications[itemDef.id]
        : undefined;

      return {
        itemId: itemDef.id,
        name: itemDef.name,
        explanation: itemDef.explanation,
        weight: itemDef.defaultWeight || 5,
        score: suggestedScore,
        justification: justif,
      };
    });

    const draft: ChatDraftEvaluation = {
      topicId: topic.id,
      topicName: topic.name,
      items: draftItems,
      notes: typeof notes === 'string' ? notes : undefined,
      confirmed: false,
    };

    // Quitamos el bloque JSON del texto visible para que quede limpio y conversacional
    const cleanText = rawText.replace(match[0], '').trim();

    return { cleanText, draft };
  } catch (err) {
    // Si no es un JSON válido, devolvemos el texto tal cual
    return { cleanText: rawText };
  }
}

/**
 * Envía la conversación al proveedor de IA configurado (Google Gemini u OpenAI/Compatible)
 */
export async function sendChatMessage(
  history: ChatMessage[],
  newMessage: string,
  topics: Topic[],
  currentTopic?: Topic,
  customSettings?: AiSettings
): Promise<{ text: string; draft?: ChatDraftEvaluation }> {
  const settings = customSettings || getAiSettings();

  if (!settings.apiKey && settings.provider !== 'openai') {
    throw new Error('No has configurado una API Key. Ve a Ajustes > Asistente IA para activarlo.');
  }

  const systemPrompt = buildSystemPrompt(topics, currentTopic);

  if (settings.provider === 'gemini') {
    return callGemini(settings, systemPrompt, history, newMessage, topics);
  } else {
    return callOpenAI(settings, systemPrompt, history, newMessage, topics);
  }
}

/**
 * Límite predeterminado de mensajes de historial enviados al modelo para evitar desborde de tokens.
 */
export const MAX_HISTORY_MESSAGES = 10;

export interface PreparedConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Filtra, desduplica y recorta el historial a una ventana deslizante de longitud acotada.
 */
export function prepareHistoryWindow(
  history: ChatMessage[],
  newMessage: string,
  maxMessages: number = MAX_HISTORY_MESSAGES
): PreparedConversationTurn[] {
  const validTurns: PreparedConversationTurn[] = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const trimmedNew = newMessage.trim();
  const lastTurn = validTurns[validTurns.length - 1];

  if (trimmedNew) {
    if (!lastTurn || lastTurn.role !== 'user' || lastTurn.content.trim() !== trimmedNew) {
      validTurns.push({ role: 'user', content: trimmedNew });
    }
  }

  return validTurns.slice(-maxMessages);
}

/**
 * Cliente directo de Google Gemini (v1beta API con soporte direct browser CORS)
 */
async function callGemini(
  settings: AiSettings,
  systemPrompt: string,
  history: ChatMessage[],
  newMessage: string,
  topics: Topic[]
): Promise<{ text: string; draft?: ChatDraftEvaluation }> {
  const model = settings.modelName.trim() || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey.trim()}`;

  const conversationTurns = prepareHistoryWindow(history, newMessage);

  // Formato Gemini contents: role "user" o "model"
  const contents = conversationTurns.map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }],
  }));

  const requestBody = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    let errorDetail = `Error HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // Ignorar si no es json
    }
    throw new Error(`Google Gemini: ${errorDetail}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No obtuve respuesta.';

  const { cleanText, draft } = extractDraftEvaluation(rawText, topics);
  return { text: cleanText || rawText, draft };
}

/**
 * Cliente directo de OpenAI / Compatible (Ollama, LM Studio, etc.)
 */
async function callOpenAI(
  settings: AiSettings,
  systemPrompt: string,
  history: ChatMessage[],
  newMessage: string,
  topics: Topic[]
): Promise<{ text: string; draft?: ChatDraftEvaluation }> {
  let baseUrl = settings.baseUrl?.trim() || 'https://api.openai.com/v1';
  // Quitar trailing slash
  baseUrl = baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const conversationTurns = prepareHistoryWindow(history, newMessage);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationTurns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (settings.apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
  }

  const model = settings.modelName.trim() || 'gpt-4o-mini';

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    let errorDetail = `Error HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // Ignorar
    }
    throw new Error(`Proveedor OpenAI: ${errorDetail}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || 'No obtuve respuesta.';

  const { cleanText, draft } = extractDraftEvaluation(rawText, topics);
  return { text: cleanText || rawText, draft };
}

/**
 * Prueba la conectividad con el proveedor de IA configurado
 */
export async function testAiConnection(settings: AiSettings): Promise<{ success: boolean; message: string }> {
  try {
    if (settings.provider === 'gemini') {
      if (!settings.apiKey.trim()) {
        return { success: false, message: 'La API Key de Gemini es requerida.' };
      }
      const model = settings.modelName.trim() || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Responde brevemente "Conexión exitosa".' }] }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `HTTP ${res.status}` };
      }
      return { success: true, message: '¡Conexión con Google Gemini validada correctamente!' };
    } else {
      let baseUrl = settings.baseUrl?.trim() || 'https://api.openai.com/v1';
      baseUrl = baseUrl.replace(/\/+$/, '');
      const url = `${baseUrl}/chat/completions`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (settings.apiKey?.trim()) {
        headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
      }
      const model = settings.modelName.trim() || 'gpt-4o-mini';
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Responde "OK"' }],
          max_tokens: 10,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `HTTP ${res.status}` };
      }
      return { success: true, message: '¡Conexión con OpenAI / Endpoint validada correctamente!' };
    }
  } catch (error) {
    return { success: false, message: (error as Error).message || 'Error de red o CORS al contactar el servidor.' };
  }
}

