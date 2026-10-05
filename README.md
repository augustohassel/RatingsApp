# RatingsApp 📊✨

> **Aplicación Mobile-First y PWA para auto-evaluación y seguimiento ponderado con 100% privacidad local.**

RatingsApp te permite medir y registrar tu grado de satisfacción en diferentes ámbitos de tu vida (Trabajo, Deportes/Natación, Bienestar, Relaciones, etc.) a través de un **sistema de promedio ponderado dinámico**.

---

## 🚀 Características Principales

- **⚖️ Ponderación Dinámica**: Ajustá tanto la importancia de cada criterio (1 a 10) como tu nota actual (1 a 10) en cada medición. La app calcula el promedio ponderado exacto en tiempo real.
- **🔒 Privacidad Absoluta (Zero-Backend)**: Todos tus datos residen únicamente en tu dispositivo (IndexedDB). No hay servidores externos, rastreadores ni necesidad de registrarte con usuario y contraseña.
- **📱 Mobile-First & PWA**: Diseñada específicamente para usarse con una mano en el celular. Se puede instalar como una aplicación nativa en la pantalla de inicio (iOS / Android) y funciona 100% offline.
- **📈 Histórico y Analítica Visual**: Visualizá gráficos de evolución temporal, tendencias (+/-), y abrí el desglose detallado de cualquier fecha para recordar qué notas y reflexiones diste ese día.
- **🛠️ Ámbitos Personalizables**: Viene preconfigurada con la plantilla de **Trabajo / Laboral** (14 criterios detallados) y **Natación / Deporte**, y podés crear cualquier otro ámbito a medida.
- **💾 Copias de Seguridad en 1 Clic**: Exportá e importá todos tus datos en **JSON** (restaurable) o **CSV** (para abrir en Microsoft Excel o Google Sheets).
- **🐳 Entorno de Desarrollo Aislado (Dev Container)**: Configurado con Docker (`.devcontainer/`) para desarrollar de manera reproducible y limpia.

---

## 📐 Fórmula Matemática

El cálculo implementado sigue la ponderación estándar:

$$\text{Nota Final} = \frac{\sum_{i=1}^n (\text{Peso}_i \times \text{Nota Nominal}_i)}{\sum_{i=1}^n \text{Peso}_i}$$

Cada criterio muestra en tiempo real:
- Su porcentaje sobre el total de pesos: $(\text{Peso}_i / \sum \text{Pesos}) \times 100$
- Su aporte a la nota final: $\text{Porcentaje}_i \times \text{Nota Nominal}_i$

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/)
- **Base de Datos Local**: [Dexie.js](https://dexie.org/) (IndexedDB)
- **PWA & Offline**: [Vite Plugin PWA](https://vite-pwa-org.netlify.app/)
- **Gráficos**: [Recharts](https://recharts.org/)
- **Iconografía**: [Lucide React](https://lucide.dev/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Contenedores**: Docker + VS Code Dev Containers

---

## 💻 Inicio Rápido con Dev Container

### Opción 1: Abrir en VS Code o Antigravity IDE (Recomendado)
1. Abrí este repositorio en VS Code o Antigravity IDE.
2. Si tenés Docker Desktop iniciado, el editor te sugerirá: **"Reopen in Container"** (Reabrir en contenedor).
3. O abrí la paleta de comandos (`Ctrl + Shift + P` / `F1`) y ejecutá:
   ```text
   Dev Containers: Reopen in Container
   ```
4. Una vez dentro de la terminal del contenedor:
   ```bash
   npm run dev
   ```
5. Abrí [http://localhost:5173](http://localhost:5173) en tu navegador.

### Opción 2: Correr con Docker directamente desde la terminal
```bash
# Construir la imagen del dev container
docker build -f .devcontainer/Dockerfile -t ratingsapp-dev .

# Ejecutar el servidor de desarrollo
docker run --rm -it -p 5173:5173 -v "${PWD}:/workspace" -w /workspace ratingsapp-dev npm run dev
```

---

## 📱 ¿Cómo instalar la App en tu Celular?

Para ver el paso a paso detallado sobre cómo abrir la app en tu celular en tu red WiFi local, cómo instalarla como icono en tu pantalla de inicio y cómo compartirla con amigos o colegas, consultá nuestra guía:

👉 **[Documentación: Instalación Mobile y Compartir (docs/INSTALACION_MOBILE.md)](./docs/INSTALACION_MOBILE.md)**

Para aprender a utilizar todas las funciones, plantillas y fórmulas:

👉 **[Documentación: Guía de Uso del Usuario (docs/GUIA_DE_USO.md)](./docs/GUIA_DE_USO.md)**

---

## 🧪 Pruebas Automatizadas

Para validar que los cálculos coincidan fielmente con la planilla matemática de referencia:

```bash
npm test
```

---

## 📄 Licencia

Código personal y privado para uso libre y auto-evaluación.