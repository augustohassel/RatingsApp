import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvaluatorView } from './EvaluatorView';
import { db } from '../../db';
import { Topic, EvaluationEntry } from '../../types';

describe('EvaluatorView - Selector de Ámbitos y Criterios', () => {
  const mockTopicWork: Topic = {
    id: 'topic-work',
    name: 'Trabajo',
    description: 'Ámbito laboral',
    color: 'indigo',
    icon: 'Briefcase',
    items: [
      { id: 'crit-w1', name: 'Salario y Beneficios', defaultWeight: 8, explanation: 'Compensación mensual' },
      { id: 'crit-w2', name: 'Relación con el Equipo', defaultWeight: 6, explanation: 'Ambiente diario' },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  };

  const mockTopicSwim: Topic = {
    id: 'topic-swim',
    name: 'Natación',
    description: 'Ámbito deportivo',
    color: 'emerald',
    icon: 'Waves',
    items: [
      { id: 'crit-s1', name: 'Resistencia Aeróbica', defaultWeight: 9, explanation: 'Capacidad pulmonar' },
      { id: 'crit-s2', name: 'Técnica de Crol', defaultWeight: 7, explanation: 'Eficiencia en la brazada' },
    ],
    createdAt: 2000,
    updatedAt: 2000,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.topics.clear();
    await db.evaluations.clear();
    await db.topics.bulkAdd([mockTopicWork, mockTopicSwim]);
  });

  it('permite cambiar libremente de ámbito desde el dropdown sin revertir la selección', async () => {
    const handleSaved = vi.fn();

    render(
      <EvaluatorView
        initialTopicId="topic-work"
        onEvaluationSaved={handleSaved}
      />
    );

    // Esperar a que carguen los temas y se renderice el selector
    const selector = await waitFor(() => {
      const select = screen.getByLabelText(/Seleccionar ámbito/i) as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('topic-work');
      return select;
    });

    // Verificar que inicialmente se ven los criterios de Trabajo
    expect(screen.getByDisplayValue('Salario y Beneficios')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Relación con el Equipo')).toBeInTheDocument();

    // Cambiar el dropdown a Natación
    fireEvent.change(selector, { target: { value: 'topic-swim' } });

    // El valor seleccionado debe ser topic-swim y NO revertirse a topic-work
    await waitFor(() => {
      expect(selector.value).toBe('topic-swim');
    });

    // Deben cargarse reactivamente los criterios de Natación
    await waitFor(() => {
      expect(screen.getByDisplayValue('Resistencia Aeróbica')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Técnica de Crol')).toBeInTheDocument();
    });

    // Los criterios de Trabajo ya no deben estar en pantalla
    expect(screen.queryByDisplayValue('Salario y Beneficios')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Relación con el Equipo')).not.toBeInTheDocument();
  });

  it('selecciona automáticamente el primer ámbito disponible si no se provee initialTopicId', async () => {
    const allTopics = await db.topics.toArray();
    const firstTopic = allTopics[0];
    const secondTopic = allTopics[1];

    render(
      <EvaluatorView
        onEvaluationSaved={vi.fn()}
      />
    );

    const selector = await waitFor(() => {
      const select = screen.getByLabelText(/Seleccionar ámbito/i) as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe(firstTopic.id);
      return select;
    });

    expect(screen.getByDisplayValue(firstTopic.items[0].name)).toBeInTheDocument();

    // Cambiar al segundo ámbito funciona correctamente sin initialTopicId previo
    fireEvent.change(selector, { target: { value: secondTopic.id } });

    await waitFor(() => {
      expect(selector.value).toBe(secondTopic.id);
      expect(screen.getByDisplayValue(secondTopic.items[0].name)).toBeInTheDocument();
    });
  });

  it('mantiene el selector deshabilitado en modo edición histórica para evitar inconsistencias', async () => {
    const historicalEval: EvaluationEntry = {
      id: 'eval-hist-1',
      topicId: 'topic-work',
      date: '2026-10-15T12:00:00.000Z',
      items: [
        {
          itemId: 'crit-w1',
          name: 'Salario y Beneficios',
          weight: 8,
          score: 9,
          percentage: 57.14,
          contribution: 5.14,
        },
      ],
      totalWeight: 8,
      finalScore: 9,
      notes: 'Evaluación pasada',
      createdAt: Date.now() - 50000,
    };

    await db.evaluations.add(historicalEval);

    render(
      <EvaluatorView
        initialTopicId="topic-work"
        editingEvaluationId="eval-hist-1"
        onEvaluationSaved={vi.fn()}
      />
    );

    const selector = await waitFor(() => {
      const select = screen.getByLabelText(/Seleccionar ámbito/i) as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      return select;
    });

    expect(selector).toBeDisabled();
    expect(screen.getByText(/Editando registro histórico/i)).toBeInTheDocument();
  });

  it('guarda la evaluación con el nuevo ámbito tras cambiar la selección en el dropdown', async () => {
    const handleSaved = vi.fn();

    render(
      <EvaluatorView
        initialTopicId="topic-work"
        onEvaluationSaved={handleSaved}
      />
    );

    const selector = await waitFor(() => {
      const select = screen.getByLabelText(/Seleccionar ámbito/i) as HTMLSelectElement;
      expect(select.value).toBe('topic-work');
      return select;
    });

    // Cambiar a Natación
    fireEvent.change(selector, { target: { value: 'topic-swim' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Resistencia Aeróbica')).toBeInTheDocument();
    });

    // Guardar evaluación
    const saveButton = screen.getByRole('button', { name: /Guardar Evaluación/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(handleSaved).toHaveBeenCalledWith('topic-swim');
    });

    const savedEvals = await db.evaluations.toArray();
    expect(savedEvals.length).toBe(1);
    expect(savedEvals[0].topicId).toBe('topic-swim');
    expect(savedEvals[0].items.some((i) => i.name === 'Resistencia Aeróbica')).toBe(true);
  });
});

