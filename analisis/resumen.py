"""Resume la prueba 1 para el artículo.

Lee resultados/prueba1/*.json y escribe:
- analisis/resumen.md: tabla por agente, tarea y variante (mediana y rango de 3 repeticiones).
- analisis/datos-prueba1.json: los datos que usan las figuras del artículo.

Para el crecimiento del contexto paso a paso, elige en cada variante la ejecución de
Claude Code en T1 con la mediana de tokens de entrada. Para el peso de las salidas de
herramientas, mide en caracteres qué parte de lo que se acumula en la sesión (mensajes
del agente y resultados de herramientas) son resultados de herramientas, con los
registros de Claude Code.

Uso: LAB_SCRATCH=<scratch> python3 -I analisis/resumen.py
"""
import json
import os
import statistics
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
RES = LAB / "resultados" / "prueba1"
SCR = Path(os.environ.get("LAB_SCRATCH", "/tmp"))
AGENTES = ["claude", "codex", "opencode2", "opencode"]
TAREAS = ["t1-cancelar", "t2-semana", "t3-bloqueos"]
VARIANTES = ["mapa", "inflado", "sin"]


def cargar():
    return [json.loads(f.read_text()) for f in sorted(RES.glob("*.json"))]


def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None


def rango(xs):
    xs = [x for x in xs if x is not None]
    return (min(xs), max(xs)) if xs else (None, None)


def caracteres_por_origen(log: Path):
    """Caracteres de resultados de herramientas y de texto del agente en un registro de Claude Code."""
    herramientas = agente = 0
    for linea in log.read_text(errors="replace").splitlines():
        try:
            e = json.loads(linea)
        except json.JSONDecodeError:
            continue
        if e.get("type") == "user":
            for c in e.get("message", {}).get("content") or []:
                if isinstance(c, dict) and c.get("type") == "tool_result":
                    contenido = c.get("content")
                    if isinstance(contenido, list):
                        contenido = "".join(x.get("text", "") for x in contenido if isinstance(x, dict))
                    herramientas += len(str(contenido or ""))
        if e.get("type") == "assistant":
            for c in e["message"].get("content", []):
                if c.get("type") == "text":
                    agente += len(c.get("text", ""))
                if c.get("type") == "tool_use":
                    agente += len(json.dumps(c.get("input", {}), ensure_ascii=False))
    return herramientas, agente


def main():
    filas = cargar()
    tabla, datos = [], {"celdas": [], "pasos": {}, "salidas_herramientas": {}}
    for agente in AGENTES:
        for tarea in TAREAS:
            for variante in VARIANTES:
                rs = [r for r in filas if (r["agente"], r["tarea"], r["variante"]) == (agente, tarea, variante)]
                if not rs:
                    continue
                ok = [len(r.get("ocultos_ok", [])) for r in rs]
                total = rs[0].get("ocultos_total")
                celda = {
                    "agente": agente, "tarea": tarea, "variante": variante, "n": len(rs),
                    "entrada_med": med([r.get("entrada") for r in rs]),
                    "entrada_rango": rango([r.get("entrada") for r in rs]),
                    "sin_cache_med": med([(r.get("entrada") or 0) - (r.get("entrada_cache_leida") or 0) for r in rs]),
                    "salida_med": med([r.get("salida") for r in rs]),
                    "peticiones_med": med([r.get("peticiones") for r in rs]),
                    "segundos_med": med([r.get("duracion_s_agente") for r in rs]),
                    "segundos_rango": rango([r.get("duracion_s_agente") for r in rs]),
                    "coste_med": med([r.get("coste_usd") for r in rs]),
                    "ocultos": f"{sum(ok)}/{(total or 0) * len(rs)}",
                    "gate": f"{sum(1 for r in rs if r.get('gate_ok'))}/{len(rs)}",
                    "docs_med": med([len(r.get("documentos_leidos") or {}) for r in rs]),
                    "leyo_dominio": sum(1 for r in rs if "docs/dominio.md" in (r.get("documentos_leidos") or {})),
                    "estancadas": sum(1 for r in rs if r.get("rc") not in (0, None)),
                }
                datos["celdas"].append(celda)
                tabla.append(celda)

    # Crecimiento del contexto paso a paso: Claude Code, T1, ejecución con la mediana de entrada.
    for variante in VARIANTES:
        rs = sorted([r for r in filas if (r["agente"], r["tarea"], r["variante"]) == ("claude", "t1-cancelar", variante)],
                    key=lambda r: r.get("entrada") or 0)
        if rs:
            r = rs[len(rs) // 2]
            datos["pasos"][variante] = {"id": r["id"], "contexto_por_paso": r.get("contexto_por_paso", [])}

    # Peso de las salidas de herramientas en lo que se acumula (Claude Code, todas las ejecuciones).
    for tarea in TAREAS:
        h = a = 0
        for r in filas:
            if r["agente"] != "claude" or r["tarea"] != tarea:
                continue
            log = SCR / "p1" / r["id"] / "agente.jsonl"
            if log.exists():
                hh, aa = caracteres_por_origen(log)
                h, a = h + hh, a + aa
        if h + a:
            datos["salidas_herramientas"][tarea] = round(100 * h / (h + a), 1)

    (LAB / "analisis" / "datos-prueba1.json").write_text(json.dumps(datos, ensure_ascii=False, indent=1))
    lineas = ["| Agente | Tarea | Variante | n | Entrada (mediana) | Rango | Sin caché | Salida | Peticiones | Segundos | Coste $ | Ocultos | Gate | Docs leídos | Leyó dominio.md | Estancadas |",
              "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for c in tabla:
        lineas.append(f"| {c['agente']} | {c['tarea']} | {c['variante']} | {c['n']} | {c['entrada_med']} | {c['entrada_rango'][0]}–{c['entrada_rango'][1]} | {c['sin_cache_med']} | {c['salida_med']} | {c['peticiones_med']} | {c['segundos_med']} | {c['coste_med']} | {c['ocultos']} | {c['gate']} | {c['docs_med']} | {c['leyo_dominio']} | {c['estancadas']} |")
    lineas.append("")
    lineas.append(f"Salidas de herramientas sobre lo acumulado (Claude Code, caracteres): {datos['salidas_herramientas']}")
    (LAB / "analisis" / "resumen.md").write_text("\n".join(lineas) + "\n")
    print("\n".join(lineas))


if __name__ == "__main__":
    main()
