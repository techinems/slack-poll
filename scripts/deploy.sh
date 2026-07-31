#!/usr/bin/env bash
#
# Build a linux/amd64 Docker image, push it to GHCR, and trigger a Coolify
# redeploy of this app.
#
# Usage:
#   cp scripts/config.example.sh scripts/config.sh   # then edit config.sh
#   ./scripts/deploy.sh [tag]
#
# If [tag] is omitted, the short git SHA is used. The image is always also
# tagged and pushed as :latest.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Load config ──────────────────────────────────────────────────────────────
CONFIG_FILE="${SCRIPT_DIR}/config.sh"
if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "ERROR: ${CONFIG_FILE} not found." >&2
  echo "       Copy scripts/config.example.sh to scripts/config.sh and fill it in." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "${CONFIG_FILE}"

# ── Validate required config ─────────────────────────────────────────────────
require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: ${name} is not set in scripts/config.sh" >&2
    exit 1
  fi
}
for var in GHCR_ORG IMAGE_NAME GHCR_USER GHCR_PAT \
           COOLIFY_BASE_URL COOLIFY_TOKEN COOLIFY_APP_UUID; do
  require "${var}"
done

# ── Resolve tag ──────────────────────────────────────────────────────────────
TAG="${1:-}"
if [[ -z "${TAG}" ]]; then
  TAG="$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "manual")"
fi

IMAGE="ghcr.io/${GHCR_ORG}/${IMAGE_NAME}"
echo "==> Image:  ${IMAGE}:${TAG} (+ :latest)"
echo "==> Target: ${COOLIFY_BASE_URL} app ${COOLIFY_APP_UUID}"

# ── Log in to GHCR ───────────────────────────────────────────────────────────
echo "==> Logging in to ghcr.io as ${GHCR_USER}"
echo "${GHCR_PAT}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin

# ── Build (amd64) and push ───────────────────────────────────────────────────
# --platform linux/amd64 forces an amd64 image even when building on Apple
# Silicon / arm64. Requires docker buildx (bundled with modern Docker).
echo "==> Building and pushing linux/amd64 image"
docker buildx build \
  --platform linux/amd64 \
  --tag "${IMAGE}:${TAG}" \
  --tag "${IMAGE}:latest" \
  --push \
  "${REPO_ROOT}"

# ── Trigger Coolify redeploy ─────────────────────────────────────────────────
echo "==> Triggering Coolify redeploy"
HTTP_CODE="$(curl -sS -o /tmp/coolify_deploy_resp.$$ -w '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
  "${COOLIFY_BASE_URL}/api/v1/deploy?uuid=${COOLIFY_APP_UUID}")"
echo "    Coolify responded HTTP ${HTTP_CODE}"
cat /tmp/coolify_deploy_resp.$$ && echo
rm -f /tmp/coolify_deploy_resp.$$

if [[ "${HTTP_CODE}" -lt 200 || "${HTTP_CODE}" -ge 300 ]]; then
  echo "ERROR: Coolify redeploy request failed (HTTP ${HTTP_CODE})." >&2
  exit 1
fi

echo "==> Done: pushed ${IMAGE}:${TAG} and triggered redeploy."
