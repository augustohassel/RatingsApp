import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ChatView } from './ChatView';
import { db } from '../../db';

describe('ChatView - Dictado por voz (Speech Recognition)', () => {
  const originalSpeechRecognition = window.SpeechRecognition;
  const originalWebkitSpeechRecognition = window.webkitSpeechRecognition;

  let mockSpeechInstance: any = null;

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.chatMessages.clear();
    await db.topics.clear();

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onresult: any = null;
      onerror: any = null;
      onend: any = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();

      constructor() {
        mockSpeechInstance = this;
      }
    }

    window.SpeechRecognition = MockSpeechRecognition as any;
  });

  afterEach(() => {
    window.SpeechRecognition = originalSpeechRecognition;
    window.webkitSpeechRecognition = originalWebkitSpeechRecognition;
  });

  it('renders microphone button and updates input when speech events arrive without duplicating text', () => {
    const handleOpenSettings = vi.fn();
    const handleNavigateToHistory = vi.fn();

    render(
      <ChatView
        onOpenSettings={handleOpenSettings}
        onNavigateToHistory={handleNavigateToHistory}
      />
    );

    const micButton = screen.getByTitle('Dictar por voz');
    expect(micButton).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Registra tu sensación/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');

    // Iniciar dictado
    fireEvent.click(micButton);
    expect(mockSpeechInstance).not.toBeNull();
    expect(mockSpeechInstance.start).toHaveBeenCalled();

    // 1. Simular transcripción provisional (interim)
    act(() => {
      mockSpeechInstance.onresult({
        resultIndex: 0,
        results: [
          { 0: { transcript: 'hoy me' }, isFinal: false, length: 1 },
        ],
      });
    });

    expect(textarea.value).toBe('hoy me');

    // 2. Simular actualización provisional de la misma frase (no debe duplicarse)
    act(() => {
      mockSpeechInstance.onresult({
        resultIndex: 0,
        results: [
          { 0: { transcript: 'hoy me siento' }, isFinal: false, length: 1 },
        ],
      });
    });

    expect(textarea.value).toBe('hoy me siento');

    // 3. Simular consolidación final
    act(() => {
      mockSpeechInstance.onresult({
        resultIndex: 0,
        results: [
          { 0: { transcript: 'hoy me siento un 8' }, isFinal: true, length: 1 },
        ],
      });
    });

    expect(textarea.value).toBe('hoy me siento un 8');

    // 4. Detener dictado
    const stopButton = screen.getByTitle('Detener dictado por voz');
    fireEvent.click(stopButton);
    expect(mockSpeechInstance.stop).toHaveBeenCalled();
  });

  it('preserves existing text in input and appends newly dictated text cleanly', () => {
    const handleOpenSettings = vi.fn();
    const handleNavigateToHistory = vi.fn();

    render(
      <ChatView
        onOpenSettings={handleOpenSettings}
        onNavigateToHistory={handleNavigateToHistory}
      />
    );

    const textarea = screen.getByPlaceholderText(/Registra tu sensación/i) as HTMLTextAreaElement;

    // Escribir texto base previo manualmente
    fireEvent.change(textarea, { target: { value: 'Sensación:' } });
    expect(textarea.value).toBe('Sensación:');

    // Iniciar dictado
    const micButton = screen.getByTitle('Dictar por voz');
    fireEvent.click(micButton);

    // Simular transcripción por voz
    act(() => {
      mockSpeechInstance.onresult({
        resultIndex: 0,
        results: [
          { 0: { transcript: 'hoy me siento bien' }, isFinal: true, length: 1 },
        ],
      });
    });

    expect(textarea.value).toBe('Sensación: hoy me siento bien');
  });

  it('stops listening if user manually types in the textarea while mic is active', () => {
    const handleOpenSettings = vi.fn();
    const handleNavigateToHistory = vi.fn();

    render(
      <ChatView
        onOpenSettings={handleOpenSettings}
        onNavigateToHistory={handleNavigateToHistory}
      />
    );

    const micButton = screen.getByTitle('Dictar por voz');
    fireEvent.click(micButton);

    expect(screen.getByTitle('Detener dictado por voz')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Escuchando tu voz/i) as HTMLTextAreaElement;

    // Usuario edita manualmente con el teclado
    fireEvent.change(textarea, { target: { value: 'Escribiendo manualmente' } });

    expect(mockSpeechInstance.stop).toHaveBeenCalled();
  });
});

