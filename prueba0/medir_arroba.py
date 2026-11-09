"""Prueba 0b: referencias en texto plano frente a @ en el fichero de instrucciones.

El mismo mapa de variantes/mapa/AGENTS.md, con docs/ y CONTEXT.md en el repo:

- plano: las rutas en texto plano (`docs/dominio.md`), como está el mapa.
- arroba-agents: las mismas rutas como @docs/dominio.md dentro de AGENTS.md.
- arroba-claude: el mapa con @ en CLAUDE.md, sin AGENTS.md (solo Claude Code).
- claude-importa-agents: CLAUDE.md con una línea "@AGENTS.md" y el mapa en texto plano
  en AGENTS.md, como lo monta el Harness Starter (solo Claude Code).

Mide los tokens de entrada de la primera petición con "Responde solo: OK".
Uso: python3 -I medir_arroba.py <scratch>
"""
import importlib.util
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("medir", AQUI / "medir.py")
medir = importlib.util.module_from_spec(spec)
spec.loader.exec_module(medir)

LAB = AQUI.parent
MAPA = (LAB / "variantes" / "mapa" / "AGENTS.md").read_text(encoding="utf-8")
# La puntuación que sigue a la ruta se quita: "@docs/dominio.md." no es un import válido.
CON_ARROBA = re.sub(r"`((?:docs/)?[\w-]+\.md|CONTEXT\.md)`[.,]?", r"@\1", MAPA)
SALIDA = AQUI / "resultados-arroba"

CASOS = {
    "plano": {"AGENTS.md": MAPA},
    "arroba-agents": {"AGENTS.md": CON_ARROBA},
    "arroba-claude": {"CLAUDE.md": CON_ARROBA},
    "claude-importa-agents": {"CLAUDE.md": "@AGENTS.md\n", "AGENTS.md": MAPA},
}
SOLO_CLAUDE = {"arroba-claude", "claude-importa-agents"}


def preparar(agente: str, caso: str) -> Path:
    d = medir.SCR / "p0b" / f"{agente}-{caso}"
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)
    shutil.copytree(LAB / "app" / "docs", d / "docs")
    shutil.copy(LAB / "app" / "CONTEXT.md", d / "CONTEXT.md")
    for nombre, texto in CASOS[caso].items():
        (d / nombre).write_text(texto, encoding="utf-8")
    for cmd in (["git", "init", "-q"], ["git", "add", "-A"],
                ["git", "-c", "user.name=lab", "-c", "user.email=lab@example.com", "commit", "-qm", "init"]):
        subprocess.run(cmd, cwd=d, check=True)
    return d


def main():
    SALIDA.mkdir(exist_ok=True)
    (medir.SCR / "p0b").mkdir(parents=True, exist_ok=True)
    funcion = {"claude": medir.claude, "codex": medir.codex, "opencode": medir.opencode}
    for agente in sys.argv[2:] or ["claude", "codex", "opencode"]:
        for caso in CASOS:
            if caso in SOLO_CLAUDE and agente != "claude":
                continue
            destino = SALIDA / f"{agente}-{caso}.json"
            if destino.exists():
                continue
            d = preparar(agente, caso)
            r = funcion[agente](d, "T", medir.CRUDO / f"arroba-{agente}-{caso}.jsonl")
            r.update({"agente": agente, "caso": caso})
            destino.write_text(json.dumps(r, ensure_ascii=False, indent=1))
            print(agente, caso, {k: r.get(k) for k in ("entrada", "segundos", "rc", "agents_md_recibido_bytes")}, flush=True)


if __name__ == "__main__":
    main()
