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
