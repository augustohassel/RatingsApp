# Guía del Agente AI (AGENTS.md) - RatingsApp

Este documento proporciona el contexto arquitectónico, técnico y de diseño para que cualquier agente de inteligencia artificial (Antigravity, Claude, Copilot, Cursor, etc.) comprenda y continúe el desarrollo de **RatingsApp** dentro del entorno Dev Container o local.

---

## 1. Visión y Propósito del Proyecto

**RatingsApp** es una Progressive Web App (PWA) con diseño *mobile-first* creada para la auto-evaluación y calificación ponderada en diversos ámbitos de la vida (por ejemplo: Trabajo/Laboral, Deportes/Natación, Hábitos, Bienestar, Relaciones, etc.).

### Principios No Negociables
1. **Privacidad Absoluta (Zero-Backend)**: 
   - El 100% de los datos generados por el usuario reside exclusivamente en el almacenamiento local del navegador del dispositivo (IndexedDB mediante Dexie.js).
   - **Bajo ninguna circunstancia** se deben enviar datos de evaluaciones a servidores externos ni APIs de telemetría de terceros.
2. **Offline-First & PWA**:
   - La aplicación debe ser instalable en la pantalla de inicio en iOS y Android.
   - Todo el bundle de assets, estilos y base de datos debe ser operativo sin conexión a internet.
3. **Ponderaciones Dinámicas**:
   - Cada evaluación en el tiempo guarda tanto los **pesos/importancia** que el usuario asignó en ese momento a cada criterio como las **notas nominales** otorgadas, permitiendo analizar qué factores influían en su estado de ánimo en esa fecha.
4. **Desarrollo Aislado en Dev Container**:
   - El entorno oficial de desarrollo se ejecuta en Docker mediante `.devcontainer/` (Node.js 20 LTS, puerto 5173).
5. **Control Estricto de Git (Push con Consentimiento Explícito)**:
   - **NUNCA ejecutar `git push`** de forma autónoma ni hacia ningún repositorio o rama remota sin que el usuario haya revisado previamente los cambios y otorgado su consentimiento expreso. Todo cambio debe validarse localmente primero.

---

## 2. Stack Tecnológico

- **Runtime & Bundler**: Node.js 20 LTS + Vite 6
- **Framework UI**: React 18 + TypeScript (Strict mode)
- **Estilos**: Tailwind CSS 3 (Dark mode por defecto, paleta moderna Indigo/Slate, glassmorphism sutil, optimizado para touch mobile)
- **Base de Datos Local**: IndexedDB gestionada con `dexie` y `dexie-react-hooks`
- **PWA**: `vite-plugin-pwa` (Service Worker automático, manifiesto standalone)
- **Gráficos & Visualización**: `recharts` (AreaChart y LineChart interactivos)
- **Iconos**: `lucide-react`
- **Testing**: `vitest`

---

## 3. Modelo Matemático de Calificación

El cálculo replica fielmente la lógica de ponderación estándar de la planilla de referencia del usuario:

$$\text{Suma de Pesos} = \sum_{i=1}^n \text{Peso}_i$$
$$\text{Porcentaje de Importancia}_i = \left( \frac{\text{Peso}_i}{\text{Suma de Pesos}} \right) \times 100$$
$$\text{Aporte Ponderado}_i = \left( \frac{\text{Peso}_i}{\text{Suma de Pesos}} \right) \times \text{Nota Nominal}_i$$
$$\text{Nota Final} = \sum_{i=1}^n \text{Aporte Ponderado}_i = \frac{\sum_{i=1}^n (\text{Peso}_i \times \text{Nota Nominal}_i)}{\sum_{i=1}^n \text{Peso}_i}$$

*Tanto la Ponderación (peso) como la Nota Nominal utilizan la escala de 1 a 10. La Nota Final resultante se redondea a 2 decimales.*

---

## 4. Estructura de Directorios

```
RatingsApp/
├── .devcontainer/
│   ├── Dockerfile           # Entorno Node 20 LTS en Debian Bookworm
│   └── devcontainer.json    # Configuración de Dev Container y extensiones
├── docs/
│   ├── GUIA_DE_USO.md       # Manual funcional para el usuario
│   └── INSTALACION_MOBILE.md# Cómo instalar y compartir la app en celulares
├── public/
│   ├── favicon.svg          # Favicon vectorial e ícono PWA
├── src/
│   ├── types/
│   │   └── index.ts         # Interfaces: Topic, TopicItemDefinition, EvaluationEntry, BackupData
│   ├── utils/
│   │   ├── calculator.ts    # Motor de cálculo de promedio ponderado y escalas de color
│   │   └── calculator.test.ts # Tests unitarios de cálculo contra la planilla real
│   ├── db/
│   │   ├── seeds.ts         # Plantillas por defecto (Trabajo con 14 criterios, Natación)
│   │   └── index.ts         # Instancia Dexie, inicialización, exportación/importación JSON/CSV
│   ├── components/
│   │   ├── common/
│   │   │   ├── CircularGauge.tsx  # Gauge animado SVG para la nota en tiempo real
│   │   │   └── ScoreBadge.tsx     # Badge coloreado según la nota (1-10)
│   │   └── layout/
│   │       ├── Header.tsx         # Barra superior con status local y privacidad
│   │       └── BottomNav.tsx      # Navegación inferior ergonómica para celulares
│   ├── features/
│   │   ├── dashboard/       # Resumen de ámbitos, últimas notas, deltas (+/-) y feed
│   │   ├── evaluator/       # Formulario táctil de evaluación con cálculo en vivo y reflexiones
│   │   ├── history/         # Gráfico temporal Recharts y modal de desglose detallado
│   │   ├── topics/          # Gestor y modal de edición de ámbitos y criterios
│   │   └── settings/        # Exportar/Importar JSON, CSV, y reseteo de base local
│   ├── App.tsx              # Componente raíz con orquestación de tabs
│   ├── main.tsx             # Punto de entrada de React
│   └── index.css            # Configuración Tailwind y estilos táctiles para sliders
├── AGENTS.md                # Este documento de contexto para Agentes AI
├── README.md                # Presentación general y arranque del proyecto
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 5. Comandos de Desarrollo

### Dentro del Dev Container (o entorno con Node.js):
```bash
# Iniciar servidor de desarrollo con acceso de red local
npm run dev

# Ejecutar tests unitarios
npm test

# Compilación de producción
npm run build

# Previsualizar bundle de producción
npm run preview
```

### Ejecutar desde el Host vía Docker:
```bash
# Servidor de desarrollo
docker run --rm -it -p 5173:5173 -v "${PWD}:/workspace" -w /workspace ratingsapp-dev npm run dev

# Tests
docker run --rm -v "${PWD}:/workspace" -w /workspace ratingsapp-dev npm test

# Build
docker run --rm -v "${PWD}:/workspace" -w /workspace ratingsapp-dev npm run build
```

---

## 6. Guía para Futuras Modificaciones

- **Nuevos Ámbitos o Semillas**: Modificar [`src/db/seeds.ts`](file:///workspaces/RatingsApp/src/db/seeds.ts).
- **Ajustes en la Fórmula**: Mantener sincronizado [`src/utils/calculator.ts`](file:///workspaces/RatingsApp/src/utils/calculator.ts) y ejecutar siempre `npm test` para validar no romper la compatibilidad con los datos históricos existentes.
- **Base de Datos**: Si se modifica el esquema en [`src/db/index.ts`](file:///workspaces/RatingsApp/src/db/index.ts), incrementar el número de versión de Dexie (`this.version(2)...`) para aplicar migraciones limpias.
- **Versión & Release**:
  - El número de versión se gestiona centralizadamente en `package.json` y se inyecta en el cliente mediante Vite (`__APP_VERSION__`).
  - La versión está visible en la esquina superior del `Header` y en el pie de `Ajustes`.
  - **Flujo de Release (SemVer)**:
    1. En la rama `dev`, antes de crear el Pull Request, podés incrementar la versión con la tarea de VS Code (*Release: Incrementar Versión en package.json*) o ejecutando `npm version <patch|minor|major> --no-git-tag-version`.
    2. Al abrir el Pull Request y mergearlo a `master`, el workflow de GitHub Actions ([`.github/workflows/deploy.yml`](file:///workspaces/RatingsApp/.github/workflows/deploy.yml)) se ejecuta automáticamente:
       - Compila y prueba la aplicación.
       - Despliega a GitHub Pages.
       - Lee la versión de `package.json`, crea el tag correspondiente (`vX.Y.Z`) y publica el GitHub Release con el detalle del PR mergeado.
- **Estética & Mobile**: Priorizar siempre interfaces accesibles con el pulgar (*thumb-friendly*), fuentes legibles y respuestas visuales fluidas.
