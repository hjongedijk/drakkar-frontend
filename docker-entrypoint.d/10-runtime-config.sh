#!/bin/sh
set -eu

cat > /usr/share/nginx/html/config.js <<EOF
window.__DRAKKAR_CONFIG__ = {
  API_BASE_URL: "${API_BASE_URL:-}",
  FRONTEND_API_TOKEN: "${FRONTEND_API_TOKEN:-dev-frontend-token}"
};
EOF
