#!/bin/sh
set -eu

for script in /docker-entrypoint.d/*.sh; do
  [ -e "$script" ] || continue
  sh "$script" >/dev/null 2>&1 || sh "$script"
done

for script in /docker-entrypoint.d/*.envsh; do
  [ -e "$script" ] || continue
  # shellcheck disable=SC1090
  . "$script" >/dev/null 2>&1 || true
done

export DOLLAR='$'

if [ -d /etc/nginx/templates ]; then
  for template in /etc/nginx/templates/*.template; do
    [ -e "$template" ] || continue
    target="/etc/nginx/conf.d/$(basename "$template" .template)"
    envsubst '${DOLLAR}' < "$template" > "$target"
  done
fi

echo "$(printf '\033[2m%s\033[0m \033[32mINFO \033[0m frontend nginx ready' "$(date -u +%Y-%m-%dT%H:%M:%SZ)")"
nginx -g "daemon off;" 2>&1 | awk '
  /\\[emerg\\]|\\[error\\]/ { printf "\033[2m%s\033[0m \033[31mERROR\033[0m %s\n", strftime("%Y-%m-%dT%H:%M:%SZ", systime(), 1), $0; fflush(); next }
  /\\[warn\\]/ { printf "\033[2m%s\033[0m \033[33mWARN \033[0m %s\n", strftime("%Y-%m-%dT%H:%M:%SZ", systime(), 1), $0; fflush(); next }
  / ACCESS / { sub(/ ACCESS /, " "); printf "\033[2m%s\033[0m \033[32mACCESS\033[0m %s\n", $1, substr($0, index($0, $2)); fflush(); next }
  { printf "\033[2m%s\033[0m \033[32mINFO \033[0m %s\n", strftime("%Y-%m-%dT%H:%M:%SZ", systime(), 1), $0; fflush() }
'
