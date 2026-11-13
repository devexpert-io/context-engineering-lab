#!/usr/bin/env bash
# Lanza las ejecuciones de la prueba 1 de un agente, una detrás de otra.
# Orden: repetición, tarea y variante, para repartir la hora del día entre variantes.
# Uso: LAB_SCRATCH=<scratch> runner/lote.sh <agente> [tareas...]
set -uo pipefail
cd "$(dirname "$0")"
agente="$1"; shift
tareas=("${@:-t1-cancelar t2-semana t3-bloqueos}")
read -r -a tareas <<< "${tareas[*]}"
variantes=(mapa inflado)
if [ "$agente" = "claude" ]; then variantes+=(sin); fi
for rep in 1 2 3; do
  for tarea in "${tareas[@]}"; do
    for variante in "${variantes[@]}"; do
      echo "$(date '+%H:%M') $agente $variante $tarea $rep"
      python3 -I correr.py "$agente" "$variante" "$tarea" "$rep" || echo "FALLO $agente $variante $tarea $rep"
    done
  done
done
echo "$(date '+%H:%M') fin $agente"
