# 003: Arquitectura Conversacional, Parser Offline y Modelo BYOK (Zero-Backend)

- **Fecha**: 2026-10-15
- **Estado**: Aceptada

## Contexto y Problema
RatingsApp nació con un enfoque de entrada de datos puramente gráfico (sliders, selectores y formularios modales). Para reducir la fricción en el registro diario y habilitar la evaluación reflexiva guiada, se requiere incorporar una interfaz conversacional (chat). El desafío central consiste en incorporar capacidades de comprensión en lenguaje natural sin violar los principios fundacionales de la aplicación:
1. **Privacidad absoluta (Zero-Backend)**: Ningún dato del usuario debe transitar por servidores centrales propios.
2. **Capacidad Offline-First**: Las funciones esenciales, como registrar la sensación diaria, deben operar sin requerir conexión a internet ni consumo de créditos de IA.
3. **Control del usuario**: La IA no debe persistir calificaciones en la base de datos sin una revisión y confirmación previa del usuario.

## Alternativas Evaluadas

1. **Alternativa A: Backend Intermediario / Proxy de IA con base de datos en nube**:
   - *Ventajas*: Oculta las API Keys y centraliza la orquestación de prompts.
   - *Desventajas*: Viola la premisa Zero-Backend de RatingsApp, incrementa costos de infraestructura y expone la privacidad de las reflexiones íntimas del usuario a un servidor tercero.

2. **Alternativa B: Solo Parser Determinístico por Regex (sin IA generativa)**:
   - *Ventajas*: 100% offline y de complejidad reducida.
   - *Desventajas*: No permite un diálogo guiado reflexivo ni el mapeo semántico de un relato desestructurado hacia múltiples criterios de ponderación en un ámbito.

3. **Alternativa C: Arquitectura Híbrida: Parser Offline Local + BYOK Cliente-a-Servicio + Tarjeta de Borrador (Draft)**:
   - *Ventajas*: Combina un parser local inmediato por regex para check-ins rápidos cotidianos (sin red ni consumo de tokens) con un cliente HTTP directo desde el navegador hacia proveedores de IA (Google Gemini, OpenAI o endpoints locales compatibles como Ollama). Las evaluaciones inferidas se presentan como borradores interactivos en el chat antes de confirmarse en IndexedDB.
   - *Desventajas*: Requiere que el usuario ingrese su propia API Key si desea utilizar el asistente guiado avanzado.

## Decisión Adoptada
Se adopta la **Alternativa C**:
1. **Parser Local Determinístico**: Reconoce expresiones de registro diario (ej. "hoy me siento un 8", "nota 7: muy productivo") y escribe directamente en el tópico `DAILY_MOOD_TOPIC_ID` en IndexedDB de forma instantánea y offline.
2. **BYOK (Bring Your Own Key)**: Configuración en `Ajustes` donde las credenciales se almacenan exclusivamente en el `localStorage` del navegador. Se provee soporte para Google Gemini y OpenAI / Endpoint compatible (Ollama, vLLM, etc.) invocando las APIs mediante llamadas `fetch` directas con CORS habilitado.
3. **Persistencia Local del Chat**: Los mensajes y borradores se guardan en IndexedDB (tabla `chatMessages` en Dexie), persistiendo el contexto entre pestañas y permitiendo al usuario vaciar el historial cuando lo desee.
4. **Draft Card Interactiva**: Toda sugerencia de evaluación ponderada generada por IA se plasma como una tarjeta interactiva con sliders ajustables antes de tocar la base de datos oficial.
5. **Navegación Móvil Ergonómica**: Se mantiene la barra `BottomNav` en 5 pestañas de tamaño táctil óptimo reemplazando `Ámbitos` por `Chat`, preservando el acceso a la administración de Ámbitos desde el Dashboard de Inicio y Ajustes.

## Consecuencias y Trade-offs
- **Positivas**: Cero costos de infraestructura central, soberanía absoluta del usuario sobre sus datos y llaves, y disponibilidad total de registro rápido aún en modo avión.
- **Limitaciones**: Para el asistente guiado profundo, el usuario debe contar con conexión a internet y una API Key (o ejecutar Ollama localmente en su máquina).

