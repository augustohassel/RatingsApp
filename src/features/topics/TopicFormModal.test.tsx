import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TopicFormModal } from './TopicFormModal';
import {
  db,
  clearPendingLocalChanges,
  hasPendingLocalChanges,
  LOCAL_DATA_CHANGED_EVENT,
} from '../../db';
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
    await db.tombstones.clear();
    clearPendingLocalChanges();
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
    expect(savedTopics[0].isSystem).toBeUndefined();
    expect(hasPendingLocalChanges()).toBe(true);
  });

  it('clears previous tombstone and emits local-data-changed via saveTopic when editing', async () => {
    await db.topics.put(existingTopic);
    await db.tombstones.put({
      id: existingTopic.id,
      entityType: 'topic',
      deletedAt: 500,
    });

    const onLocalDataChanged = vi.fn();
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, onLocalDataChanged);

    const handleClose = vi.fn();
    const handleSaved = vi.fn();

    try {
      render(
        <TopicFormModal
          topic={existingTopic}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      );

      const nameInput = screen.getByPlaceholderText(/Ej: Finanzas, Idiomas, Pareja/i);
      fireEvent.change(nameInput, { target: { value: 'Natación Competitiva' } });

      fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

      await waitFor(() => {
        expect(handleSaved).toHaveBeenCalledTimes(1);
      });

      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(await db.tombstones.get(existingTopic.id)).toBeUndefined();
      expect(hasPendingLocalChanges()).toBe(true);
      expect(onLocalDataChanged).toHaveBeenCalledTimes(1);

      const updated = await db.topics.get(existingTopic.id);
      expect(updated?.name).toBe('Natación Competitiva');
    } finally {
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, onLocalDataChanged);
    }
  });

  it('preserves isSystem: true when editing a system topic', async () => {
    const systemTopic: Topic = {
      ...existingTopic,
      id: 'topic-daily-mood',
      name: 'Sensación Diaria',
      isSystem: true,
    };
    await db.topics.put(systemTopic);

    const handleClose = vi.fn();
    const handleSaved = vi.fn();

    render(
      <TopicFormModal
        topic={systemTopic}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    );

    const nameInput = screen.getByPlaceholderText(/Ej: Finanzas, Idiomas, Pareja/i);
    fireEvent.change(nameInput, { target: { value: 'Sensación Diaria Ajustada' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => {
      expect(handleSaved).toHaveBeenCalledTimes(1);
    });

    const updated = await db.topics.get(systemTopic.id);
    expect(updated?.name).toBe('Sensación Diaria Ajustada');
    expect(updated?.isSystem).toBe(true);
  });

  it('does not persist or clear tombstones when validation fails without named criteria', async () => {
    const systemTopic: Topic = {
      ...existingTopic,
      id: 'topic-system-guard',
      isSystem: true,
      items: [{ id: 'crit-only', name: 'Energía', defaultWeight: 5 }],
    };
    await db.topics.put(systemTopic);
    await db.tombstones.put({
      id: systemTopic.id,
      entityType: 'topic',
      deletedAt: 900,
    });

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const handleClose = vi.fn();
    const handleSaved = vi.fn();

    try {
      render(
        <TopicFormModal
          topic={systemTopic}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      );

      const criterionInput = screen.getByPlaceholderText(/Nombre del criterio/i);
      fireEvent.change(criterionInput, { target: { value: '   ' } });

      fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Debe tener al menos un criterio con nombre.');
      });

      expect(handleSaved).not.toHaveBeenCalled();
      expect(handleClose).not.toHaveBeenCalled();
      expect(hasPendingLocalChanges()).toBe(false);
      expect(await db.tombstones.get(systemTopic.id)).toBeDefined();

      const persisted = await db.topics.get(systemTopic.id);
      expect(persisted?.isSystem).toBe(true);
      expect(persisted?.items).toHaveLength(1);
    } finally {
      alertSpy.mockRestore();
    }
  });
});
