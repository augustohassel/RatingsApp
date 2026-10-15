# 004: Optimización de Tokens Mediante Ventana Deslizante y Modularización del System Prompt

- **Fecha**: 2026-10-15
- **Estado**: Aceptada
- **Issue Asociado**: #16

## Contexto y Problema
En la arquitectura conversacional inicial de RatingsApp (Decisión 003), la totalidad de los mensajes persistidos localmente en IndexedDB (`db.chatMessages`) se retransmitían en cada interacción con los proveedores de IA (Google Gemini u OpenAI / Compatible).

A medida que el usuario acumulaba días de reflexión en la app:
1. **Consumo Exponencial de Tokens**: En cada turno se enviaban miles de tokens previos repetidos, incrementando el costo en las API Keys personales del usuario (o consumiendo cuotas gratuitas rápidamente).
2. **Latencia Creciente**: Payloads voluminosos aumentaban innecesariamente el tiempo de procesamiento y respuesta de los modelos.
3. **Desviación de Contexto (*Context Drift*)**: El modelo recibía anécdotas de semanas anteriores que no tenían relevancia con la jornada o ámbito en evaluación hoy.
4. **Acoplamiento del System Prompt**: El prompt y las instrucciones del asistente residían embebidos directamente dentro del código de llamadas HTTP en `aiService.ts`, dificultando su mantenimiento, prueba y versionado independiente.

## Alternativas Evaluadas

1. **Alternativa A: Envío Permanente del Historial Completo**:
   - *Ventajas*: Mantiene memoria histórica infinita sin lógica de poda.
   - *Desventajas*: Económicamente inviable para BYOK a mediano plazo, genera latencias inaceptables en dispositivos móviles y confunde al modelo con temas antiguos.

2. **Alternativa B: Resumen o Compactación Automática vía IA (*LLM Summarization*)**:
   - *Ventajas*: Conserva una síntesis semántica de mensajes pasados.
   - *Desventajas*: Introduce llamadas adicionales a la API (costo oculto de tokens), complejidad de orquestación y posible pérdida de detalles cuantitativos críticos.

3. **Alternativa C: Ventana Deslizante (*Sliding Window*) + Acciones Explícitas de Nueva Sesión + Modularización del Prompt**:
   - *Ventajas*: 
     - Límite determinístico y seguro: solo se transmiten los últimos N turnos conversacionales relevantes (10 mensajes por defecto).
     - Desduplicación automática del último mensaje para evitar redundancias en el payload.
     - Mayor claridad para el usuario: la app recomienda amigablemente reiniciar la conversación una vez confirmada una evaluación ("Nueva sesión") y dispone de un acceso directo visible.
     - El System Prompt se extrae a un módulo desacoplado (`src/services/prompts/systemPrompt.ts`) facilitando su inspección, testing y eventual parametrización por el usuario.
   - *Desventajas*: El modelo no recuerda intercambios ocurridos hace más de 10 turnos a menos que se encuentren en la evaluación guardada o en el foco actual.

## Decisión Adoptada
Se adopta la **Alternativa C**:
1. **Ventana Deslizante Determinística**: Se implementa `prepareHistoryWindow(history, newMessage, maxMessages = 10)` en `src/services/aiService.ts`. Filtra roles conversacionales válidos, evita duplicar el turno activo del usuario y recorta el contexto a los últimos 10 mensajes antes de enviarlo a Gemini u OpenAI.
2. **Recomendación y Botón de "Nueva Sesión"**:
   - Se incorpora el botón "Nueva sesión" en el encabezado de `ChatView`.
   - Al confirmar un borrador de evaluación (`DraftEvaluationCard`), el asistente genera un mensaje de confirmación y recomendación proactiva invitando a iniciar un hilo limpio para el siguiente ámbito.
   - La propia tarjeta de borrador confirmada ofrece un botón directo para reiniciar la sesión.
3. **Módulo de Prompt Dedicado**: Se aísla el System Prompt y la lógica de serialización de tópicos y criterios en `src/services/prompts/systemPrompt.ts`.

## Consecuencias y Trade-offs
- **Positivas**: 
  - Control predecible y estricto del gasto de tokens en la API Key del usuario.
  - Respuestas más veloces y enfocadas exclusivamente en la reflexión de la jornada actual.
  - Código desacoplado, modular y cubierto por tests unitarios específicos.
- **Preservación de Datos**: Las notas, ponderaciones y sensaciones diarias ya guardadas en IndexedDB nunca se pierden al reiniciar la sesión de chat.
