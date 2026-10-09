terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0.0"
    }
  }
}

variable "project_id" {
  type        = string
  description = "Target Google Cloud project. Empty means apply is forbidden."
  default     = ""
}

variable "region" {
  type        = string
  description = "Must remain empty until Singapore, Taiwan, and Tokyo benchmarks exist."
  default     = ""
}

variable "provisioning_blocked" {
  type        = bool
  description = "Copied from topology.json. True until the budget cap is resolved by the owner."
  default     = true
}

locals {
  can_apply = var.project_id != "" && var.region != "" && var.provisioning_blocked == false
}

output "can_apply" {
  value = local.can_apply
}

output "blockers" {
  value = compact([
    var.project_id == "" ? "missing_project_id" : "",
    var.region == "" ? "region_not_selected" : "",
    var.provisioning_blocked ? "budget_cap_exceeded" : "",
  ])
}

resource "google_storage_bucket" "avatars" {
  count                       = local.can_apply ? 1 : 0
  name                        = "${var.project_id}-avatars"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
}

resource "google_storage_bucket" "exports" {
  count                       = local.can_apply ? 1 : 0
  name                        = "${var.project_id}-exports"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
}
