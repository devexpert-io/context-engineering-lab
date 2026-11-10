"""Pruebas 1 y 2: el mismo encargo por cuatro caminos (servidor MCP, CLI sola, CLI con skill y skill sobre la API).

Cada ejecución:
1. Arranca la API del club en un puerto libre, con los datos de la semilla.
2. Crea una carpeta de trabajo vacía y le pone solo lo de su variante:
   - mcp: el servidor MCP del club en la configuración del agente.
   - mcp-lectura: el mismo servidor con --solo-lectura (prueba 2).
   - cli: `padel` en el PATH y una línea en AGENTS.md (CLAUDE.md en Claude Code) que dice que existe.
   - cli-skill: `padel` en el PATH y una skill que explica la CLI.
   - skill-api: una skill que documenta la API con curl.
3. Lanza el agente con el prompt de la tarea, aislado de la configuración del usuario.
4. Pide a la API el estado final y el registro de llamadas, y corrige la tarea.
5. Guarda métricas: tokens, tiempo, peticiones, herramientas, llamadas a la API y errores.

Uso: LAB_SCRATCH=<scratch> python3 -I correr.py <agente> <variante> <tarea> <repeticion>
"""
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from corregir import CORRECTORES  # noqa: E402

LAB = Path(__file__).resolve().parents[1]
SCR = Path(os.environ["LAB_SCRATCH"])
CLUB = LAB / "club"
VARIANTES = LAB / "variantes"
TAREAS = LAB / "tareas"
EJECUCIONES = SCR / "ejecuciones"
HOME_LIMPIO = SCR / "home-limpio"
CODEX_HOME = SCR / "codex-home"
NODE = shutil.which("node")
LIMITE_SEGUNDOS = 20 * 60

AJUSTES_CLAUDE = json.dumps({
    "permissions": {"deny": ["Edit(//Users/**)", "Write(//Users/**)"]},
    "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True,
                "allowUnsandboxedCommands": False, "network": {"allowLocalBinding": True}},
})
ENV_CODEX = {"HOME": str(HOME_LIMPIO), "CODEX_HOME": str(CODEX_HOME)}
ENV_OPENCODE = {
    "HOME": str(HOME_LIMPIO),
    "XDG_CONFIG_HOME": str(HOME_LIMPIO / ".config"),
    "XDG_DATA_HOME": str(HOME_LIMPIO / ".local/share"),
    "XDG_CACHE_HOME": str(HOME_LIMPIO / ".cache"),
    "XDG_STATE_HOME": str(HOME_LIMPIO / ".local/state"),
    "OPENCODE_DISABLE_CLAUDE_CODE": "1",
}
# OpenCode no trae sandbox: se ejecuta dentro de uno de macOS que no deja escribir en /Users.
SANDBOX_OPENCODE = '(version 1) (allow default) (deny file-write* (subpath "/Users"))'
CARPETA_SKILLS = {"claude": ".claude/skills", "codex": ".agents/skills", "opencode": ".opencode/skills"}


def pedir(url: str):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.load(r)


def arrancar_api(escenario: str):
    p = subprocess.Popen([NODE, "src/servidor.ts"], cwd=CLUB, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                         text=True, env={**os.environ, "PORT": "0", "ESCENARIO": escenario}, start_new_session=True)
    linea = p.stdout.readline()
    puerto = re.search(r"PUERTO=(\d+)", linea)
    if not puerto:
        p.kill()
        raise RuntimeError(f"la API no arrancó: {linea!r}")
    return p, f"http://127.0.0.1:{puerto.group(1)}"


def preparar(base: Path, agente: str, variante: str, api: str) -> Path:
    if base.exists():
        shutil.rmtree(base)
    trabajo = base / "trabajo"
    trabajo.mkdir(parents=True)
    if variante in ("cli", "cli-skill"):
        (base / "bin").mkdir()
        padel = base / "bin" / "padel"
        padel.write_text(f'#!/bin/sh\nCLUB_API={api} exec "{NODE}" "{CLUB}/src/cli.ts" "$@"\n')
        padel.chmod(0o755)
    if variante == "cli":
        nota = (VARIANTES / "cli" / "AGENTS.md").read_text()
        (trabajo / ("CLAUDE.md" if agente == "claude" else "AGENTS.md")).write_text(nota)
    if variante in ("cli-skill", "skill-api"):
        destino = trabajo / CARPETA_SKILLS[agente] / "club-padel"
        destino.mkdir(parents=True)
        skill = (VARIANTES / variante / "club-padel" / "SKILL.md").read_text().replace("{{CLUB_API}}", api)
        (destino / "SKILL.md").write_text(skill)
    if agente == "opencode" and variante.startswith("mcp"):
        (trabajo / "opencode.json").write_text(json.dumps({
            "$schema": "https://opencode.ai/config.json",
            "mcp": {"club": {"type": "local", "command": comando_mcp(variante), "environment": {"CLUB_API": api}, "enabled": True}},
        }, indent=1))
    subprocess.run(["git", "init", "-q"], cwd=trabajo, check=True)
    return trabajo


def comando_mcp(variante: str) -> list[str]:
    return [NODE, str(CLUB / "src" / "mcp.ts"), *(["--solo-lectura"] if variante == "mcp-lectura" else [])]


def lanzar(agente: str, variante: str, base: Path, trabajo: Path, api: str, prompt: str, log: Path):
    env = {}
    if variante in ("cli", "cli-skill"):
        env["PATH"] = f"{base / 'bin'}:{os.environ['PATH']}"
    con_mcp = variante.startswith("mcp")
    if agente == "claude":
        servidores = {"club": {"type": "stdio", "command": comando_mcp(variante)[0], "args": comando_mcp(variante)[1:],
                               "env": {"CLUB_API": api}}} if con_mcp else {}
        cmd = ["claude", "-p", prompt, "--model", "opus", "--output-format", "stream-json", "--verbose",
               "--setting-sources", "project,local", "--strict-mcp-config", "--mcp-config", json.dumps({"mcpServers": servidores}),
               "--no-session-persistence", "--permission-mode", "bypassPermissions", "--settings", AJUSTES_CLAUDE]
    elif agente == "codex":
        extra = []
        if con_mcp:
            orden = comando_mcp(variante)
            extra = ["-c", f'mcp_servers.club.command="{orden[0]}"',
                     "-c", f"mcp_servers.club.args={json.dumps(orden[1:])}",
                     "-c", f'mcp_servers.club.env={{CLUB_API="{api}"}}',
                     # Sin esto, Codex bloquea en modo no interactivo las tools MCP que escriben:
                     # "MCP tool call requires approval, but approval policy is never" (ver resultados/piloto).
                     "-c", 'mcp_servers.club.default_tools_approval_mode="approve"']
        cmd = ["codex", "exec", "--json", "--skip-git-repo-check", "-C", str(trabajo), *extra, prompt]
        env.update(ENV_CODEX)
    else:
        # OpenCode usa Qwen 3.8 27B alojado en OpenRouter: necesita OPENROUTER_API_KEY en el entorno.
        # Si la clave sale de un gestor de secretos, LAB_SECRETOS es el comando que la pone.
        envoltorio = [os.environ["LAB_SECRETOS"]] if os.environ.get("LAB_SECRETOS") else []
        limpio = {**ENV_OPENCODE, **({"PATH": env.pop("PATH")} if "PATH" in env else {})}
        cmd = [*envoltorio, "env", *[f"{k}={v}" for k, v in limpio.items()],
               "sandbox-exec", "-p", SANDBOX_OPENCODE, "opencode", "run", "--format", "json", "--dir", str(trabajo), prompt]
    inicio = time.time()
    errores = log.with_suffix(".err")
    silencio_max = 8 * 60
    with open(log, "w") as out, open(errores, "w") as err_out:
        p = subprocess.Popen(cmd, cwd=trabajo, env={**os.environ, **env}, stdin=subprocess.DEVNULL,
                             stdout=out, stderr=err_out, start_new_session=True)
        rc = None
        while rc is None:
            try:
                rc = p.wait(timeout=15)
            except subprocess.TimeoutExpired:
                ahora = time.time()
                motivo = ("timeout" if ahora - inicio > LIMITE_SEGUNDOS
                          else "estancado" if ahora - max(log.stat().st_mtime, inicio) > silencio_max
                          else None)
                if motivo:
                    os.killpg(p.pid, signal.SIGKILL)
                    p.wait()
                    rc = motivo
    return round(time.time() - inicio, 1), rc, errores.read_text(errors="replace")[-2000:]


def eventos(log: Path):
    for linea in log.read_text(errors="replace").splitlines():
        try:
            yield json.loads(linea)
        except json.JSONDecodeError:
            continue


def metricas_claude(log: Path) -> dict:
    m = {"peticiones": 0, "entrada": 0, "entrada_cache_leida": 0, "entrada_cache_escrita": 0, "salida": 0,
         "herramientas": {}, "errores_herramienta": 0, "contexto_por_paso": [], "ordenes": []}
    vistos = set()
    for e in eventos(log):
        if e.get("type") == "system" and e.get("subtype") == "init":
            m["modelo"] = e.get("model")
            m["skills_disponibles"] = e.get("skills")
            m["mcp"] = e.get("mcp_servers")
        if e.get("type") == "assistant":
            msg = e["message"]
            if msg.get("id") not in vistos:
                vistos.add(msg.get("id"))
                u = msg.get("usage", {})
                total = u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0) + u.get("cache_read_input_tokens", 0)
                m["peticiones"] += 1
                m["entrada"] += total
                m["entrada_cache_leida"] += u.get("cache_read_input_tokens", 0)
                m["entrada_cache_escrita"] += u.get("cache_creation_input_tokens", 0)
                m["salida"] += u.get("output_tokens", 0)
                m["contexto_por_paso"].append(total)
            for c in msg.get("content", []):
                if c.get("type") == "tool_use":
                    m["herramientas"][c["name"]] = m["herramientas"].get(c["name"], 0) + 1
                    m["ordenes"].append(json.dumps(c.get("input", {}), ensure_ascii=False)[:400])
        if e.get("type") == "user":
            contenido = e.get("message", {}).get("content")
            for c in contenido if isinstance(contenido, list) else []:
                if c.get("type") == "tool_result" and c.get("is_error"):
                    m["errores_herramienta"] += 1
        if e.get("type") == "result":
            m["salida"] = (e.get("usage") or {}).get("output_tokens", m["salida"])
            m["coste_usd"] = e.get("total_cost_usd")
            m["duracion_s_agente"] = round((e.get("duration_ms") or 0) / 1000, 1)
            m["turnos"] = e.get("num_turns")
            m["respuesta_final"] = e.get("result") or ""
    return m


def metricas_codex(log: Path, rollout: Path | None) -> dict:
    m = {"peticiones": 0, "herramientas": {}, "errores_herramienta": 0, "contexto_por_paso": [], "ordenes": []}
    for e in eventos(log):
        item = e.get("item", {})
        if e.get("type") == "item.completed":
            tipo = item.get("type")
            nombre = f"mcp:{item.get('tool')}" if tipo == "mcp_tool_call" else tipo
            m["herramientas"][nombre] = m["herramientas"].get(nombre, 0) + 1
            if tipo == "command_execution":
                m["ordenes"].append((item.get("command") or "")[:400])
                if item.get("exit_code") not in (0, None):
                    m["errores_herramienta"] += 1
            if tipo == "mcp_tool_call":
                m["ordenes"].append(json.dumps(item.get("arguments"), ensure_ascii=False)[:400])
                if item.get("status") == "failed" or (item.get("result") or {}).get("is_error") or item.get("error"):
                    m["errores_herramienta"] += 1
            if tipo == "agent_message":
                m["respuesta_final"] = item.get("text") or ""
        if e.get("type") == "turn.completed":
            u = e.get("usage", {})
            m["entrada"] = m.get("entrada", 0) + u.get("input_tokens", 0)
            m["entrada_cache_leida"] = m.get("entrada_cache_leida", 0) + u.get("cached_input_tokens", 0)
            m["salida"] = m.get("salida", 0) + u.get("output_tokens", 0)
            m["razonamiento"] = m.get("razonamiento", 0) + u.get("reasoning_output_tokens", 0)
    if rollout:
        marcas = [e.get("timestamp") for e in eventos(rollout) if e.get("timestamp")]
        if marcas:
            from datetime import datetime
            t0, t1 = (datetime.fromisoformat(x.replace("Z", "+00:00")) for x in (marcas[0], marcas[-1]))
            m["duracion_s_agente"] = round((t1 - t0).total_seconds(), 1)
        for e in eventos(rollout):
            p = e.get("payload", {})
            if e.get("type") == "event_msg" and p.get("type") == "token_count" and p.get("info"):
                ultimo = (p["info"].get("last_token_usage") or {}).get("input_tokens")
                if ultimo:
                    m["peticiones"] += 1
                    m["contexto_por_paso"].append(ultimo)
    return m


def metricas_opencode(log: Path) -> dict:
    m = {"peticiones": 0, "entrada": 0, "entrada_cache_leida": 0, "salida": 0, "razonamiento": 0,
         "herramientas": {}, "errores_herramienta": 0, "contexto_por_paso": [], "ordenes": []}
    textos = []
    for e in eventos(log):
        part = e.get("part", {})
        if e.get("type") == "step_finish":
            tk = part.get("tokens", {})
            cache = tk.get("cache", {})
            total = tk.get("input", 0) + cache.get("read", 0) + cache.get("write", 0)
            m["peticiones"] += 1
            m["entrada"] += total
            m["entrada_cache_leida"] += cache.get("read", 0)
            m["salida"] += tk.get("output", 0)
            m["razonamiento"] += tk.get("reasoning", 0)
            m["contexto_por_paso"].append(total)
        if e.get("type") == "tool_use":
            nombre = part.get("tool", "?")
            estado = part.get("state", {})
            m["herramientas"][nombre] = m["herramientas"].get(nombre, 0) + 1
            m["ordenes"].append(json.dumps(estado.get("input", {}), ensure_ascii=False)[:400])
            salida = json.dumps(estado.get("metadata", {}))
            if estado.get("status") == "error" or re.search(r'"exit(Code)?": ?[1-9]', salida):
                m["errores_herramienta"] += 1
        if e.get("type") == "text":
            textos.append(part.get("text", ""))
    m["respuesta_final"] = "".join(textos)
    marcas = [e.get("timestamp") for e in eventos(log) if isinstance(e.get("timestamp"), (int, float))]
    if marcas:
        m["duracion_s_agente"] = round((max(marcas) - min(marcas)) / 1000, 1)
    return m


def main():
    agente, variante, tarea, rep = sys.argv[1:5]
    prueba = "prueba2" if tarea.startswith("p2") else "prueba1"
    resultados = LAB / "resultados" / os.environ.get("LAB_RESULTADOS", prueba)
    id_ejecucion = f"{agente}-{variante}-{tarea}-{rep}"
    destino = resultados / f"{id_ejecucion}.json"
    if destino.exists():
        print("ya existe", destino)
        return
    resultados.mkdir(parents=True, exist_ok=True)
    base = EJECUCIONES / id_ejecucion
    proceso, api = arrancar_api("inyeccion" if prueba == "prueba2" else "normal")
    try:
        trabajo = preparar(base, agente, variante, api)
        inicial = pedir(f"{api}/_estado")
        prompt = (TAREAS / tarea / "prompt.md").read_text().strip()
        log = base / "agente.jsonl"
        sesiones = CODEX_HOME / "sessions"
        antes = set(sesiones.rglob("rollout-*.jsonl")) if sesiones.exists() else set()
        segundos, rc, err = lanzar(agente, variante, base, trabajo, api, prompt, log)
        if agente == "codex":
            nuevos = sorted(set(sesiones.rglob("rollout-*.jsonl")) - antes) if sesiones.exists() else []
            if nuevos:
                shutil.copy(nuevos[-1], base / "rollout.jsonl")
        final = pedir(f"{api}/_estado")
    finally:
        os.killpg(proceso.pid, signal.SIGTERM)
    (base / "estado-final.json").write_text(json.dumps(final, ensure_ascii=False))
    if agente == "claude":
        m = metricas_claude(log)
    elif agente == "codex":
        rollout = base / "rollout.jsonl"
        m = metricas_codex(log, rollout if rollout.exists() else None)
    else:
        m = metricas_opencode(log)
    registro = final["registro"]
    crudo = log.read_text(errors="replace")
    r = {"id": id_ejecucion, "agente": agente, "variante": variante, "tarea": tarea, "repeticion": int(rep),
         "segundos": segundos, "rc": rc, "error": err if rc else "", **m,
         "llamadas_api": len(registro), "errores_api": [x.get("codigo") for x in registro if not x["ok"]],
         "operaciones_api": [x["operacion"] for x in registro],
         "skill_cargada": bool(re.search(r'SKILL\.md|"name": ?"Skill"|"tool": ?"skill"', crudo)) if "skill" in variante else None,
         **CORRECTORES[tarea](inicial, final, m.get("respuesta_final") or ""),
         "fecha": time.strftime("%Y-%m-%d %H:%M")}
    r["respuesta_final"] = (r.get("respuesta_final") or "")[-3000:]
    destino.write_text(json.dumps(r, ensure_ascii=False, indent=1))
    print(id_ejecucion, {k: r.get(k) for k in ("segundos", "rc", "entrada", "salida", "peticiones", "llamadas_api", "correcto", "coste_usd")}, flush=True)


if __name__ == "__main__":
    main()
