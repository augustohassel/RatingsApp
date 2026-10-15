export interface QuickMoodResult {
  isMatch: boolean;
  score?: number;
  notes?: string;
}

/**
 * Normaliza un texto quitando tildes y pasando a minúsculas para análisis de patrones
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Intenta interpretar un mensaje de texto como un comando rápido de sensación diaria (100% offline).
 *
 * Ejemplos aceptados:
 * - "hoy me siento un 8"
 * - "hoy me siento 8.5: excelente reunion"
 * - "me siento un 7"
 * - "mi estado de animo hoy es 6"
 * - "estado de animo: 9 (muy productivo)"
 * - "animo 8"
 * - "sensacion del dia 7.5"
 * - "sensacion de hoy 8 - cansado pero bien"
 * - "nota de hoy 9: logre todos los objetivos"
 * - "nota 8"
 * - "checkin 8" / "check-in 8"
 * - "hoy un 8" / "hoy 7"
 */
export function parseQuickMoodCommand(rawText: string): QuickMoodResult {
  if (!rawText || typeof rawText !== 'string') {
    return { isMatch: false };
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    return { isMatch: false };
  }

  const normalized = normalizeForMatching(trimmed);

  // Expresiones regulares que buscan disparadores de sensación diaria
  // Grupos esperados:
  // 1: puntuación (número del 1 al 10, con decimal opcional: 8, 8.5, 10, etc.)
  // 2: separador y comentario posterior si existe
  const patterns: RegExp[] = [
    // "hoy me siento (un|el)? X..." o "me siento (un)? X..."
    /(?:^|\b)(?:hoy\s+)?me\s+siento\s*(?:un\s+|una\s+|:\s*)?(10|[1-9](?:[.,]\d+)?)(?:\s*(?:[:\-,/|]|\s)\s*(.*))?$/i,

    // "(mi\s+)?estado\s+de\s+animo\s*(?:hoy\s+)?(?:es\s+)?(?:un\s+|:\s*)?X..."
    /(?:^|\b)(?:mi\s+)?estado\s+de\s+animo\s*(?:hoy\s+)?(?:es\s+|un\s+|:\s*)?(10|[1-9](?:[.,]\d+)?)(?:\s*(?:[:\-,/|]|\s)\s*(.*))?$/i,

    // "animo (hoy)? (es|un|:)? X..."
    /(?:^|\b)animo\s*(?:hoy\s+)?(?:es\s+|un\s+|:\s*)?(10|[1-9](?:[.,]\d+)?)(?:\s*(?:[:\-,/|]|\s)\s*(.*))?$/i,

    // "sensacion (del\s+dia|de\s+hoy)? (es|un|:)? X..."
    /(?:^|\b)sensacion\s*(?:del\s+dia|de\s+hoy)?\s*(?:es\s+|un\s+|:\s*)?(10|[1-9](?:[.,]\d+)?)(?:\s*(?:[:\-,/|]|\s)\s*(.*))?$/i,

    // "nota (de\s+hoy|del\s+dia)? (es|un|:)? X..."
    /(?:^|\b)nota\s*(?:de\s+hoy|del\s+dia)?\s*(?:es\s+|un\s+|:\s*)?(10|[1-9](?:[.,]\d+)?)(?:\s*(?:[:\-,/|]|\s)\s*(.*))?$/i,

    // "check-?in (hoy)? X..."
    /(?:^|\b)check-?in\s*(?:hoy\s+)?(?:es\s+|un\s+|:\s*)?(10|[1-9](?:[.,]\d+)?)(?:\s*(?:[:\-,/|]|\s)\s*(.*))?$/i,

    // "hoy (un|es|:)? X..." (ej: "hoy un 8: dia tranquilo", "hoy: 9")
    /(?:^|\b)hoy\s*(?:es\s+|un\s+|:\s*|\s)(10|[1-9](?:[.,]\d+)?)(?:\s*(?:[:\-,/|]|\s)\s*(.*))?$/i,

  ];

  for (const regex of patterns) {
    const match = normalized.match(regex);
    if (match) {
      const rawScoreStr = match[1].replace(',', '.');
      const score = parseFloat(rawScoreStr);

      if (isNaN(score) || score < 1 || score > 10) {
        continue;
      }

      // Redondear a 2 decimales máximo
      const finalScore = Math.round(score * 100) / 100;

      // Extraer la nota si fue provista
      let noteContent: string | undefined = undefined;

      // Buscamos la posición donde finalizó el número en el texto original
      const scoreIndexInNorm = normalized.indexOf(match[1]);
      if (scoreIndexInNorm !== -1) {
        const afterScoreRaw = trimmed.slice(scoreIndexInNorm + match[1].length).trim();
        // Limpiar separadores iniciales comunes (: - , |)
        const cleanNote = afterScoreRaw.replace(/^[:\-,|;/]\s*/, '').trim();
        if (cleanNote) {
          noteContent = cleanNote;
        }
      }

      return {
        isMatch: true,
        score: finalScore,
        notes: noteContent,
      };
    }
  }

  return { isMatch: false };
}
