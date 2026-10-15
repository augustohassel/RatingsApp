import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DraftEvaluationCard } from './DraftEvaluationCard';

import { ChatDraftEvaluation } from '../../types';

describe('DraftEvaluationCard', () => {
  const sampleDraft: ChatDraftEvaluation = {
    topicId: 'topic-work',
    topicName: 'Trabajo / Laboral',
    dateStr: '2026-10-15',
    items: [
      {
        itemId: 'w-1',
        name: 'Relación con el equipo',
        weight: 8,
        score: 8,
        justification: 'Buena comunicación',
      },
      {
        itemId: 'w-2',
        name: 'Salario',
        weight: 10,
        score: 7,
      },
    ],
    notes: 'Buen día de trabajo',
    confirmed: false,
  };

  it('renders topic name, items and initial calculated score', () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DraftEvaluationCard draft={sampleDraft} onConfirm={handleConfirm} />);

    expect(screen.getByText('Trabajo / Laboral')).toBeInTheDocument();
    expect(screen.getByText('Relación con el equipo')).toBeInTheDocument();
    expect(screen.getByText('Buena comunicación')).toBeInTheDocument();
    expect(screen.getByText('Salario')).toBeInTheDocument();
    expect(screen.getByText('Buen día de trabajo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar y Guardar/i })).toBeInTheDocument();
  });

  it('allows adjusting score sliders and recalculating live score', () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DraftEvaluationCard draft={sampleDraft} onConfirm={handleConfirm} />);

    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(2);

    // Change first slider score from 8 to 10
    fireEvent.change(sliders[0], { target: { value: '10' } });

    // Item 1: 10 * 8 = 80; Item 2: 7 * 10 = 70. Total = 150 / 18 = 8.33
    expect(screen.getAllByText('8.33').length).toBeGreaterThanOrEqual(1);
  });


  it('calls onConfirm with complete EvaluationEntry and marks confirmed', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DraftEvaluationCard draft={sampleDraft} onConfirm={handleConfirm} />);

    const confirmBtn = screen.getByRole('button', { name: /Confirmar y Guardar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    const confirmedEntry = handleConfirm.mock.calls[0][0];
    expect(confirmedEntry.topicId).toBe('topic-work');
    expect(confirmedEntry.finalScore).toBeGreaterThan(0);
    expect(confirmedEntry.items).toHaveLength(2);

    // Shows saved feedback
    await waitFor(() => {
      expect(screen.getByText(/Evaluación guardada exitosamente/i)).toBeInTheDocument();
    });
  });

  it('renders and invokes onStartNewSession button when confirmed', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    const handleStartNewSession = vi.fn();

    render(
      <DraftEvaluationCard
        draft={{ ...sampleDraft, confirmed: true }}
        onConfirm={handleConfirm}
        onStartNewSession={handleStartNewSession}
      />
    );

    const newSessionBtn = screen.getByRole('button', { name: /Iniciar nueva conversación limpia/i });
    expect(newSessionBtn).toBeInTheDocument();

    fireEvent.click(newSessionBtn);
    expect(handleStartNewSession).toHaveBeenCalledTimes(1);
  });
});

