variable "project_id" {
  description = "ID único del proyecto de Google Cloud Platform (ej. ratingsapp-sync)."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "El project_id debe tener entre 6 y 30 caracteres (letras minúsculas, números y guiones)."
  }
}

variable "region" {
  description = "Región por defecto de referencia para el proyecto GCP."
  type        = string
  default     = "us-central1"
}

variable "enable_github_oidc" {
  description = "Si es true, crea Workload Identity Federation (OIDC) y Service Account para validar/aplicar Terraform desde GitHub Actions."
  type        = bool
  default     = false
}

variable "github_repository" {
  description = "Repositorio de GitHub (owner/repo) autorizado por OIDC cuando enable_github_oidc = true."
  type        = string
  default     = "augustohassel/RatingsApp"
}

