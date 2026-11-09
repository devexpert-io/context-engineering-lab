"""Prueba 1: el mismo encargo con un AGENTS.md que hace de mapa, con uno inflado y sin AGENTS.md.

Cada ejecución:
1. Clona app/ (con node_modules) en una carpeta nueva y aplica la variante:
   - mapa: AGENTS.md corto, con docs/ y CONTEXT.md en el repo.
   - inflado: AGENTS.md con el mapa y todos los documentos dentro. Sin docs/ ni CONTEXT.md.
   - sin: sin AGENTS.md, con docs/ y CONTEXT.md.
2. Si la tarea trae bug.patch, lo aplica. Hace un commit "base".
3. Lanza el agente con el prompt de la tarea, aislado de la configuración del usuario.
4. Corrige: gate (npm run check), tests ocultos de la tarea y comprobaciones de reglas.
5. Guarda métricas: tokens, tiempo, peticiones, herramientas y documentos leídos.

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
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
SCR = Path(os.environ["LAB_SCRATCH"])
APP = LAB / "app"
VARIANTES = LAB / "variantes"
TAREAS = LAB / "tareas"
RESULTADOS = LAB / "resultados" / "prueba1"
EJECUCIONES = SCR / "p1"
HOME_LIMPIO = SCR / "home-limpio"
CODEX_HOME = SCR / "codex-home"
LIMITE_SEGUNDOS = 45 * 60

AISLAR_CLAUDE = ["--setting-sources", "project,local", "--strict-mcp-config",
                 "--mcp-config", '{"mcpServers":{}}', "--disable-slash-commands",
                 "--no-session-persistence", "--permission-mode", "bypassPermissions",
                 "--settings", json.dumps({
                     "permissions": {"deny": ["Edit(//Users/**)", "Write(//Users/**)"]},
                     # Los tests abren un servidor en 127.0.0.1: sin allowLocalBinding se quedan colgados.
                     "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True,
                                 "allowUnsandboxedCommands": False, "network": {"allowLocalBinding": True}},
                 })]
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
DOCUMENTOS = re.compile(r"(docs/[\w.-]+\.md|CONTEXT\.md|AGENTS\.md|README\.md)")
GIT = ["git", "-c", "user.name=lab", "-c", "user.email=lab@example.com"]
EXCLUIR = "node_modules/\n.claude/\n.opencode/\noculto/\n"


def sh(cmd, cwd, timeout=600, env=None):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout,
                       env={**os.environ, **(env or {})}, stdin=subprocess.DEVNULL)
    return p.returncode, p.stdout + p.stderr


def preparar(id_ejecucion: str, variante: str, tarea: str) -> Path:
    base = EJECUCIONES / id_ejecucion
    if base.exists():
        shutil.rmtree(base)
    base.mkdir(parents=True)
    repo = base / "repo"
    subprocess.run(["cp", "-cR", str(APP), str(repo)], check=True)
    if variante in ("mapa", "inflado"):
        shutil.copy(VARIANTES / variante / "AGENTS.md", repo / "AGENTS.md")
    if variante == "inflado":
        shutil.rmtree(repo / "docs")
        (repo / "CONTEXT.md").unlink()
    parche = TAREAS / tarea / "bug.patch"
    if parche.exists():
        rc, out = sh(["git", "apply", str(parche)], repo)
        if rc:
            raise RuntimeError(f"no se pudo aplicar el parche: {out}")
    sh(["git", "init", "-q"], repo)
    (repo / ".git" / "info" / "exclude").write_text(EXCLUIR)
    sh(["git", "add", "-A"], repo)
    sh([*GIT, "commit", "-qm", "base"], repo)
    sh(["git", "tag", "base"], repo)
    return repo


def lanzar(agente: str, repo: Path, prompt: str, log: Path):
    if agente == "claude":
        cmd = ["claude", "-p", prompt, "--model", "opus", "--output-format", "stream-json",
               "--verbose", *AISLAR_CLAUDE]
        env = {}
    elif agente == "codex":
        cmd = ["codex", "exec", "--json", "-C", str(repo), prompt]
        env = ENV_CODEX
    else:
        # OpenCode usa Qwen 3.8 27B alojado en OpenRouter: necesita OPENROUTER_API_KEY en el entorno.
        # Si la clave sale de un gestor de secretos, LAB_SECRETOS es el comando que la pone (en las
        # ejecuciones del artículo, oprun). `env` aplica después el entorno limpio.
        envoltorio = [os.environ["LAB_SECRETOS"]] if os.environ.get("LAB_SECRETOS") else []
        cmd = [*envoltorio, "env", *[f"{k}={v}" for k, v in ENV_OPENCODE.items()],
               "sandbox-exec", "-p", SANDBOX_OPENCODE, "opencode", "run", "--format", "json",
               "--dir", str(repo), prompt]
        env = {}
    inicio = time.time()
    errores = log.with_suffix(".err")
    # Grupo de procesos propio: si se pasa del límite, se mata el agente con todo lo que haya lanzado.
    # Vigilante: si el registro del agente no cambia en este tiempo, la ejecución está estancada
    # (pasó con Codex: el modelo dejó de responder y el proceso siguió vivo).
    silencio_max = 15 * 60 if agente == "opencode" else 10 * 60
    with open(log, "w") as out, open(errores, "w") as err_out:
        p = subprocess.Popen(cmd, cwd=repo, env={**os.environ, **env}, stdin=subprocess.DEVNULL,
                             stdout=out, stderr=err_out, start_new_session=True)
        rc = None
        while rc is None:
            try:
                rc = p.wait(timeout=30)
            except subprocess.TimeoutExpired:
                ahora = time.time()
                motivo = ("timeout" if ahora - inicio > LIMITE_SEGUNDOS
                          else "estancado" if ahora - max(log.stat().st_mtime, inicio) > silencio_max
                          else None)
                if motivo:
                    os.killpg(p.pid, signal.SIGKILL)
                    p.wait()
                    rc = motivo
    err = errores.read_text(errors="replace")[-3000:]
    return round(time.time() - inicio, 1), rc, err


def eventos(log: Path):
    for linea in log.read_text(errors="replace").splitlines():
        try:
            yield json.loads(linea)
        except json.JSONDecodeError:
            continue


def anotar_lectura(m: dict, texto: str, paso: int):
    for doc in DOCUMENTOS.findall(texto or ""):
        m["documentos_leidos"].setdefault(doc, paso)


def metricas_claude(log: Path) -> dict:
    m = {"peticiones": 0, "entrada": 0, "entrada_cache_leida": 0, "entrada_cache_escrita": 0,
         "salida": 0, "herramientas": {}, "documentos_leidos": {}, "contexto_por_paso": []}
    vistos = set()
    for e in eventos(log):
        if e.get("type") == "system" and e.get("subtype") == "init":
            m["modelo"] = e.get("model")
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
                    anotar_lectura(m, json.dumps(c.get("input", {})), m["peticiones"])
        if e.get("type") == "result":
            # La salida de cada mensaje en stream-json es parcial: el total fiable está en result.
            m["salida"] = (e.get("usage") or {}).get("output_tokens", m["salida"])
            m["coste_usd"] = e.get("total_cost_usd")
            m["duracion_ms_agente"] = e.get("duration_ms")
            m["duracion_s_agente"] = round((e.get("duration_ms") or 0) / 1000, 1)
            m["turnos"] = e.get("num_turns")
            m["respuesta_final"] = (e.get("result") or "")[-1500:]
    return m


def metricas_codex(log: Path, rollout: Path | None) -> dict:
    m = {"peticiones": 0, "herramientas": {}, "documentos_leidos": {}, "contexto_por_paso": []}
    paso = 0
    for e in eventos(log):
        item = e.get("item", {})
        if e.get("type") == "item.completed":
            tipo = item.get("type")
            m["herramientas"][tipo] = m["herramientas"].get(tipo, 0) + 1
            if tipo == "command_execution":
                paso += 1
                anotar_lectura(m, item.get("command", ""), paso)
            if tipo == "agent_message":
                m["respuesta_final"] = (item.get("text") or "")[-1500:]
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
         "herramientas": {}, "documentos_leidos": {}, "contexto_por_paso": []}
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
            m["herramientas"][nombre] = m["herramientas"].get(nombre, 0) + 1
            anotar_lectura(m, json.dumps(part.get("state", {}).get("input", {})), m["peticiones"])
        if e.get("type") == "text":
            textos.append(part.get("text", ""))
    m["respuesta_final"] = "".join(textos)[-1500:]
    marcas = [e.get("timestamp") for e in eventos(log) if isinstance(e.get("timestamp"), (int, float))]
    if marcas:
        m["duracion_s_agente"] = round((max(marcas) - min(marcas)) / 1000, 1)
    return m


def lineas_anadidas(diff: str, prefijo: str) -> list[str]:
    fichero, salida = None, []
    for linea in diff.splitlines():
        if linea.startswith("+++ b/"):
            fichero = linea[6:]
        elif linea.startswith("+") and not linea.startswith("+++") and fichero and fichero.startswith(prefijo):
            salida.append(f"{fichero}: {linea[1:]}")
    return salida


def corregir(repo: Path, tarea: str) -> dict:
    (repo / ".git" / "info" / "exclude").write_text(EXCLUIR)
    sh(["git", "add", "-A"], repo)
    _, diff = sh(["git", "diff", "--cached", "base", "--", ".", ":(exclude)node_modules"], repo)
    _, cambios = sh(["git", "diff", "--cached", "--name-status", "base"], repo)
    (repo.parent / "diff.patch").write_text(diff)
    r = {"ficheros_cambiados": [l.split("\t", 1)[-1] for l in cambios.splitlines() if l.strip()]}

    rc, out = sh(["npm", "run", "check"], repo, timeout=600)
    r["gate_ok"] = rc == 0
    r["gate_salida"] = out[-1500:]

    oculto = TAREAS / tarea / "oculto.test.ts"
    destino = repo / "oculto"
    destino.mkdir(exist_ok=True)
    shutil.copy(oculto, destino / "oculto.test.ts")
    rc, out = sh(["node", "--test", "--test-reporter=tap", "oculto/oculto.test.ts"], repo, timeout=600)
    ok = re.findall(r"^\s*ok \d+ - (.+)$", out, re.M)
    ko = re.findall(r"^\s*not ok \d+ - (.+)$", out, re.M)
    suites = {"oculto.test.ts"}
    r["ocultos_ok"] = [t for t in ok if t not in suites]
    r["ocultos_fallan"] = [t for t in ko if t not in suites]
    r["ocultos_total"] = len(r["ocultos_ok"]) + len(r["ocultos_fallan"])
    r["ocultos_salida"] = out[-3000:] if ko else ""

    anadido_src = lineas_anadidas(diff, "src/")
    r["glosario_infracciones"] = [l for l in anadido_src if re.search(r"\b(turnos?|usuarios?|admin\w*|administrador\w*)\b", l, re.I)]
    r["reloj_infracciones"] = [l for l in anadido_src
                               if re.search(r"new Date\(|Date\.now\(", l) and not l.startswith("src/infra/")]
    r["tests_anadidos"] = len([l for l in lineas_anadidas(diff, "test/") if re.search(r"\b(test|it)\(", l)])
    _, numstat = sh(["git", "diff", "--cached", "--numstat", "base", "--", "test/"], repo)
    filas = [l.split("\t") for l in numstat.splitlines()]
    r["tests_existentes_tocados"] = [f[2] for f in filas if len(f) == 3 and f[1] not in ("0", "-")]
    return r


def main():
    agente, variante, tarea, rep = sys.argv[1:5]
    solo_corregir = "--solo-corregir" in sys.argv
    id_ejecucion = f"{agente}-{variante}-{tarea}-{rep}"
    destino = RESULTADOS / f"{id_ejecucion}.json"
    if destino.exists() and not solo_corregir:
        print("ya existe", destino)
        return
    RESULTADOS.mkdir(parents=True, exist_ok=True)
    log = EJECUCIONES / id_ejecucion / "agente.jsonl"
    if solo_corregir:
        # Vuelve a medir y corregir una ejecución ya hecha, sin lanzar el agente otra vez.
        repo = EJECUCIONES / id_ejecucion / "repo"
        previo = json.loads(destino.read_text()) if destino.exists() else {}
        segundos, rc, err = previo.get("segundos"), previo.get("rc"), previo.get("error", "")
        if sh(["git", "rev-parse", "-q", "--verify", "base"], repo)[0]:
            primero = sh(["git", "rev-list", "--max-parents=0", "HEAD"], repo)[1].split()[0]
            sh(["git", "tag", "base", primero], repo)
    else:
        repo = preparar(id_ejecucion, variante, tarea)
        prompt = (TAREAS / tarea / "prompt.md").read_text().strip()
        sesiones = CODEX_HOME / "sessions"
        antes = set(sesiones.rglob("rollout-*.jsonl")) if sesiones.exists() else set()
        segundos, rc, err = lanzar(agente, repo, prompt, log)
        if agente == "codex":
            nuevos = sorted(set(sesiones.rglob("rollout-*.jsonl")) - antes) if sesiones.exists() else []
            if nuevos:
                shutil.copy(nuevos[-1], repo.parent / "rollout.jsonl")
    if agente == "claude":
        m = metricas_claude(log)
    elif agente == "codex":
        rollout = repo.parent / "rollout.jsonl"
        m = metricas_codex(log, rollout if rollout.exists() else None)
    else:
        m = metricas_opencode(log)
    r = {"id": id_ejecucion, "agente": agente, "variante": variante, "tarea": tarea, "repeticion": int(rep),
         "segundos": segundos, "rc": rc, "error": err if rc else "", **m, **corregir(repo, tarea),
         "fecha": time.strftime("%Y-%m-%d %H:%M")}
    destino.write_text(json.dumps(r, ensure_ascii=False, indent=1))
    print(id_ejecucion, {k: r.get(k) for k in ("segundos", "rc", "entrada", "salida", "peticiones", "gate_ok", "ocultos_total")},
          "ocultos_ok", len(r["ocultos_ok"]), flush=True)


if __name__ == "__main__":
    main()
