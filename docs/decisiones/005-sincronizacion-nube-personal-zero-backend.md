# 005: Sincronización Multi-Dispositivo en Nube Personal (Google Drive Zero-Backend)

- **Fecha**: 2026-11-11
- **Estado**: Aceptada

## Contexto y Problema
`RatingsApp` persiste los datos del usuario en almacenamiento local (`IndexedDB` / `localStorage`). Si el usuario borra la caché del navegador o cambia entre celular y computadora, su historial depende únicamente de exportaciones/importaciones manuales de archivos JSON desde `Ajustes`.

Se requiere habilitar respaldo y sincronización multi-dispositivo manteniendo intactos los principios del proyecto:
1. **Zero-Backend**: Sin servidores propios, proxies OAuth ni bases de datos centrales del desarrollador.
2. **Offline-First**: La aplicación debe arrancar y funcionar completamente sin red ni cuenta vinculada.
3. **Resolución segura de conflictos**: Cambios en paralelo en dos dispositivos y eliminaciones deben combinarse sin duplicados ni resurrección de registros borrados.
4. **Aislamiento de secretos y sesiones efímeras**: Las claves BYOK de IA (`AiSettings`) y los historiales efímeros de `chatMessages` no deben replicarse en la nube.

## Alternativas Evaluadas

1. **Alternativa A: Backend propio con OAuth Authorization Code + Base de datos central (PostgreSQL / Firestore)**:
   - *Ventajas*: Refresh tokens persistentes y sincronización en tiempo real.
   - *Desventajas*: Rompe el principio Zero-Backend, requiere mantener servidores/credenciales privadas y traslada los datos íntimos del usuario a infraestructura de terceros.

2. **Alternativa B: Sincronización P2P directa (WebRTC / códigos QR manuales)**:
   - *Ventajas*: No depende de proveedores cloud.
   - *Desventajas*: Requiere ambos dispositivos encendidos y conectados simultáneamente; no ofrece respaldo pasivo ante pérdida o formateo de un único dispositivo.

3. **Alternativa C: Sincronización Client-Side con almacenamiento personal del usuario detrás de `CloudSyncProvider` (Google Drive API v3 + GIS Token Model + `syncEngine` con LWW y Tombstones)**:
   - *Ventajas*: Cero backend propio; el archivo `RatingsApp/ratingsapp-backup.json` vive exclusivamente en la cuenta personal de Google Drive del usuario bajo el scope mínimo `drive.file`. Los conflictos se resuelven determinísticamente en el cliente mediante `updatedAt` y *tombstones*.
   - *Desventajas*: El token OAuth del navegador (GIS Token Model) tiene vigencia aproximada de 1 hora y requiere renovación silenciosa o reautenticación manual al expirar; el *Background Sync* con la app cerrada no es confiable en iOS Safari PWA, por lo que se adopta sincronización manual y oportunista en primer plano.

## Decisión Adoptada
Se adopta la **Alternativa C**:
1. **Abstracción `CloudSyncProvider` (`src/services/cloudSync/types.ts`)**: Desacopla el motor de sincronización y la UI respecto del proveedor concreto, iniciando con `GoogleDriveProvider`.
2. **Autenticación Client-Side (`GoogleDriveProvider`)**: Carga *on-demand* de Google Identity Services (`https://accounts.google.com/gsi/client`) solo cuando hay red y el usuario inicia la conexión, usando `VITE_GOOGLE_CLIENT_ID` público (más override opcional en Ajustes) y scope acotado `https://www.googleapis.com/auth/drive.file` sobre una carpeta visible `RatingsApp/ratingsapp-backup.json`.
3. **Modelo `BackupData` v2 y Dexie v3**: Se incorpora `updatedAt` en `EvaluationEntry` y la tabla `tombstones` (`id`, `entityType`, `deletedAt`) en IndexedDB manteniendo compatibilidad hacia atrás con respaldos JSON v1 en `importBackup` y en la lectura remota.
4. **Motor de Merge Determinístico (`src/utils/syncEngine.ts`)**: Función pura e idempotente que combina colecciones por `id` + `updatedAt` (Last-Write-Wins) y *tombstones*, protegiendo respaldos remotos existentes frente a datos semilla sin modificar (`sample-eval-1` y tópicos iniciales en `updatedAt <= 1`) durante la primera vinculación.
5. **Exclusión de secretos y Workbox `NetworkOnly`**: `AiSettings` y `chatMessages` quedan excluidos del payload sincronizado; en `vite.config.ts`, Workbox configura `NetworkOnly` para `accounts.google.com` y `googleapis.com`.

## Consecuencias y Trade-offs
- **Positivas**: Soberanía total del usuario sobre su respaldo (visible y exportable directo desde su Google Drive), cero costos de infraestructura y funcionamiento offline-first sin regresiones.
- **Limitaciones**: Cuando caduca el token OAuth en primer plano y el navegador requiere interacción explícita, la app mantiene los cambios pendientes localmente y solicita reconexión manual desde `Ajustes`.

