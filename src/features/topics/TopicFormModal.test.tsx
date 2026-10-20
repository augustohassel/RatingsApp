import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TopicFormModal } from './TopicFormModal';
import { db } from '../../db';
import { Topic } from '../../types';

describe('TopicFormModal - Stepper de pesos e íconos dinámicos', () => {
  const existingTopic: Topic = {
    id: 'topic-swim-custom',
    name: 'Natación Máster',
    description: 'Entrenamientos en pileta',
    color: '#06b6d4',
    icon: 'Waves',
    items: [
      { id: 'crit-1', name: 'Resistencia', defaultWeight: 9, explanation: 'Series largas' },
      { id: 'crit-2', name: 'Velocidad', defaultWeight: 1, explanation: 'Piques de 50m' },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.topics.clear();
  });

  it('renders criteria with stepper and increments/decrements weight within [1, 10]', async () => {
    const handleClose = vi.fn();
    const handleSaved = vi.fn();

    render(
      <TopicFormModal
        topic={existingTopic}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    );

    // Initial weight check
    expect(screen.getByTestId('weight-value-0')).toHaveTextContent('9');
    expect(screen.getByTestId('weight-value-1')).toHaveTextContent('1');

    // Button to decrease criterion 2 (weight=1) should be disabled
    const decreaseCrit2Btn = screen.getByRole('button', {
      name: /Disminuir peso de Velocidad/i,
    });
    expect(decreaseCrit2Btn).toBeDisabled();

    // Increase criterion 0 (weight=9) -> should become 10
    const increaseCrit1Btn = screen.getByRole('button', {
      name: /Aumentar peso de Resistencia/i,
    });
    expect(increaseCrit1Btn).not.toBeDisabled();
    fireEvent.click(increaseCrit1Btn);

    expect(screen.getByTestId('weight-value-0')).toHaveTextContent('10');
    // Now it reached 10, so it should be disabled
    expect(increaseCrit1Btn).toBeDisabled();

    // Decrease criterion 0 back to 9
    const decreaseCrit1Btn = screen.getByRole('button', {
      name: /Disminuir peso de Resistencia/i,
    });
    fireEvent.click(decreaseCrit1Btn);
    expect(screen.getByTestId('weight-value-0')).toHaveTextContent('9');
  });

  it('reflects selected icon and color in header in real-time', async () => {
    const handleClose = vi.fn();
    const handleSaved = vi.fn();

    render(
      <TopicFormModal
        topic={null}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    );

    const headerIconContainer = screen.getByTestId('topic-header-icon');
    // Initial color is indigo
    expect(headerIconContainer.style.backgroundColor).toBe('#6366f1');

    // Select color #10b981 (emerald)
    const emeraldBtn = screen.getByRole('button', { name: /Color #10b981/i });
    fireEvent.click(emeraldBtn);
    expect(headerIconContainer.style.backgroundColor).toBe('#10b981');

    // Select Waves icon
    const wavesBtn = screen.getByRole('button', { name: /Ícono Waves/i });
    expect(wavesBtn).toBeInTheDocument();
    fireEvent.click(wavesBtn);

    // Submit form with a name
    const nameInput = screen.getByPlaceholderText(/Ej: Finanzas, Idiomas, Pareja/i);
    fireEvent.change(nameInput, { target: { value: 'Entrenamiento de Natación' } });

    const submitBtn = screen.getByRole('button', { name: /Crear Ámbito/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSaved).toHaveBeenCalled();
    });

    const savedTopics = await db.topics.toArray();
    expect(savedTopics).toHaveLength(1);
    expect(savedTopics[0].name).toBe('Entrenamiento de Natación');
    expect(savedTopics[0].icon).toBe('Waves');
    expect(savedTopics[0].color).toBe('#10b981');
  });
});
