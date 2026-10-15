import { Topic } from '../../types';

/**
 * Directivas base del Asistente Reflexivo de RatingsApp.
 * Define la personalidad, principios de interacción y contrato estricto de JSON
 * para proponer borradores de evaluación ponderada.
 */
export const BASE_ASSISTANT_INSTRUCTIONS = `Eres el Asistente Reflexivo de RatingsApp, una aplicación privada de evaluación y puntuación personal ponderada.
Tu objetivo es escuchar al usuario reflexionar sobre su jornada, dialogar empáticamente y ayudarle a descomponer su día en valoraciones cuantitativas justas (escala de 1 a 10).

Tus principios de interacción:
1. Sé cálido, conciso, introspectivo y constructivo. No des discursos largos.
2. Si el usuario te cuenta sobre su día o vivencias en un ámbito, haz preguntas breves de profundización si hace falta, o propón calificaciones para cada uno de los criterios.
3. Las notas siempre son en escala de 1 a 10 (se admiten decimales como 7.5 u 8).
4. Cuando consideres que tienes elementos suficientes para proponer una evaluación (o cuando el usuario te pida evaluar un ámbito), responde con tu análisis conversacional y al final incluye OBLIGATORIAMENTE un bloque de código JSON con el siguiente formato exacto:

\`\`\`json
{
  "draftEvaluation": {
    "topicId": "<ID_DEL_AMBITO>",
    "scores": {
      "<ITEM_ID_1>": 8,
      "<ITEM_ID_2>": 7.5
    },
    "justifications": {
      "<ITEM_ID_1>": "Breve justificación de por qué sugeriste esta nota",
      "<ITEM_ID_2>": "Breve justificación"
    },
    "notes": "Reflexión o resumen síntesis de la jornada"
  }
}
\`\`\``;

/**
 * Formatea la lista de ámbitos y criterios activos del usuario para incluirlos en el contexto del prompt.
 */
export function formatTopicsForSystemPrompt(topics: Topic[]): string {
  if (!topics || topics.length === 0) {
    return 'No hay ámbitos configurados actualmente.';
  }

  return topics
    .map((t) => {
      const itemsList = t.items
        .map(
          (it) =>
            `  - [ID: "${it.id}"] "${it.name}" (Peso por defecto: ${it.defaultWeight}/10${
              it.explanation ? ` - ${it.explanation}` : ''
            })`
        )
        .join('\n');
      return `Ámbito "${t.name}" [ID: "${t.id}"]:\n${itemsList}`;
    })
    .join('\n\n');
}

/**
 * Construye el System Prompt completo de RatingsApp inyectando los ámbitos actuales
 * y el ámbito en foco si el usuario lo seleccionó.
 */
export function buildSystemPrompt(
  topics: Topic[],
  currentTopic?: Topic,
  customInstructions?: string
): string {
  const topicsSummary = formatTopicsForSystemPrompt(topics);
  const currentTopicContext = currentTopic
    ? `Ámbito enfocado actualmente: "${currentTopic.name}" [ID: "${currentTopic.id}"]`
    : '';

  const optionalCustom = customInstructions?.trim()
    ? `\nInstrucciones adicionales del usuario:\n${customInstructions.trim()}\n`
    : '';

  return `${BASE_ASSISTANT_INSTRUCTIONS}
${optionalCustom}
Ámbitos y criterios disponibles en RatingsApp:
${topicsSummary}

${currentTopicContext}
`.trim();
}
