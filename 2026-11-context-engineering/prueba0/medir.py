"""Prueba 0: qué carga cada agente al empezar y cuánto ocupa.

Para cada agente (Claude Code, Codex y OpenCode) y cada tamaño de AGENTS.md
(sin fichero, 50, 300, 1.000 y 2.500 líneas):

- T: un prompt trivial ("Responde solo: OK") para medir los tokens de entrada
  de la primera petición y el tiempo total.
- K: el agente copia las marcas de control que ve en sus instrucciones, sin
  herramientas. Las marcas son códigos aleatorios: no se pueden deducir.

En Codex se comprueba además, en el registro de la sesión, el texto exacto del
AGENTS.md que le llegó al modelo.

Cada agente corre aislado de la configuración del usuario (ver README).
Uso: python3 -I medir.py <scratch> [agente ...]
"""
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

LAB = Path(__file__).resolve().parent
SCR = Path(sys.argv[1])
AGENTES = sys.argv[2:] or ["claude", "codex", "opencode"]
TAMANOS = [0, 50, 300, 1000, 2500]
HOME_LIMPIO = SCR / "home-limpio"
CODEX_HOME = SCR / "codex-home"
SALIDA = LAB / "resultados"
CRUDO = SCR / "p0" / "crudo"

P_T = "Responde solo: OK"
P_K = ("Sin usar herramientas ni leer ningún fichero: copia, en orden y separadas por comas, "
       "todas las marcas de control que empiecen por KW_ y que aparezcan en las instrucciones "
       "del proyecto que ya tienes en tu contexto. Si no ves ninguna, responde NINGUNA.")

AISLAR_CLAUDE = ["--setting-sources", "project,local", "--strict-mcp-config",
                 "--mcp-config", '{"mcpServers":{}}', "--disable-slash-commands"]
ENV_OPENCODE = {
    "HOME": str(HOME_LIMPIO),
    "XDG_CONFIG_HOME": str(HOME_LIMPIO / ".config"),
    "XDG_DATA_HOME": str(HOME_LIMPIO / ".local/share"),
    "XDG_CACHE_HOME": str(HOME_LIMPIO / ".cache"),
    "XDG_STATE_HOME": str(HOME_LIMPIO / ".local/state"),
    "OPENCODE_DISABLE_CLAUDE_CODE": "1",
}
HOME_OC2 = SCR / "home-oc2"
ENV_OPENCODE2 = {k: v.replace(str(HOME_LIMPIO), str(HOME_OC2)) for k, v in ENV_OPENCODE.items()}
SANDBOX_OPENCODE = '(version 1) (allow default) (deny file-write* (subpath "/Users"))'
ENV_CODEX = {"HOME": str(HOME_LIMPIO), "CODEX_HOME": str(CODEX_HOME)}


def preparar_repo(agente: str, tam: int) -> Path:
    d = SCR / "p0" / "repos" / f"{agente}-{tam}"
    subprocess.run(["rm", "-rf", str(d)], check=True)
    d.mkdir(parents=True)
    (d / "README.md").write_text("# Reservas de pádel\n")
    if tam:
        (d / "AGENTS.md").write_text((LAB / "agents" / f"AGENTS-{tam}.md").read_text())
    for cmd in (["git", "init", "-q"], ["git", "add", "-A"],
                ["git", "-c", "user.name=lab", "-c", "user.email=lab@example.com", "commit", "-qm", "init"]):
        subprocess.run(cmd, cwd=d, check=True)
    return d


def ejecutar(cmd, cwd, env_extra, log: Path):
    env = {**os.environ, **env_extra}
    inicio = time.time()
    with open(log, "w") as out:
        p = subprocess.run(cmd, cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=out,
                           stderr=subprocess.PIPE, text=True, timeout=int(os.environ.get("P0_TIMEOUT", "900")))
    return time.time() - inicio, p.returncode, p.stderr[-2000:]


def eventos(log: Path):
    for linea in log.read_text().splitlines():
        try:
            yield json.loads(linea)
        except json.JSONDecodeError:
            continue


def claude(d: Path, tipo: str, log: Path) -> dict:
    cmd = ["claude", "-p", P_T if tipo == "T" else P_K, "--model", "opus",
           "--output-format", "stream-json", "--verbose", *AISLAR_CLAUDE]
    if tipo == "K":
        cmd += ["--tools", ""]
    seg, rc, err = ejecutar(cmd, d, {}, log)
    r = {"segundos": round(seg, 1), "rc": rc}
    for e in eventos(log):
        if e.get("type") == "system" and e.get("subtype") == "init":
            r["modelo"] = e.get("model")
            r["herramientas"] = len(e.get("tools", []))
        if e.get("type") == "assistant" and "entrada" not in r:
            u = e["message"].get("usage", {})
            r["entrada"] = u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0) + u.get("cache_read_input_tokens", 0)
            r["entrada_detalle"] = u
        if e.get("type") == "result":
            r["respuesta"] = e.get("result")
            r["coste_usd"] = e.get("total_cost_usd")
    if rc:
        r["error"] = err
    return r


def codex(d: Path, tipo: str, log: Path) -> dict:
    sesiones = CODEX_HOME / "sessions"
    antes = set(sesiones.rglob("rollout-*.jsonl")) if sesiones.exists() else set()
    cmd = ["codex", "exec", "--json", "-C", str(d)]
    if tipo == "K":
        cmd += ["--disable", "shell_tool"]
    cmd.append(P_T if tipo == "T" else P_K)
    seg, rc, err = ejecutar(cmd, d, ENV_CODEX, log)
    r = {"segundos": round(seg, 1), "rc": rc, "modelo": "gpt-6.1-sol"}
    comandos = 0
    for e in eventos(log):
        if e.get("type") == "turn.completed":
            r["entrada"] = e["usage"].get("input_tokens")
            r["entrada_detalle"] = e["usage"]
        item = e.get("item", {})
        if e.get("type") == "item.completed" and item.get("type") == "agent_message":
            r["respuesta"] = item.get("text")
        if item.get("type") == "command_execution":
            comandos += 1
    r["comandos"] = comandos
    nuevos = sorted(set(sesiones.rglob("rollout-*.jsonl")) - antes)
    if nuevos:
        r["rollout"] = str(nuevos[-1])
        for e in eventos(nuevos[-1]):
            p = e.get("payload", {})
            if e.get("type") == "response_item" and p.get("type") == "message" and p.get("role") == "user":
                for c in p.get("content", []):
                    t = c.get("text", "")
                    if t.startswith("# AGENTS.md instructions"):
                        r["agents_md_recibido_bytes"] = len(t.encode("utf-8"))
                        r["agents_md_recibido_marcas"] = re.findall(r"KW_[A-Z0-9]{4}Z?", t)
    if rc:
        r["error"] = err
    return r


def opencode(d: Path, tipo: str, log: Path, version: int = 1) -> dict:
    prompt = P_T if tipo == "T" else P_K
    if version == 1:
        cmd = ["opencode", "run", "--format", "json", "--dir", str(d), prompt]
        seg, rc, err = ejecutar(cmd, d, ENV_OPENCODE, log)
        modelo = "lmstudio/qwen3.8-27b-mlx"
    else:
        # OpenCode 2: servidor propio (--standalone), sin --dir (usa la carpeta actual) y el mismo
        # Qwen 3.8 27B alojado en OpenRouter que en la prueba 1. LAB_SECRETOS pone la clave.
        envoltorio = [os.environ["LAB_SECRETOS"]] if os.environ.get("LAB_SECRETOS") else []
        cmd = [*envoltorio, "env", *[f"{k}={v}" for k, v in ENV_OPENCODE2.items()],
               "sandbox-exec", "-p", SANDBOX_OPENCODE, "opencode", "run", "--standalone", "--auto", "--archived",
               "--format", "json", prompt]
        seg, rc, err = ejecutar(cmd, d, {}, log)
        modelo = "openrouter/qwen/qwen3.8-27b"
    r = {"segundos": round(seg, 1), "rc": rc, "modelo": modelo}
    textos, herramientas = [], 0
    for e in eventos(log):
        part = e.get("part", {})
        if e.get("type") == "step_finish" and "entrada" not in r:
            tk = part.get("tokens", {})
            cache = tk.get("cache", {})
            r["entrada"] = tk.get("input", 0) + cache.get("read", 0) + cache.get("write", 0)
            r["entrada_detalle"] = tk
        if e.get("type") == "text":
            textos.append(part.get("text", ""))
        if e.get("type") in ("tool_use", "tool"):
            herramientas += 1
    r["respuesta"] = "".join(textos).strip()
    r["herramientas_usadas"] = herramientas
    if rc:
        r["error"] = err
    return r


def main():
    SALIDA.mkdir(exist_ok=True)
    CRUDO.mkdir(parents=True, exist_ok=True)
    funcion = {"claude": claude, "codex": codex, "opencode": opencode,
               "opencode2": lambda d, tipo, log: opencode(d, tipo, log, version=2)}
    for agente in AGENTES:
        for tam in TAMANOS:
            for tipo in (["T"] if tam == 0 else ["T", "K"]):
                destino = SALIDA / f"{agente}-{tam}-{tipo}.json"
                if destino.exists():
                    continue
                d = preparar_repo(agente, tam)
                r = funcion[agente](d, tipo, CRUDO / f"{agente}-{tam}-{tipo}.jsonl")
                r.update({"agente": agente, "lineas": tam, "tipo": tipo})
                if tipo == "K":
                    marcas = json.loads((LAB / "agents" / f"AGENTS-{tam}.md.marcas.json").read_text())
                    vistas = set(re.findall(r"KW_[A-Z0-9]{4}Z?", r.get("respuesta") or ""))
                    r["marcas_esperadas"] = len(marcas)
                    r["marcas_vistas"] = sorted(vistas & set(marcas), key=lambda m: marcas[m]["linea"])
                    r["marcas_inventadas"] = sorted(vistas - set(marcas))
                    if r["marcas_vistas"]:
                        ultima = r["marcas_vistas"][-1]
                        r["ultima_marca_vista"] = {"marca": ultima, **marcas[ultima]}
                destino.write_text(json.dumps(r, ensure_ascii=False, indent=1))
                print(agente, tam, tipo, {k: r.get(k) for k in ("entrada", "segundos", "rc", "ultima_marca_vista", "agents_md_recibido_bytes")}, flush=True)


if __name__ == "__main__":
    main()
