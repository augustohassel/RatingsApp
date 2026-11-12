terraform {
  required_version = ">= 1.17.0"

  backend "gcs" {
    bucket = "ratingsapp-sync-tfstate"
    prefix = "terraform/state"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.10"
    }
  }
}

