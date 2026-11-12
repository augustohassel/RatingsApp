output "project_id" {
  description = "ID del proyecto de GCP donde se activó Google Drive API."
  value       = var.project_id
}

output "enabled_apis" {
  description = "Lista de APIs habilitadas en el proyecto."
  value       = sort(keys(google_project_service.apis))
}

output "oauth_console_url" {
  description = "Enlace directo a Google Auth Platform / Credenciales OAuth del proyecto."
  value       = "https://console.cloud.google.com/auth/overview?project=${var.project_id}"
}

output "workload_identity_provider" {
  description = "Workload Identity Provider para GitHub Actions (si enable_github_oidc = true)."
  value       = var.enable_github_oidc ? google_iam_workload_identity_pool_provider.github[0].name : null
}

output "github_actions_service_account" {
  description = "Email de la Service Account para GitHub Actions (si enable_github_oidc = true)."
  value       = var.enable_github_oidc ? google_service_account.github_actions[0].email : null
}

