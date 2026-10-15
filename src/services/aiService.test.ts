import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_AI_SETTINGS,
  getAiSettings,
  saveAiSettings,
  buildSystemPrompt,
  extractDraftEvaluation,
  sendChatMessage,
  testAiConnection,
} from './aiService';
import { Topic, ChatMessage } from '../types';

const sampleTopics: Topic[] = [
  {
    id: 'topic-work',
    name: 'Trabajo',
    description: 'Ámbito laboral',
    color: '#6366f1',
    icon: 'Briefcase',
    items: [
      { id: 'w-1', name: 'Salario', explanation: 'Remuneración justa', defaultWeight: 9 },
      { id: 'w-2', name: 'Compañeros', explanation: 'Clima diario', defaultWeight: 8 },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  },
];

describe('aiService - Settings persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default settings when storage is empty', () => {
    const settings = getAiSettings();
    expect(settings).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('saves and retrieves updated AI settings', () => {
    saveAiSettings({
      provider: 'openai',
      apiKey: 'sk-test-12345',
      modelName: 'gpt-4o',
      baseUrl: 'http://localhost:11434/v1',
    });

    const loaded = getAiSettings();
    expect(loaded.provider).toBe('openai');
    expect(loaded.apiKey).toBe('sk-test-12345');
    expect(loaded.modelName).toBe('gpt-4o');
    expect(loaded.baseUrl).toBe('http://localhost:11434/v1');
  });
});

describe('aiService - Prompt generation and extraction', () => {
  it('builds system prompt containing topics and items', () => {
    const prompt = buildSystemPrompt(sampleTopics, sampleTopics[0]);
    expect(prompt).toContain('RatingsApp');
    expect(prompt).toContain('Trabajo');
    expect(prompt).toContain('Salario');
    expect(prompt).toContain('draftEvaluation');
    expect(prompt).toContain('Ámbito enfocado actualmente: "Trabajo"');
  });

  it('extracts draft evaluation from valid markdown JSON block', () => {
    const rawResponse = `Tu jornada suena bastante positiva. Aquí tienes mi propuesta:

\`\`\`json
{
  "draftEvaluation": {
    "topicId": "topic-work",
    "scores": {
      "w-1": 8,
      "w-2": 9
    },
    "justifications": {
      "w-1": "Buen reconocimiento",
      "w-2": "Gran sinergia con el equipo"
    },
    "notes": "Jornada muy productiva"
  }
}
\`\`\`

¿Te parece bien esta puntuación?`;

    const { cleanText, draft } = extractDraftEvaluation(rawResponse, sampleTopics);

    expect(cleanText).not.toContain('```json');
    expect(cleanText).toContain('Tu jornada suena bastante positiva');
    expect(cleanText).toContain('¿Te parece bien esta puntuación?');

    expect(draft).toBeDefined();
    expect(draft?.topicId).toBe('topic-work');
    expect(draft?.topicName).toBe('Trabajo');
    expect(draft?.items).toHaveLength(2);
    expect(draft?.items[0].score).toBe(8);
    expect(draft?.items[0].justification).toBe('Buen reconocimiento');
    expect(draft?.items[1].score).toBe(9);
    expect(draft?.items[1].justification).toBe('Gran sinergia con el equipo');
    expect(draft?.notes).toBe('Jornada muy productiva');
  });

  it('clamps scores between 1 and 10', () => {
    const rawResponse = `
\`\`\`json
{
  "draftEvaluation": {
    "topicId": "topic-work",
    "scores": {
      "w-1": 15,
      "w-2": -5
    }
  }
}
\`\`\``;

    const { draft } = extractDraftEvaluation(rawResponse, sampleTopics);
    expect(draft?.items[0].score).toBe(10);
    expect(draft?.items[1].score).toBe(1);
  });

  it('handles responses without JSON gracefully', () => {
    const rawResponse = 'Hola, ¿cómo estuvo tu día laboral hoy?';
    const { cleanText, draft } = extractDraftEvaluation(rawResponse, sampleTopics);
    expect(cleanText).toBe(rawResponse);
    expect(draft).toBeUndefined();
  });

  it('handles invalid JSON gracefully without throwing', () => {
    const rawResponse = '```json\n{ invalid json content }\n```';
    const { cleanText, draft } = extractDraftEvaluation(rawResponse, sampleTopics);
    expect(cleanText).toBe(rawResponse);
    expect(draft).toBeUndefined();
  });
});

describe('aiService - Provider HTTP Calls (Mocked fetch)', () => {
  const history: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Hola', timestamp: 1000 },
  ];

  it('throws when apiKey is missing', async () => {
    await expect(
      sendChatMessage(history, 'Test', sampleTopics, undefined, {
        provider: 'gemini',
        apiKey: '',
        modelName: 'gemini-1.5-flash',
      })
    ).rejects.toThrow('No has configurado una API Key');
  });

  it('calls Gemini endpoint and processes response', async () => {
    const mockResponseText = 'Me alegra saberlo. Todo marcha bien.';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: mockResponseText }],
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendChatMessage(history, 'Mi día fue bueno', sampleTopics, undefined, {
      provider: 'gemini',
      apiKey: 'test-key-gemini',
      modelName: 'gemini-1.5-flash',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
    expect(result.text).toBe(mockResponseText);

    vi.unstubAllGlobals();
  });

  it('calls OpenAI compatible endpoint and handles custom baseUrl', async () => {
    const mockResponseText = 'Entendido, excelente día.';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: mockResponseText,
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendChatMessage(history, 'Buen avance', sampleTopics, undefined, {
      provider: 'openai',
      apiKey: 'test-key-openai',
      modelName: 'llama3:8b',
      baseUrl: 'http://localhost:11434/v1/',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:11434/v1/chat/completions');
    expect(result.text).toBe(mockResponseText);

    vi.unstubAllGlobals();
  });

  it('tests connection to Gemini successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await testAiConnection({
      provider: 'gemini',
      apiKey: 'valid-key',
      modelName: 'gemini-1.5-flash',
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain('Google Gemini');

    vi.unstubAllGlobals();
  });

  it('reports failure when test connection fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'API_KEY_INVALID' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await testAiConnection({
      provider: 'gemini',
      apiKey: 'invalid-key',
      modelName: 'gemini-1.5-flash',
    });

    expect(res.success).toBe(false);
    expect(res.message).toBe('API_KEY_INVALID');

    vi.unstubAllGlobals();
  });
});

