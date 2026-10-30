#!/usr/bin/env bash
# Sobe um servidor local, roda a suite de testes e derruba o servidor no fim.
# Uso:  bash tests/rodar.sh
set -u

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORTA="${PORTA:-8000}"

cd "$RAIZ"

if ! command -v node >/dev/null; then
  echo "Node.js nao encontrado. Instale em https://nodejs.org"; exit 1
fi
if ! node -e "require('playwright')" 2>/dev/null; then
  echo "Playwright nao encontrado. Instale com:"
  echo "  npm install -D playwright && npx playwright install chromium"
  exit 1
fi

python3 -m http.server "$PORTA" >/dev/null 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null' EXIT

for _ in $(seq 1 30); do
  curl -sf --noproxy '*' -o /dev/null "http://localhost:$PORTA/" && break
  sleep 1
done

if ! curl -sf --noproxy '*' -o /dev/null "http://localhost:$PORTA/"; then
  echo "O servidor local nao subiu na porta $PORTA."
  echo "Se a porta estiver ocupada, rode com outra:  PORTA=8080 bash tests/rodar.sh"
  exit 1
fi

BASE="http://localhost:$PORTA/" node tests/testes.js
