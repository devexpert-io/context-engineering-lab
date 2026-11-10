"""Prueba 0: qué cuesta tener servidores MCP conectados antes de usarlos.

Lanza cada agente con un prompt trivial ("Responde solo: OK") y distintos servidores conectados,
y apunta los tokens de entrada de la primera petición. La diferencia con la ejecución sin servidores
es lo que ocupan en el contexto.

Configuraciones: sin servidores, club (el del laboratorio, 8 tools), playwright, chrome-devtools,
context7 (remoto) y todos a la vez.
Modos: "defecto" (como viene cada agente) y, en Claude Code, "sin-diferir" (ENABLE_TOOL_SEARCH=false,
que carga los esquemas completos al arrancar, como en 2025).

Uso: LAB_SCRATCH=<scratch> python3 -I medir.py <agente> [configuraciones...]
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
SCR = Path(os.environ["LAB_SCRATCH"])
SERVIDORES_DIR = SCR / "servidores" / "node_modules"
RESULTADOS = LAB / "prueba0" / "resultados"
HOME_LIMPIO = SCR / "home-limpio"
CODEX_HOME = SCR / "codex-home"
NODE = shutil.which("node")
PROMPT = "Responde solo: OK"
REPETICIONES = int(os.environ.get("LAB_REPETICIONES", "2"))

SERVIDORES = {
    "club": {"command": [NODE, str(LAB / "club/src/mcp.ts")], "env": {"CLUB_API": "http://127.0.0.1:9"}},
    "playwright": {"command": [NODE, str(SERVIDORES_DIR / "@playwright/mcp/cli.js")]},
    "chrome-devtools": {"command": [NODE, str(SERVIDORES_DIR / "chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js"),
                                    "--no-usage-statistics", "--no-performance-crux"]},
    "context7": {"url": "https://mcp.context7.com/mcp"},
}
CONFIGURACIONES = {"sin": [], "club": ["club"], "playwright": ["playwright"], "chrome-devtools": ["chrome-devtools"],
                   "context7": ["context7"], "todos": list(SERVIDORES)}
MODOS = {"claude": ["defecto", "sin-diferir"], "codex": ["defecto"], "opencode": ["defecto"],
         "opencode2": ["defecto", "sin-codemode"]}
HOME_OC2 = SCR / "home-oc2"
ENV_OPENCODE = {
    "HOME": str(HOME_LIMPIO),
    "XDG_CONFIG_HOME": str(HOME_LIMPIO / ".config"),
    "XDG_DATA_HOME": str(HOME_LIMPIO / ".local/share"),
    "XDG_CACHE_HOME": str(HOME_LIMPIO / ".cache"),
    "XDG_STATE_HOME": str(HOME_LIMPIO / ".local/state"),
    "OPENCODE_DISABLE_CLAUDE_CODE": "1",
}
SANDBOX_OPENCODE = '(version 1) (allow default) (deny file-write* (subpath "/Users"))'


def eventos(texto: str):
    for linea in texto.splitlines():
        try:
            yield json.loads(linea)
        except json.JSONDecodeError:
            continue


def medir(agente: str, config: str, modo: str, rep: int) -> dict:
    nombres = CONFIGURACIONES[config]
    trabajo = SCR / "p0" / f"{agente}-{config}-{modo}-{rep}"
    if trabajo.exists():
        shutil.rmtree(trabajo)
    trabajo.mkdir(parents=True)
    subprocess.run(["git", "init", "-q"], cwd=trabajo, check=True)
    env = {}
    if agente == "claude":
        servidores = {}
        for n in nombres:
            s = SERVIDORES[n]
            servidores[n] = ({"type": "http", "url": s["url"]} if "url" in s else
                             {"type": "stdio", "command": s["command"][0], "args": s["command"][1:], "env": s.get("env", {})})
        cmd = ["claude", "-p", PROMPT, "--model", "opus", "--output-format", "stream-json", "--verbose",
               "--setting-sources", "project,local", "--strict-mcp-config", "--mcp-config", json.dumps({"mcpServers": servidores}),
               "--no-session-persistence", "--permission-mode", "bypassPermissions"]
        if modo == "sin-diferir":
            env["ENABLE_TOOL_SEARCH"] = "false"
    elif agente == "codex":
        extra = []
        for n in nombres:
            s = SERVIDORES[n]
            if "url" in s:
                extra += ["-c", f'mcp_servers.{n}.url="{s["url"]}"']
            else:
                extra += ["-c", f'mcp_servers.{n}.command="{s["command"][0]}"', "-c", f"mcp_servers.{n}.args={json.dumps(s['command'][1:])}"]
                if s.get("env"):
                    pares = ",".join(f'{k}="{v}"' for k, v in s["env"].items())
                    extra += ["-c", f"mcp_servers.{n}.env={{{pares}}}"]
        cmd = ["codex", "exec", "--json", "--skip-git-repo-check", "-C", str(trabajo), *extra, PROMPT]
        env.update({"HOME": str(HOME_LIMPIO), "CODEX_HOME": str(CODEX_HOME)})
    elif agente == "opencode2":
        servidores = {}
        for n in nombres:
            s = SERVIDORES[n]
            servidores[n] = ({"type": "remote", "url": s["url"]} if "url" in s else
                             {"type": "local", "command": s["command"], "environment": s.get("env", {})})
            if modo == "sin-codemode":
                servidores[n]["codemode"] = False
        (trabajo / "opencode.json").write_text(json.dumps({"$schema": "https://opencode.ai/config.json", "mcp": {"servers": servidores}}, indent=1))
        envoltorio = [os.environ["LAB_SECRETOS"]] if os.environ.get("LAB_SECRETOS") else []
        limpio = {k: v.replace(str(HOME_LIMPIO), str(HOME_OC2)) for k, v in ENV_OPENCODE.items()}
        cmd = [*envoltorio, "env", *[f"{k}={v}" for k, v in limpio.items()],
               "sandbox-exec", "-p", SANDBOX_OPENCODE, "opencode", "run", "--standalone", "--auto", "--archived", "--format", "json", PROMPT]
    else:
        mcp = {}
        for n in nombres:
            s = SERVIDORES[n]
            mcp[n] = ({"type": "remote", "url": s["url"], "enabled": True} if "url" in s else
                      {"type": "local", "command": s["command"], "environment": s.get("env", {}), "enabled": True})
        (trabajo / "opencode.json").write_text(json.dumps({"$schema": "https://opencode.ai/config.json", "mcp": mcp}, indent=1))
        envoltorio = [os.environ["LAB_SECRETOS"]] if os.environ.get("LAB_SECRETOS") else []
        cmd = [*envoltorio, "env", *[f"{k}={v}" for k, v in ENV_OPENCODE.items()],
               "sandbox-exec", "-p", SANDBOX_OPENCODE, "opencode", "run", "--format", "json", "--dir", str(trabajo), PROMPT]
    sesiones = CODEX_HOME / "sessions"
    antes = set(sesiones.rglob("rollout-*.jsonl")) if sesiones.exists() else set()
    inicio = time.time()
    try:
        p = subprocess.run(cmd, cwd=trabajo, env={**os.environ, **env}, stdin=subprocess.DEVNULL,
                           capture_output=True, text=True, timeout=300)
        salida, rc = p.stdout, p.returncode
    except subprocess.TimeoutExpired as e:
        salida, rc = (e.stdout or b"").decode(errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or ""), "timeout"
    (trabajo / "agente.jsonl").write_text(salida)
    r = {"agente": agente, "config": config, "modo": modo, "repeticion": rep, "rc": rc,
         "segundos": round(time.time() - inicio, 1), "servidores": nombres}
    if agente == "claude":
        for e in eventos(salida):
            if e.get("type") == "system" and e.get("subtype") == "init":
                r["mcp"] = {s["name"]: s["status"] for s in e.get("mcp_servers", [])}
                r["tools_listadas"] = len(e.get("tools", []))
                r["tools_mcp_listadas"] = len([t for t in e.get("tools", []) if t.startswith("mcp__")])
            if e.get("type") == "assistant" and "entrada" not in r:
                u = e["message"].get("usage", {})
                r["entrada"] = u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0) + u.get("cache_read_input_tokens", 0)
            if e.get("type") == "result":
                r["coste_usd"] = e.get("total_cost_usd")
                r["respuesta"] = (e.get("result") or "")[:80]
    elif agente == "codex":
        for e in eventos(salida):
            if e.get("type") == "turn.completed":
                r["entrada"] = e["usage"].get("input_tokens")
            if e.get("type") == "item.completed" and e["item"].get("type") == "agent_message":
                r["respuesta"] = (e["item"].get("text") or "")[:80]
        nuevos = sorted(set(sesiones.rglob("rollout-*.jsonl")) - antes) if sesiones.exists() else []
        if nuevos:
            rollout = nuevos[-1].read_text(errors="replace")
            shutil.copy(nuevos[-1], trabajo / "rollout.jsonl")
            r["mcp"] = {n: ("visto" if re.search("mcp__" + n.replace("-", "[-_]"), rollout) else "no visto") for n in nombres}
    else:
        for e in eventos(salida):
            if e.get("type") == "step_finish" and "entrada" not in r:
                tk = e["part"].get("tokens", {})
                r["entrada"] = tk.get("input", 0) + tk.get("cache", {}).get("read", 0) + tk.get("cache", {}).get("write", 0)
            if e.get("type") == "text":
                r["respuesta"] = (r.get("respuesta", "") + e["part"].get("text", ""))[:80]
            if e.get("type") == "error":
                r["error"] = str(e.get("error"))[:300]
    return r


def main():
    agente = sys.argv[1]
    configs = sys.argv[2:] or list(CONFIGURACIONES)
    RESULTADOS.mkdir(parents=True, exist_ok=True)
    for rep in range(1, REPETICIONES + 1):
        for config in configs:
            for modo in MODOS[agente]:
                destino = RESULTADOS / f"{agente}-{config}-{modo}-{rep}.json"
                if destino.exists():
                    continue
                r = medir(agente, config, modo, rep)
                destino.write_text(json.dumps(r, ensure_ascii=False, indent=1))
                print(agente, config, modo, rep, {k: r.get(k) for k in ("entrada", "rc", "mcp", "tools_mcp_listadas", "coste_usd", "respuesta", "error")}, flush=True)


if __name__ == "__main__":
    main()
