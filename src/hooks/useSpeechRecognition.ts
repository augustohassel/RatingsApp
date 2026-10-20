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

function normalizeSpeechText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?¿¡"']/g, "");
}

/**
 * Intenta fusionar dos segmentos si existe solapamiento acumulativo o de sufijo-prefijo
 * (comportamiento típico de Chrome en Android con Web Speech API).
 * Devuelve el segmento fusionado si hay solapamiento, o null si son frases independientes.
 */
export function mergeOverlappingSegments(prev: string, next: string): string | null {
  const cleanPrev = prev.trim().replace(/\s+/g, " ");
  const cleanNext = next.trim().replace(/\s+/g, " ");

  if (!cleanPrev) return cleanNext;
  if (!cleanNext) return cleanPrev;

  const normPrev = normalizeSpeechText(cleanPrev);
  const normNext = normalizeSpeechText(cleanNext);

  if (!normPrev) return cleanNext;
  if (!normNext) return cleanPrev;

  // 1. El nuevo segmento contiene como prefijo al anterior (transcripción acumulativa en Android)
  if (normNext.startsWith(normPrev)) {
    return cleanNext;
  }

  // 2. El segmento anterior ya es idéntico o termina exactamente con el nuevo (emisión duplicada)
  if (normPrev === normNext || normPrev.endsWith(` ${normNext}`)) {
    return cleanPrev;
  }

  const prevWords = cleanPrev.split(" ");
  const nextWords = cleanNext.split(" ");
  const normPrevWords = prevWords.map(normalizeSpeechText);
  const normNextWords = nextWords.map(normalizeSpeechText);

  // 3. Re-transcripción acumulativa donde el motor corrigió la última palabra (ej. "ocho" -> "8")
  if (prevWords.length >= 3 && nextWords.length >= prevWords.length) {
    let prefixMatches = true;
    for (let i = 0; i < prevWords.length - 1; i++) {
      if (normPrevWords[i] !== normNextWords[i]) {
        prefixMatches = false;
        break;
      }
    }
    if (prefixMatches) {
      return cleanNext;
    }
  }

  // 4. Solapamiento de sufijo de `prev` con prefijo de `next` a nivel de palabras
  const maxOverlap = Math.min(prevWords.length, nextWords.length);
  for (let k = maxOverlap; k >= 1; k--) {
    let matches = true;
    for (let j = 0; j < k; j++) {
      const pWord = normPrevWords[prevWords.length - k + j];
      const nWord = normNextWords[j];
      if (!pWord || pWord !== nWord) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return [...prevWords.slice(0, prevWords.length - k), ...nextWords].join(" ");
    }
  }

  return null;
}

/**
 * Reduce una lista de segmentos de reconocimiento de voz consolidando
 * transcripciones acumulativas sin perder frases independientes.
 */
export function consolidateSpeechSegments(segments: string[]): string {
  const stack: string[] = [];

  for (const raw of segments) {
    const text = raw.trim().replace(/\s+/g, " ");
    if (!text) continue;

    if (stack.length === 0) {
      stack.push(text);
      continue;
    }

    // Verificar si el nuevo segmento reemplaza a todo el historial acumulado
    const fullSoFar = stack.join(" ");
    if (normalizeSpeechText(text).startsWith(normalizeSpeechText(fullSoFar))) {
      stack.length = 0;
      stack.push(text);
      continue;
    }

    // Verificar si se solapa con el último segmento activo en la pila
    const lastSegment = stack[stack.length - 1];
    const merged = mergeOverlappingSegments(lastSegment, text);
    if (merged !== null) {
      stack[stack.length - 1] = merged;
    } else {
      stack.push(text);
    }
  }

  return stack.join(" ");
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
        const allSegments: string[] = [];
        const finalSegments: string[] = [];

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (!item || !item[0]) continue;
          const text = item[0].transcript ? item[0].transcript.trim() : "";
          if (!text) continue;

          allSegments.push(text);
          if (item.isFinal) {
            finalSegments.push(text);
          }
        }

        const combined = consolidateSpeechSegments(allSegments);
        const currentFinal = consolidateSpeechSegments(finalSegments);

        let currentInterim = "";
        if (combined && !currentFinal) {
          currentInterim = combined;
        } else if (combined && currentFinal) {
          const normCombined = normalizeSpeechText(combined);
          const normFinal = normalizeSpeechText(currentFinal);
          if (normCombined !== normFinal && normCombined.startsWith(normFinal)) {
            const finalWordCount = currentFinal.split(" ").length;
            currentInterim = combined.split(" ").slice(finalWordCount).join(" ");
          }
        }

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
