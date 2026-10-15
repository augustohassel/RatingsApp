import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition } from './useSpeechRecognition';

describe('useSpeechRecognition', () => {
  const originalSpeechRecognition = window.SpeechRecognition;
  const originalWebkitSpeechRecognition = window.webkitSpeechRecognition;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.SpeechRecognition = originalSpeechRecognition;
    window.webkitSpeechRecognition = originalWebkitSpeechRecognition;
  });

  it('reports isSupported: false when Web Speech API is absent', () => {
    delete (window as Partial<Window>).SpeechRecognition;
    delete (window as Partial<Window>).webkitSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.isListening).toBe(false);
  });

  it('starts listening and processes speech recognition results', () => {
    let mockInstance: any = null;

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
        mockInstance = this;
      }
    }

    window.SpeechRecognition = MockSpeechRecognition as any;

    const handleResult = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onResult: handleResult, lang: 'es-AR' })
    );

    expect(result.current.isSupported).toBe(true);

    act(() => {
      result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);
    expect(mockInstance).not.toBeNull();
    expect(mockInstance.start).toHaveBeenCalled();

    // Simular evento onresult
    act(() => {
      mockInstance.onresult({
        resultIndex: 0,
        results: [
          [{ transcript: 'hoy me siento un 9' }],
        ],
      });
    });

    expect(handleResult).toHaveBeenCalledWith('hoy me siento un 9');
    expect(result.current.transcript).toBe('hoy me siento un 9');

    // Detener escucha
    act(() => {
      result.current.stopListening();
    });

    expect(result.current.isListening).toBe(false);
    expect(mockInstance.stop).toHaveBeenCalled();
  });

  it('handles microphone permission denied error', () => {
    let mockInstance: any = null;

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
        mockInstance = this;
      }
    }

    window.SpeechRecognition = MockSpeechRecognition as any;

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    act(() => {
      mockInstance.onerror({ error: 'not-allowed' });
    });

    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toContain('Permiso de micrófono denegado');
  });
});

