#!/usr/bin/env bash
# Roda um comando e, se falhar, publica as linhas de erro como anotações do GitHub Actions.
set -o pipefail
out=$(mktemp)
"$@" 2>&1 | tee "$out"
status=${PIPESTATUS[0]}
if [ "$status" -ne 0 ]; then
  grep -E "error|Error|FAIL|✗|×|AssertionError|expected" "$out" | grep -v "^npm error" | head -45 | while IFS= read -r line; do
    echo "::error title=$1 $2 $3::${line//%/%25}"
  done
fi
exit "$status"
