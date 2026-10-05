# Guía de Instalación Mobile y Cómo Compartir la App 📱🚀

**RatingsApp** fue creada como una **Progressive Web App (PWA)**, lo que significa que combina la facilidad de acceso de una página web con la experiencia visual, fluidez y funcionamiento offline de una app nativa instalada en tu teléfono.

---

## 1. Cómo probar la aplicación en tu celular AHORA MISMO (Vía Red WiFi Local)

Si el servidor de desarrollo está corriendo en tu computadora, podés conectarte directamente desde tu celular estando en la misma red Wi-Fi:

### Paso 1: Averiguar la IP local de tu computadora
En Windows (PowerShell), ejecutá:
```powershell
ipconfig
```
Buscá la línea que dice **`Dirección IPv4`** (por ejemplo: `192.168.1.45` o similar).

### Paso 2: Iniciar el servidor con acceso a la red
Ejecutá el servidor Vite permitiendo conexiones externas (con la bandera `--host`):
```bash
# Dentro del Dev Container:
npm run dev

# O desde tu terminal con Docker:
docker run --rm -it -p 5173:5173 -v "${PWD}:/workspace" -w /workspace ratingsapp-dev npm run dev -- --host
```

### Paso 3: Abrir en tu celular
Abrí el navegador en tu teléfono (Safari en iPhone o Chrome en Android) e ingresá la dirección:
```text
http://<TU_IP_LOCAL>:5173
```
*(Ejemplo: `http://192.168.1.45:5173`)*.

---

## 2. Cómo Instalar la App como Ícono en tu Pantalla de Inicio

Una vez abierta la aplicación en el navegador del teléfono, podés agregarla a tu pantalla de inicio para que se abra a pantalla completa (sin la barra de direcciones del navegador) y funcione como una app de App Store / Google Play:

### En iPhone (iOS - Safari):
1. Abrí el enlace en **Safari**.
2. Tocá el botón de **Compartir** (el ícono del cuadrado con la flecha hacia arriba en la barra inferior).
3. Hacé scroll hacia abajo y seleccioná **"Agregar a pantalla de inicio"** (*Add to Home Screen*).
4. Tocá **"Agregar"** en la esquina superior derecha.
5. ¡Listo! Tendrás el ícono de **RatingsApp** en tu pantalla de inicio.

### En Android (Google Chrome):
1. Abrí el enlace en **Chrome**.
2. Te aparecerá un cartel inferior que dice **"Agregar RatingsApp a la pantalla principal"** o **"Instalar aplicación"**.
3. Si no aparece automáticamente, tocá los **tres puntos verticales (⋮)** en la esquina superior derecha y seleccioná **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.
4. ¡Listo! La app se integrará al cajón de aplicaciones de tu teléfono.

---

## 3. Cómo Compartir la App con Otra Persona

Como **RatingsApp no tiene backend y no almacena nada en servidores**, cualquier persona a la que le pases el enlace tendrá su **propia base de datos privada** en su propio celular:

### Opción A: Publicarla en Internet de forma gratuita (Recomendado para compartir con cualquiera)
Podés publicar la app gratis en servicios de hosting estático como **Vercel**, **Netlify**, o **GitHub Pages**:

#### Ejemplo rápido con Vercel (1 comando):
```bash
npx vercel
```
O simplemente conectar este repositorio en [vercel.com](https://vercel.com) o [netlify.com](https://netlify.com). Te dará una URL pública HTTPS (por ejemplo: `https://ratings-app-tu-nombre.vercel.app`).

### ¿Qué pasa cuando alguien más abre tu enlace?
1. La otra persona verá la aplicación lista para usar, con las plantillas predeterminadas de **Trabajo** y **Natación**.
2. Todos los datos que esa persona cargue quedarán guardados **únicamente en su propio teléfono**.
3. No podrán ver tus calificaciones ni vos las de ellos (privacidad total).

---

## 4. Respaldos y Migración entre Teléfonos

Si cambiás de celular o querés transferir tus evaluaciones a otro dispositivo:

1. En tu celular actual, andá a la pestaña **Ajustes**.
2. Tocá **"Exportar Backup Completo (JSON)"**.
3. Enviate ese archivo por WhatsApp, Drive, Telegram o Email a tu nuevo dispositivo.
4. En el nuevo celular, abrí RatingsApp, andá a **Ajustes** y tocá **"Restaurar Backup desde JSON"**.
5. Todas tus calificaciones históricas y ámbitos quedarán restaurados instantáneamente.

También podés usar la opción **"Exportar para Excel / Google Sheets (CSV)"** si querés abrir tus datos en una planilla de cálculo para análisis propios.
