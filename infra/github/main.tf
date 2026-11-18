import {
  to = github_repository.djzariyya
  id = "djzariyya"
}

resource "github_repository" "djzariyya" {
  name        = "djzariyya"
  description = "Flashcards and quizzes for learning Algerian Darija"
  visibility  = "public"

  has_issues   = true
  has_projects = true
  has_wiki     = true

  allow_squash_merge     = true
  allow_merge_commit     = false
  allow_rebase_merge     = false
  delete_branch_on_merge = true

  archive_on_destroy = true

  lifecycle {
    prevent_destroy = true
  }
}

import {
  to = github_repository_ruleset.protect_main
  id = "djzariyya:27417508"
}

resource "github_repository_ruleset" "protect_main" {
  name        = "protect-main"
  repository  = github_repository.djzariyya.name
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["~DEFAULT_BRANCH"]
      exclude = []
    }
  }

  rules {
    pull_request {
      required_approving_review_count = 0
    }

    deletion         = true
    non_fast_forward = true

    required_status_checks {
      required_check {
        context        = "Python"
        integration_id = 15368
      }
      required_check {
        context        = "Frontend"
        integration_id = 15368
      }
      required_check {
        context        = "Image"
        integration_id = 15368
      }
    }
  }
}
