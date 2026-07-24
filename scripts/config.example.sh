#!/usr/bin/env bash
# Copy this file to scripts/config.sh and fill in the real values.
# scripts/config.sh is gitignored and must NEVER be committed.

# ── GitHub Container Registry ────────────────────────────────────────────────
# GHCR namespace (GitHub org or user that owns the package).
export GHCR_ORG="techinems"
# Image name (usually the repo name).
export IMAGE_NAME="slack-poll"
# GitHub username used for `docker login ghcr.io`.
export GHCR_USER="your-github-username"
# A GitHub Personal Access Token (classic) with at least: write:packages.
# Prefer a fine-grained token or short-lived credential where possible.
export GHCR_PAT="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# ── Coolify ──────────────────────────────────────────────────────────────────
# Base URL of your Coolify instance, no trailing slash, e.g. https://coolify.example.com
export COOLIFY_BASE_URL="https://coolify.example.com"
# Coolify API token (Bearer). One token can drive every app.
export COOLIFY_TOKEN="coolify-api-token-here"
# The UUID of THIS app's resource in Coolify (Settings → the resource → General).
export COOLIFY_APP_UUID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
