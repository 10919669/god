#!/usr/bin/env bash
# God Project Deployment Script
# Usage: ./deploy-god.sh

set -euo pipefail

SERVER="root@8.148.245.29"
REMOTE_DIR="/www/wwwroot/awkn-lab/god"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Deploying to ${SERVER}:${REMOTE_DIR}..."

scp -r -o ConnectTimeout=30 \
  "${SCRIPT_DIR}/index.html" \
  "${SCRIPT_DIR}/css" \
  "${SCRIPT_DIR}/js" \
  "${SCRIPT_DIR}/assets" \
  "${SERVER}:${REMOTE_DIR}/"

ssh "${SERVER}" "find '${REMOTE_DIR}' -type d -exec chmod 755 '{}' ';' && find '${REMOTE_DIR}' -type f -exec chmod 644 '{}' ';'"

echo "Deployment successful!"
