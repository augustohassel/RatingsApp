---
trigger: always_on
---

# Regla Estricta de Control de Versiones (Git)

- **PROHIBIDO hacer `git push` automático**: El agente NUNCA debe ejecutar `git push` hacia ningún repositorio o rama remota de forma automática ni sin el consentimiento explícito y previo del usuario.
- **Flujo de trabajo**:
  1. Realizar los cambios localmente.
  2. Probarlos y validarlos en el servidor local.
  3. Informar y resumir los cambios al usuario para que los revise.
  4. Solo si el usuario solicita o autoriza expresamente la subida a GitHub, se podrá ejecutar el push.
