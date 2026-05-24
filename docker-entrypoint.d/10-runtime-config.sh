#!/bin/sh
set -eu

CONFIG_FILE="${DRAKKAR_CONFIG_FILE:-/data/config/settings.json}"
CONFIG_API_BASE_URL=""
CONFIG_FRONTEND_API_TOKEN=""
CONFIG_DOCS_URL="https://wiki.drakkar.botcontrol.nl/"

if [ -r "$CONFIG_FILE" ]; then
  CONFIG_API_BASE_URL="$(sed -n 's/.*"apiBaseUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$CONFIG_FILE" | head -n 1)"
  CONFIG_FRONTEND_API_TOKEN="$(sed -n 's/.*"frontendApiToken"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$CONFIG_FILE" | head -n 1)"
  CONFIG_DOCS_URL="$(sed -n 's/.*"docsUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$CONFIG_FILE" | head -n 1 || true)"
fi

[ -n "$CONFIG_DOCS_URL" ] || CONFIG_DOCS_URL="https://wiki.drakkar.botcontrol.nl/"

cat > /usr/share/nginx/html/config.js <<EOF
window.__DRAKKAR_CONFIG__ = {
  API_BASE_URL: "$CONFIG_API_BASE_URL",
  FRONTEND_API_TOKEN: "$CONFIG_FRONTEND_API_TOKEN",
  DOCS_URL: "$CONFIG_DOCS_URL"
};
EOF
