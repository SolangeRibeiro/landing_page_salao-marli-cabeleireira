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

# Checagem de sintaxe primeiro: e instantanea, e um erro aqui derruba a pagina
# inteira. Pega, por exemplo, aspas curvas que editores de texto inserem sozinhos.
for arquivo in assets/js/main.js tests/testes.js; do
  if ! node --check "$arquivo" 2>/tmp/erro-sintaxe.txt; then
    echo
    echo "ERRO DE SINTAXE em $arquivo — a pagina nao vai funcionar assim:"
    echo
    sed 's/^/  /' /tmp/erro-sintaxe.txt
    echo
    echo "Dica: se voce editou o arquivo num editor de texto comum, ele pode ter"
    echo "trocado as aspas retas ' por aspas curvas. Para desfazer a edicao:"
    echo "  git checkout $arquivo"
    exit 1
  fi
done

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
