#!/usr/bin/env bash
# Todo lo de un agente, en orden: prueba 0, prueba 1 y prueba 2.
# Uso: LAB_SCRATCH=<scratch> runner/carril.sh <agente> [repeticiones de la prueba 0]
set -uo pipefail
cd "$(dirname "$0")/.."
agente="$1"
LAB_REPETICIONES="${2:-2}" python3 -I prueba0/medir.py "$agente"
runner/lote.sh "$agente" prueba1
runner/lote.sh "$agente" prueba2
