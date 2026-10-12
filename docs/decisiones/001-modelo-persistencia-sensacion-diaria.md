# ADR 001: Modelo de Persistencia para Sensación Diaria (Quick Check-in)

- **Fecha**: 2026-10-12
- **Estado**: Aceptada

## Contexto y Problema
El Issue #3 requiere incorporar un registro simple de sensación diaria de 1 a 10 con timestamp y notas opcionales, permitiendo múltiples mediciones por día y visualizaciones en gráficos temporales y matriz anual Mood Wrapped.
RatingsApp opera con IndexedDB (Dexie) bajo arquitectura Zero-Backend y dispone de utilidades completas de respaldo e importación (JSON y CSV) basadas en las tablas `topics` y `evaluations`.

Existía el dilema de si crear una nueva tabla de almacenamiento exclusiva (`daily_checkins`) en Dexie o reutilizar el esquema existente de `evaluations`.

## Alternativas Evaluadas

1. **Alternativa A (Ámbito de sistema reservado en `evaluations`)**:
   - Asignar un topic reservado `topic-daily-mood` ("Sensación Diaria") e insertar cada check-in como una entrada de evaluación con 1 ítem base (peso 10, nota 1-10).
   - **Ventajas**:
     - Compatibilidad inmediata con las funciones existentes de exportación y restauración de backups (`exportBackup` / `importBackup` en JSON y CSV).
     - No requiere migración destructiva ni incremento de versión de Dexie en clientes existentes.
     - Coherencia arquitectónica al unificar consultas de histórico de fechas y notas.
   - **Desventajas**:
     - Requiere distinguir o filtrar el topic reservado en pantallas donde sólo se deseen listar ámbitos convencionales creados por el usuario si fuera necesario.

2. **Alternativa B (Nueva tabla `daily_checkins` en Dexie)**:
   - Crear una tabla separada con esquema propio (`id, date, score, notes, createdAt`).
   - **Ventajas**:
     - Separación estricta de tablas entre evaluaciones ponderadas y check-ins simples.
   - **Desventajas**:
     - Requiere incrementar la versión del schema de Dexie (`version(2)`).
     - Requiere modificar y adaptar los formatos de exportación e importación de backups JSON y CSV, generando posibles incompatibilidades con respaldos antiguos.
     - Duplica lógica de acceso a datos y agregación temporal.

## Decisión Adoptada
Se adopta la **Alternativa A**: utilizar un topic de sistema predeterminado (`id: 'topic-daily-mood'`, nombre: `"Sensación Diaria"`, icono: `"Smile"` / `"Heart"`) guardando los registros en la tabla `evaluations`.

## Consecuencias y Trade-offs
- Las funciones de backup y restauración existentes continúan operando sin cambios estructurales críticos.
- Las visualizaciones temporales y cálculos de agregación diaria y mensual procesan las entradas de forma consistente.
- Las vistas de gestión de ámbitos convencionales pueden identificar y proteger el ámbito reservado para evitar su eliminación accidental.
