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

/**
 * Genera el System Prompt de RatingsApp para guiar la conversación
 */
export function buildSystemPrompt(topics: Topic[], currentTopic?: Topic): string {
  const topicsSummary = topics
    .map((t) => {
      const itemsList = t.items
        .map((it) => `  - [ID: "${it.id}"] "${it.name}" (Peso por defecto: ${it.defaultWeight}/10${it.explanation ? ` - ${it.explanation}` : ''})`)
        .join('\n');
      return `Ámbito "${t.name}" [ID: "${t.id}"]:\n${itemsList}`;
    })
    .join('\n\n');

  return `Eres el Asistente Reflexivo de RatingsApp, una aplicación privada de evaluación y puntuación personal ponderada.
Tu objetivo es escuchar al usuario reflexionar sobre su jornada, dialogar empáticamente y ayudarle a descomponer su día en valoraciones cuantitativas justas (escala de 1 a 10).

Tus principios de interacción:
1. Sé cálido, conciso, introspectivo y constructivo. No des discursos largos.
2. Si el usuario te cuenta sobre su día o vivencias en un ámbito, haz preguntas breves de profundización si hace falta, o propón calificaciones para cada uno de los criterios.
3. Las notas siempre son en escala de 1 a 10 (se admiten decimales como 7.5 u 8).
4. Cuando consideres que tienes elementos suficientes para proponer una evaluación (o cuando el usuario te pida evaluar un ámbito), responde con tu análisis conversacional y al final incluye OBLIGATORIAMENTE un bloque de código JSON con el siguiente formato exacto:

\`\`\`json
{
  "draftEvaluation": {
    "topicId": "<ID_DEL_AMBITO>",
    "scores": {
      "<ITEM_ID_1>": 8,
      "<ITEM_ID_2>": 7.5
    },
    "justifications": {
      "<ITEM_ID_1>": "Breve justificación de por qué sugeriste esta nota",
      "<ITEM_ID_2>": "Breve justificación"
    },
    "notes": "Reflexión o resumen síntesis de la jornada"
  }
}
\`\`\`

Ámbitos y criterios disponibles en RatingsApp:
${topicsSummary}

${currentTopic ? `Ámbito enfocado actualmente: "${currentTopic.name}" [ID: "${currentTopic.id}"]` : ''}
`;
}

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

  // Formato Gemini contents: role "user" o "model"
  const contents = [
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    {
      role: 'user',
      parts: [{ text: newMessage }],
    },
  ];

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

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: m.content,
      })),
    { role: 'user', content: newMessage },
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

