# Infraestructura GCP de RatingsApp (`infra/`)

Este directorio gestiona mediante **Terraform** los recursos mínimos en **Google Cloud Platform (GCP)** para habilitar la sincronización personal con Google Drive ($0.00 USD/mes, dentro del nivel gratuito de Google Drive API).

> **Importante sobre Zero-Backend**: Los datos de los usuarios **NO** se almacenan en este proyecto de GCP. El proyecto de GCP sirve únicamente como identidad de la aplicación (`OAuth Client ID`) para que cada usuario pueda elegir su propia cuenta de Google y guardar `RatingsApp/ratingsapp-backup.json` en **su propio Google Drive**.

---

## Qué gestiona Terraform y qué requiere paso único en Consola

1. **Gestionado por Terraform (`infra/main.tf`)**:
   - Activa `drive.googleapis.com` (Google Drive API), `serviceusage.googleapis.com` y `cloudresourcemanager.googleapis.com`.
   - *(Opcional, con `enable_github_oidc = true`)* Configura Workload Identity Federation (OIDC) para GitHub Actions sin descargar claves JSON.
2. **Paso único obligatorio en Google Cloud Console** *(limitación de GCP)*:
   - Google no expone una API pública ni recurso de Terraform para crear **OAuth 2.0 Web Client IDs externos** con *Authorized JavaScript origins* ni configurar la pantalla de consentimiento externa (`drive.file`).
   - Por eso, inmediatamente después de `terraform apply`, se crea el **OAuth Client ID** una sola vez desde la Consola Web y se guarda como variable `VITE_GOOGLE_CLIENT_ID` en GitHub Actions.

---

## Pasos Rápidos

```bash
# 1. Crear proyecto en GCP y autenticar ADC (sin claves JSON)
gcloud auth login
gcloud projects create ratingsapp-sync --name="RatingsApp"
gcloud config set project ratingsapp-sync
gcloud auth application-default login
gcloud auth application-default set-quota-project ratingsapp-sync

# 2. Crear bucket para estado remoto en GCS (infra/versions.tf usa backend "gcs")
gcloud storage buckets create gs://ratingsapp-sync-tfstate --location=us-central1 --uniform-bucket-level-access
gcloud storage buckets update gs://ratingsapp-sync-tfstate --versioning

# 3. Configurar variables locales (nunca se commitean)
cd infra
cp terraform.tfvars.example terraform.tfvars

# 4. Inicializar, validar y aplicar (para validar sin GCS usar: terraform init -backend=false)
terraform init
terraform fmt -check
terraform validate
terraform plan
terraform apply
```

Luego seguí la guía completa paso a paso en [`docs/CONFIGURACION_GOOGLE_DRIVE_APB.md`](../docs/CONFIGURACION_GOOGLE_DRIVE_APB.md).

