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

    // Verificar que inicialmente se ven los criterios de Trabajo como texto estático
    await waitFor(() => {
      expect(screen.getByText('Salario y Beneficios')).toBeInTheDocument();
      expect(screen.getByText('Relación con el Equipo')).toBeInTheDocument();
    });

    // Cambiar el dropdown a Natación
    fireEvent.change(selector, { target: { value: 'topic-swim' } });

    // El valor seleccionado debe ser topic-swim y NO revertirse a topic-work
    await waitFor(() => {
      expect(selector.value).toBe('topic-swim');
    });

    // Deben cargarse reactivamente los criterios de Natación
    await waitFor(() => {
      expect(screen.getByText('Resistencia Aeróbica')).toBeInTheDocument();
      expect(screen.getByText('Técnica de Crol')).toBeInTheDocument();
    });

    // Los criterios de Trabajo ya no deben estar en pantalla
    expect(screen.queryByText('Salario y Beneficios')).not.toBeInTheDocument();
    expect(screen.queryByText('Relación con el Equipo')).not.toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.getByText(firstTopic.items[0].name)).toBeInTheDocument();
    });

    // Cambiar al segundo ámbito funciona correctamente sin initialTopicId previo
    fireEvent.change(selector, { target: { value: secondTopic.id } });

    await waitFor(() => {
      expect(selector.value).toBe(secondTopic.id);
      expect(screen.getByText(secondTopic.items[0].name)).toBeInTheDocument();
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
      expect(screen.getByText('Resistencia Aeróbica')).toBeInTheDocument();
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

  describe('Simplificación de Evaluación (Issue #23 - Sólo Lectura en Ponderaciones y Criterios)', () => {
    it('muestra los nombres de criterios como texto estático y no como textareas o inputs editables', async () => {
      render(
        <EvaluatorView
          initialTopicId="topic-work"
          onEvaluationSaved={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Salario y Beneficios')).toBeInTheDocument();
      });

      // No debe haber inputs o textareas con el nombre del criterio
      expect(screen.queryByDisplayValue('Salario y Beneficios')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('Relación con el Equipo')).not.toBeInTheDocument();
    });

    it('muestra el peso y porcentaje de importancia como etiquetas informativas de lectura', async () => {
      render(
        <EvaluatorView
          initialTopicId="topic-work"
          onEvaluationSaved={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Salario y Beneficios')).toBeInTheDocument();
      });

      // Topic work tiene 2 items con pesos 8 y 6 (total = 14)
      // 8 / 14 = 57.1%
      // 6 / 14 = 42.9%
      expect(screen.getByText('57.1%')).toBeInTheDocument();
      expect(screen.getByText('42.9%')).toBeInTheDocument();

      // Badges de peso
      expect(screen.getByText((_, el) => el?.textContent === 'Peso: 8')).toBeInTheDocument();
      expect(screen.getByText((_, el) => el?.textContent === 'Peso: 6')).toBeInTheDocument();
    });

    it('únicamente renderiza un slider por criterio correspondiente a la nota actual (1 a 10)', async () => {
      render(
        <EvaluatorView
          initialTopicId="topic-work"
          onEvaluationSaved={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Salario y Beneficios')).toBeInTheDocument();
      });

      // Debe haber exactamente 2 sliders (uno por cada criterio de mockTopicWork, para la nota actual)
      const sliders = screen.getAllByRole('slider');
      expect(sliders).toHaveLength(2);

      expect(sliders[0]).toHaveAttribute('aria-label', 'Nota para Salario y Beneficios');
      expect(sliders[1]).toHaveAttribute('aria-label', 'Nota para Relación con el Equipo');

      // Modificar el slider de nota actualiza el score
      fireEvent.change(sliders[0], { target: { value: '10' } });
      expect(sliders[0]).toHaveValue('10');
    });

    it('permite desplegar y contraer la ayuda memoria como texto informativo', async () => {
      render(
        <EvaluatorView
          initialTopicId="topic-work"
          onEvaluationSaved={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Salario y Beneficios')).toBeInTheDocument();
      });

      // La explicación inicialmente no está visible
      expect(screen.queryByText('Compensación mensual')).not.toBeInTheDocument();

      // Botón para ver explicación
      const infoButton = screen.getByLabelText('Ver explicación de Salario y Beneficios');
      fireEvent.click(infoButton);

      // Ahora se visualiza como texto plano
      expect(screen.getByText('Compensación mensual')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Compensación mensual')).not.toBeInTheDocument();

      // Al volver a hacer clic, se contrae
      fireEvent.click(infoButton);
      expect(screen.queryByText('Compensación mensual')).not.toBeInTheDocument();
    });

    it('no muestra botones para añadir ni eliminar criterios en la vista de evaluación', async () => {
      render(
        <EvaluatorView
          initialTopicId="topic-work"
          onEvaluationSaved={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Salario y Beneficios')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Añadir otro criterio a esta evaluación/i)).not.toBeInTheDocument();
      expect(screen.queryByTitle(/Eliminar criterio/i)).not.toBeInTheDocument();
    });
  });
});

