import { describe, it, expect } from 'vitest';
import {
  BASE_ASSISTANT_INSTRUCTIONS,
  formatTopicsForSystemPrompt,
  buildSystemPrompt,
} from './systemPrompt';
import { Topic } from '../../types';

describe('systemPrompt - Modular Prompt Builder', () => {
  const sampleTopics: Topic[] = [
    {
      id: 'topic-work',
      name: 'Trabajo / Laboral',
      description: 'Ámbito laboral',
      color: '#6366f1',
      icon: 'Briefcase',
      items: [
        { id: 'w-1', name: 'Salario', explanation: 'Compensación mensual', defaultWeight: 9 },
        { id: 'w-2', name: 'Compañeros', explanation: 'Relación con el equipo', defaultWeight: 8 },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'topic-sport',
      name: 'Natación',
      color: '#06b6d4',
      icon: 'Waves',
      items: [
        { id: 's-1', name: 'Técnica', defaultWeight: 7 },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    },
  ];

  it('contains base assistant principles and JSON draft schema', () => {
    expect(BASE_ASSISTANT_INSTRUCTIONS).toContain('Asistente Reflexivo de RatingsApp');
    expect(BASE_ASSISTANT_INSTRUCTIONS).toContain('draftEvaluation');
    expect(BASE_ASSISTANT_INSTRUCTIONS).toContain('scores');
    expect(BASE_ASSISTANT_INSTRUCTIONS).toContain('justifications');
  });

  it('formats empty topics list gracefully', () => {
    const formatted = formatTopicsForSystemPrompt([]);
    expect(formatted).toBe('No hay ámbitos configurados actualmente.');
  });

  it('formats topics and items clearly with explanations and default weights', () => {
    const formatted = formatTopicsForSystemPrompt(sampleTopics);
    expect(formatted).toContain('Ámbito "Trabajo / Laboral" [ID: "topic-work"]');
    expect(formatted).toContain('- [ID: "w-1"] "Salario" (Peso por defecto: 9/10 - Compensación mensual)');
    expect(formatted).toContain('Ámbito "Natación" [ID: "topic-sport"]');
    expect(formatted).toContain('- [ID: "s-1"] "Técnica" (Peso por defecto: 7/10)');
  });

  it('builds system prompt without focused topic', () => {
    const prompt = buildSystemPrompt(sampleTopics);
    expect(prompt).toContain(BASE_ASSISTANT_INSTRUCTIONS);
    expect(prompt).toContain('Ámbito "Trabajo / Laboral"');
    expect(prompt).not.toContain('Ámbito enfocado actualmente:');
  });

  it('builds system prompt with focused topic and custom instructions', () => {
    const prompt = buildSystemPrompt(
      sampleTopics,
      sampleTopics[0],
      'Sé muy exigente con las justificaciones'
    );
    expect(prompt).toContain('Ámbito enfocado actualmente: "Trabajo / Laboral" [ID: "topic-work"]');
    expect(prompt).toContain('Instrucciones adicionales del usuario:');
    expect(prompt).toContain('Sé muy exigente con las justificaciones');
  });
});
