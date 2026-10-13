# ADR 002: Aislamiento de Web Origin mediante Subdominios Propios para PWAs

- **Fecha**: 2026-10-13
- **Estado**: Aceptada

## Contexto y Problema
`RatingsApp` y otras aplicaciones personales como `AntropoPopo` se desplegaban en GitHub Pages bajo subrutas de un mismo dominio personalizado (`https://www.hasselpunk.com/RatingsApp/` y `https://www.hasselpunk.com/AntropoPopo/`).

Dado que el modelo de seguridad y almacenamiento de los navegadores web aísla recursos por **Web Origin** (`esquema + host + puerto`, ignorando la ruta), compartir `https://www.hasselpunk.com` provocaba dos problemas críticos en dispositivos móviles:
1. **Colisión de instalación PWA (WebAPK / iOS)**: Al compartir origen y carecer de un `id` y `scope` diferenciados con íconos PNG requeridos por WebAPK, el sistema operativo móvil identificaba ambas aplicaciones como una misma app instalada e impedía instalar la segunda.
2. **Almacenamiento local compartido (`IndexedDB`, `localStorage`, `CacheStorage`)**: Todas las PWAs bajo el mismo dominio compartían la misma cuota de almacenamiento y el mismo espacio de bases de datos locales. Borrar los datos de sitio de una aplicación en el navegador eliminaba también la base de datos `Dexie` de la otra.

## Alternativas Evaluadas

1. **Alternativa A (Subdominios dedicados por aplicación en GitHub Pages — `ratings.hasselpunk.com`)**:
   - Asignar un registro DNS `CNAME` propio por aplicación (`ratings.hasselpunk.com` -> `augustohassel.github.io`), incluir `public/CNAME` en el repositorio y servir la PWA en la raíz (`/`) de su propio *Web Origin*.
   - **Ventajas**:
     - Aislamiento total de *Web Origin* a nivel de navegador: `IndexedDB`, `localStorage`, `CacheStorage` y permisos quedan 100% separados entre aplicaciones.
     - Instalación simultánea nativa (WebAPK en Android e iOS en Safari) sin colisiones de `id` ni `scope`.
     - Costo de infraestructura cero ($0), manteniendo el flujo actual de CI/CD con GitHub Actions y GitHub Pages con certificados TLS automáticos.
   - **Desventajas**:
     - Requiere configurar un registro `CNAME` en el proveedor DNS por cada nueva aplicación.
     - Al cambiar de *Web Origin* (`www.hasselpunk.com` -> `ratings.hasselpunk.com`), los usuarios que ya tenían datos en la URL anterior deben exportar su backup JSON e importarlo en el nuevo subdominio.

2. **Alternativa B (Mantener subrutas en el mismo dominio con `id` y `scope` por ruta)**:
   - Conservar `https://www.hasselpunk.com/RatingsApp/` declarando `id: '/RatingsApp/'` y `scope: '/RatingsApp/'`.
   - **Ventajas**:
     - No requiere agregar registros DNS adicionales.
   - **Desventajas**:
     - **No resuelve el aislamiento de datos**: `IndexedDB`, `localStorage` y `CacheStorage` siguen compartidos bajo el mismo *Web Origin* (`https://www.hasselpunk.com`), manteniendo el riesgo de pérdida de datos cruzada al limpiar caché o almacenamiento de sitio.

3. **Alternativa C (Despliegue en buckets independientes de Google Cloud Storage + Cloud CDN / Load Balancer)**:
   - Alojar cada aplicación estática en buckets separados en GCP.
   - **Ventajas**:
     - Control granular de infraestructura cloud.
   - **Desventajas**:
     - Para contar con HTTPS y dominios limpios requiere Load Balancer o Cloud Run/Firebase Hosting, sumando complejidad operativa y costos innecesarios frente a GitHub Pages.

## Decisión Adoptada
Se adopta la **Alternativa A**: aislar cada PWA en su propio subdominio dedicado (`https://ratings.hasselpunk.com/`) mediante `public/CNAME`, configurando `base: process.env.VITE_BASE_PATH || '/'` y endureciendo el `manifest.webmanifest` con `id: '/'`, `scope: '/'`, `start_url: '/'` e íconos rasterizados PNG (`192x192`, `512x512` `any`/`maskable` y `apple-touch-icon.png` `180x180`).

## Consecuencias y Trade-offs
- `RatingsApp` obtiene un *Web Origin* exclusivo (`https://ratings.hasselpunk.com`), garantizando que su base de datos `IndexedDB` (`RatingsAppDB`) y su Service Worker estén completamente aislados de otras aplicaciones del mismo dominio raíz.
- Cumple todos los criterios de instalabilidad WebAPK en Android Chrome y Safari iOS.
- Para migrar datos existentes desde `www.hasselpunk.com/RatingsApp/`, se utiliza la funcionalidad nativa de **Exportar / Restaurar Backup Completo (JSON)** desde la pestaña *Ajustes*.

