# Glosario de Dominio - RatingsApp

Este documento centraliza los conceptos, términos y definiciones del dominio de RatingsApp para asegurar consistencia entre el equipo y los asistentes de IA.

---

### Ámbito (Topic)
- **Definición**: Dimensión o área de la vida personal o profesional sobre la cual se realizan evaluaciones (por ejemplo: Trabajo / Laboral, Natación / Deporte, Hábitos).
- **Alcance / Propósito**: Agrupa un conjunto de criterios de evaluación y permite seguir la evolución temporal específica de esa faceta.
- **Lo que NO es**: No es una categoría fija del sistema; el usuario puede crear, editar y eliminar ámbitos según sus necesidades.

### Criterio de Ponderación (Topic Item)
- **Definición**: Variable o factor individual dentro de un ámbito al que se le asigna un peso de importancia (1 a 10) y una nota nominal (1 a 10).
- **Alcance / Propósito**: Permite descomponer la auto-evaluación en elementos tangibles (ej. "Relación con superiores", "Tareas cotidianas").
- **Lo que NO es**: No tiene un peso absoluto fijo; su aporte relativo al resultado final se calcula dinámicamente como porcentaje sobre la suma total de pesos en esa fecha.

### Sensación Diaria (Quick Check-in)
- **Definición**: Registro directo y ultrarrápido (1 a 10) del bienestar o estado de ánimo general del usuario, realizado en segundos y sin necesidad de desglosar múltiples criterios ponderados.
- **Alcance / Propósito**: Ofrecer seguimiento cotidiano de baja fricción para alimentar el histórico temporal y la matriz anual de bienestar.
- **Lo que NO es**: No reemplaza la evaluación ponderada profunda; coexiste como un modo ágil de medición.

### Promedio Diario Agregado
- **Definición**: Valor representativo diario obtenido mediante el promedio aritmético de todos los registros cargados en una misma fecha calendario (por ejemplo, check-ins de mañana y noche).
- **Alcance / Propósito**: Permitir que las visualizaciones gráficas y matrices anuales muestren un único dato consolidado por día sin perder el detalle ni los comentarios individuales de cada registro.

### Mood Wrapped (Matriz Anual)
- **Definición**: Vista de calendario anual en cuadrícula interactiva de 12 meses (columnas) por 31 días (filas), con coloración térmica según la nota diaria y una fila inferior de promedios mensuales (∅).
- **Alcance / Propósito**: Ofrecer una perspectiva global del estado anímico y bienestar a lo largo de los 365 días del año con un solo vistazo.
- **Lo que NO es**: No es un calendario de eventos ni agenda; es una representación térmica retrospectiva de estados de ánimo.

### Carga Retrospectiva (Backfill)
- **Definición**: Registro o modificación de evaluaciones y sensaciones correspondientes a fechas previas a la fecha actual.
- **Alcance / Propósito**: Permitir al usuario completar días olvidados o rectificar notas y ponderaciones pasadas preservando la fecha en hora local y evitando desplazamientos por zona horaria UTC.
- **Lo que NO es**: No altera las mediciones históricas sin acción deliberada del usuario.

### Interfaz Conversacional (Chat)
- **Definición**: Canal de interacción mediante texto en lenguaje natural integrado en la aplicación para registrar sensaciones inmediatas o completar auto-evaluaciones asistidas.
- **Alcance / Propósito**: Reducir la fricción de entrada de datos ofreciendo un diálogo guiado y un parser offline rápido, complementando la interfaz tradicional de sliders.
- **Lo que NO es**: No es un bot social ni de soporte externo; es un asistente local enfocado en la introspección y puntuación del usuario.

### Check-in Rápido por Lenguaje Natural
- **Definición**: Mecanismo de interpretación local basado en expresiones regulares y reglas determinísticas que extrae notas (1 a 10) y comentarios a partir de frases cotidianas (ej. "hoy me siento un 8").
- **Alcance / Propósito**: Permitir asentar sensaciones diarias de forma ultrarrápida sin requerir conexión a internet ni consumo de tokens de IA.
- **Lo que NO es**: No requiere modelos de lenguaje en la nube para frases directas de puntuación del día.

### Evaluación Guiada por Chat (Conversational Scoring)
- **Definición**: Proceso reflexivo interactivo donde el usuario relata acontecimientos o vivencias de un ámbito determinado y el asistente infiere y propone notas nominales (1 a 10) y justificaciones para cada criterio de ponderación del ámbito.
- **Alcance / Propósito**: Asistir en la descomposición analítica de un día complejo en notas cuantitativas alineadas a la matriz del usuario.
- **Lo que NO es**: No guarda la evaluación automáticamente sin la confirmación explícita del usuario.

### Tarjeta de Borrador (Draft Card)
- **Definición**: Componente interactivo renderizado en el hilo de conversación que presenta las notas propuestas y el promedio ponderado calculado antes de guardarse en la base de datos local.
- **Alcance / Propósito**: Otorgar control total al usuario para ajustar sliders y notas sugeridas por la IA antes de confirmar el registro final.
- **Lo que NO es**: No impacta en el historial ni en las métricas hasta que se presione el botón de confirmación.

### BYOK (Bring Your Own Key)
- **Definición**: Modelo de configuración donde el usuario ingresa su propia clave de API de un proveedor de IA (ej. Google Gemini, OpenAI o endpoint local tipo Ollama) para procesar sus conversaciones.
- **Alcance / Propósito**: Preservar la arquitectura Zero-Backend y la privacidad total, garantizando que los datos viajen directamente entre el dispositivo del usuario y el proveedor elegido sin servidores intermediarios.
- **Lo que NO es**: No almacena credenciales en ningún servidor central ni comparte claves entre dispositivos.

