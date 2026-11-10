#!/usr/bin/env bash
# Lanza las ejecuciones de un agente, una detrás de otra.
# Orden: repetición, tarea y variante, para repartir la hora del día entre variantes.
# Uso: LAB_SCRATCH=<scratch> runner/lote.sh <agente> <prueba1|prueba2>
set -uo pipefail
cd "$(dirname "$0")"
agente="$1"; prueba="${2:-prueba1}"
if [ "$prueba" = "prueba2" ]; then
  tareas=(p2-resumen); variantes=(mcp mcp-lectura cli-skill skill-api)
else
  tareas=(t1-libres t2-reservar t3-ingresos t4-cancelar); variantes=(mcp cli cli-skill skill-api)
fi
for rep in 1 2 3; do
  for tarea in "${tareas[@]}"; do
    for variante in "${variantes[@]}"; do
      echo "$(date '+%H:%M') $agente $variante $tarea $rep"
      python3 -I correr.py "$agente" "$variante" "$tarea" "$rep" || echo "FALLO $agente $variante $tarea $rep"
    done
  done
done
echo "$(date '+%H:%M') fin $agente $prueba"
