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

  it('handles interim and final results in sequence without duplicating words', () => {
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
      useSpeechRecognition({ onResult: handleResult })
    );

    act(() => {
      result.current.startListening();
    });

    // 1. Simular primer resultado provisional (interim)
    act(() => {
      mockInstance.onresult({
        resultIndex: 0,
        results: [
          { 0: { transcript: 'esta' }, isFinal: false, length: 1 },
        ],
      });
    });

    expect(result.current.transcript).toBe('esta');
    expect(result.current.interimTranscript).toBe('esta');
    expect(result.current.finalTranscript).toBe('');
    expect(handleResult).toHaveBeenLastCalledWith('esta');

    // 2. Simular actualización del resultado provisional (más palabras habladas)
    act(() => {
      mockInstance.onresult({
        resultIndex: 0,
        results: [
          { 0: { transcript: 'esta es una' }, isFinal: false, length: 1 },
        ],
      });
    });

    expect(result.current.transcript).toBe('esta es una');
    expect(result.current.interimTranscript).toBe('esta es una');
    expect(result.current.finalTranscript).toBe('');
    expect(handleResult).toHaveBeenLastCalledWith('esta es una');

    // 3. Simular consolidación de la primera frase como final
    act(() => {
      mockInstance.onresult({
        resultIndex: 0,
        results: [
          { 0: { transcript: 'esta es una prueba' }, isFinal: true, length: 1 },
        ],
      });
    });

    expect(result.current.transcript).toBe('esta es una prueba');
    expect(result.current.finalTranscript).toBe('esta es una prueba');
    expect(result.current.interimTranscript).toBe('');
    expect(handleResult).toHaveBeenLastCalledWith('esta es una prueba');

    // 4. Simular que el usuario continúa hablando: una segunda frase provisional
    act(() => {
      mockInstance.onresult({
        resultIndex: 1,
        results: [
          { 0: { transcript: 'esta es una prueba' }, isFinal: true, length: 1 },
          { 0: { transcript: 'y funciona' }, isFinal: false, length: 1 },
        ],
      });
    });

    expect(result.current.transcript).toBe('esta es una prueba y funciona');
    expect(result.current.finalTranscript).toBe('esta es una prueba');
    expect(result.current.interimTranscript).toBe('y funciona');

    // 5. Consolidación de la segunda frase
    act(() => {
      mockInstance.onresult({
        resultIndex: 1,
        results: [
          { 0: { transcript: 'esta es una prueba' }, isFinal: true, length: 1 },
          { 0: { transcript: 'y funciona perfecto' }, isFinal: true, length: 1 },
        ],
      });
    });

    expect(result.current.transcript).toBe('esta es una prueba y funciona perfecto');
    expect(result.current.finalTranscript).toBe('esta es una prueba y funciona perfecto');
    expect(result.current.interimTranscript).toBe('');

    // 6. Reseteo manual
    act(() => {
      result.current.resetTranscript();
    });

    expect(result.current.transcript).toBe('');
    expect(result.current.finalTranscript).toBe('');
    expect(result.current.interimTranscript).toBe('');
  });

  it('replicates and prevents Android Chrome cumulative word duplication bug', () => {
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
      useSpeechRecognition({ onResult: handleResult })
    );

    act(() => {
      result.current.startListening();
    });

    // En Chrome para Android, cada elemento en event.results acumula toda la frase previa
    act(() => {
      mockInstance.onresult({
        resultIndex: 3,
        results: [
          { 0: { transcript: 'hoy' }, isFinal: true, length: 1 },
          { 0: { transcript: 'hoy me' }, isFinal: true, length: 1 },
          { 0: { transcript: 'hoy me siento' }, isFinal: true, length: 1 },
          { 0: { transcript: 'hoy me siento un 8' }, isFinal: true, length: 1 },
        ],
      });
    });

    expect(result.current.transcript).toBe('hoy me siento un 8');
    expect(result.current.finalTranscript).toBe('hoy me siento un 8');
    expect(result.current.interimTranscript).toBe('');
    expect(handleResult).toHaveBeenLastCalledWith('hoy me siento un 8');
  });

  it('handles Android cumulative updates with accent refinements, number conversion, and overlapping interim results', () => {
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
      useSpeechRecognition({ onResult: handleResult })
    );

    act(() => {
      result.current.startListening();
    });

    // 1. Tildes añadidas dinámicamente y resultado interim que repite el final
    act(() => {
      mockInstance.onresult({
        resultIndex: 2,
        results: [
          { 0: { transcript: 'sensacion' }, isFinal: true, length: 1 },
          { 0: { transcript: 'sensacion del dia' }, isFinal: true, length: 1 },
          { 0: { transcript: 'Sensación del día ocho' }, isFinal: false, length: 1 },
        ],
      });
    });

    expect(result.current.transcript).toBe('Sensación del día ocho');
    expect(result.current.finalTranscript).toBe('sensacion del dia');
    expect(result.current.interimTranscript).toBe('ocho');

    // 2. Conversión de número en texto ("ocho") a dígito ("8") al continuar hablando
    act(() => {
      mockInstance.onresult({
        resultIndex: 3,
        results: [
          { 0: { transcript: 'sensacion' }, isFinal: true, length: 1 },
          { 0: { transcript: 'sensacion del dia' }, isFinal: true, length: 1 },
          { 0: { transcript: 'Sensación del día ocho' }, isFinal: true, length: 1 },
          { 0: { transcript: 'Sensación del día 8 dormí muy bien' }, isFinal: true, length: 1 },
        ],
      });
    });

    expect(result.current.transcript).toBe('Sensación del día 8 dormí muy bien');
    expect(result.current.finalTranscript).toBe('Sensación del día 8 dormí muy bien');
    expect(result.current.interimTranscript).toBe('');

    // 3. Segunda frase tras una pausa, también emitida de forma acumulativa en Android
    act(() => {
      mockInstance.onresult({
        resultIndex: 5,
        results: [
          { 0: { transcript: 'Sensación del día 8 dormí muy bien' }, isFinal: true, length: 1 },
          { 0: { transcript: 'y logre' }, isFinal: true, length: 1 },
          { 0: { transcript: 'y logré entrenar' }, isFinal: true, length: 1 },
        ],
      });
    });

    expect(result.current.transcript).toBe('Sensación del día 8 dormí muy bien y logré entrenar');
    expect(handleResult).toHaveBeenLastCalledWith('Sensación del día 8 dormí muy bien y logré entrenar');
  });
});


