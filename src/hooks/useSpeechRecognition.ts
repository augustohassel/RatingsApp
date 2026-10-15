import { useState, useEffect, useRef, useCallback } from "react";

// Tipos para la Web Speech API
interface SpeechRecognitionEventLike extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal?: boolean;
      length: number;
    };
    length: number;
  };
  resultIndex: number;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  lang?: string;
}

export function useSpeechRecognition(options?: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const isSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignorar si ya estaba detenido
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("El reconocimiento de voz no está soportado en este navegador.");
      return;
    }

    try {
      const SpeechRecognitionConstructor =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionConstructor) return;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignorar si ya estaba cancelado
        }
      }

      setTranscript("");
      setFinalTranscript("");
      setInterimTranscript("");

      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = optionsRef.current?.lang || "es-ES";

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const finalParts: string[] = [];
        const interimParts: string[] = [];

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (!item || !item[0]) continue;
          const text = item[0].transcript ? item[0].transcript.trim() : "";
          if (!text) continue;

          if (item.isFinal) {
            finalParts.push(text);
          } else {
            interimParts.push(text);
          }
        }

        const currentFinal = finalParts.join(" ");
        const currentInterim = interimParts.join(" ");
        const combined = [currentFinal, currentInterim].filter(Boolean).join(" ");

        if (combined) {
          setTranscript(combined);
          setFinalTranscript(currentFinal);
          setInterimTranscript(currentInterim);
          if (optionsRef.current?.onResult) {
            optionsRef.current.onResult(combined);
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (event.error === "no-speech") {
          // Ignorar silencio
          return;
        }
        if (event.error === "not-allowed") {
          setError(
            "Permiso de micrófono denegado. Habilita el acceso en tu navegador.",
          );
        } else {
          setError(`Error de reconocimiento: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      setError(null);
    } catch (err) {
      setError((err as Error).message || "No se pudo iniciar el micrófono.");
      setIsListening(false);
    }
  }, [isSupported]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignorar
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    finalTranscript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
