locals {
  required_apis = concat(
    [
      "drive.googleapis.com",
      "cloudresourcemanager.googleapis.com",
      "serviceusage.googleapis.com",
    ],
    var.enable_github_oidc ? [
      "iam.googleapis.com",
      "iamcredentials.googleapis.com",
      "sts.googleapis.com",
    ] : []
  )
}

# 1. Activación declarativa de APIs de GCP (Google Drive API para acceso directo desde el navegador)
resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# 2. (Opcional) Service Account + Workload Identity Federation (OIDC) para GitHub Actions sin claves JSON
resource "google_service_account" "github_actions" {
  count = var.enable_github_oidc ? 1 : 0

  project      = var.project_id
  account_id   = "github-actions-tf"
  display_name = "GitHub Actions Terraform CI/CD"
  description  = "Service Account utilizada por GitHub Actions vía OIDC para planificar y aplicar Terraform."

  depends_on = [
    google_project_service.apis["iam.googleapis.com"],
  ]
}

resource "google_project_iam_member" "github_actions_roles" {
  for_each = var.enable_github_oidc ? toset([
    "roles/serviceusage.serviceUsageAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/iam.serviceAccountAdmin",
    "roles/storage.admin",
  ]) : toset([])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_actions[0].email}"
}

resource "google_iam_workload_identity_pool" "github" {
  count = var.enable_github_oidc ? 1 : 0

  project                   = var.project_id
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Pool OIDC para autenticar workflows de GitHub Actions"

  depends_on = [
    google_project_service.apis["iam.googleapis.com"],
    google_project_service.apis["sts.googleapis.com"],
  ]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count = var.enable_github_oidc ? 1 : 0

  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == '${var.github_repository}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_oidc_binding" {
  count = var.enable_github_oidc ? 1 : 0

  service_account_id = google_service_account.github_actions[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repository}"

  depends_on = [
    google_project_service.apis["iamcredentials.googleapis.com"],
  ]
}

