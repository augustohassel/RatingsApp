terraform {
  required_version = ">= 1.17.0"

  # Opcional: una vez creado el bucket de estado en GCS, podés descomentar este bloque
  # y ejecutar `terraform init -migrate-state`:
  # backend "gcs" {
  #   bucket = "ratingsapp-sync-tfstate"
  #   prefix = "terraform/state"
  # }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.10"
    }
  }
}

