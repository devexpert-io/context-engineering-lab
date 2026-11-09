# Context engineering lab

Experimentos del artículo [Context engineering](https://devexpert.io/blog/context-engineering) de DevExpert (noviembre de 2026): qué carga cada agente de código al empezar y qué cambia cuando el AGENTS.md hace de mapa o lo lleva todo dentro.

Agentes medidos: Claude Code 2.1.319 (Opus 5.5), Codex CLI 0.167.0 (gpt-6.1-sol, razonamiento medio) y OpenCode 1.19.5 (Qwen 3.8 27B en local, con LM Studio y MLX, en un MacBook Pro M5 Pro de 64 GB).

## Prueba 0: qué carga cada agente al empezar

`prueba0/generar.py` crea AGENTS.md de 50, 300, 1.000 y 2.500 líneas con una marca de control cada 50 líneas. Cada marca es un código aleatorio (`KW_` y cuatro caracteres), así que un modelo no puede deducir las que no ve.

`prueba0/medir.py` lanza cada agente en un repo de prueba con cada tamaño, y sin AGENTS.md:

- **T:** un prompt trivial ("Responde solo: OK") para medir los tokens de entrada de la primera petición.
- **K:** el agente copia, sin herramientas, las marcas que ve en sus instrucciones.

En Codex se comprueba además el texto exacto que recibe el modelo, en el registro de la sesión (`rollout-*.jsonl`).

## Prueba 1: el mismo encargo con un mapa, con un AGENTS.md inflado y sin AGENTS.md

`app/` es una API de reservas de pádel en TypeScript (Node 26, sin frameworks) con su documentación en `docs/` y `CONTEXT.md`. Parte del ejemplo público del [Harness Starter](https://github.com/devexpert-io/harness-starter).

Variantes (`variantes/`):

- **mapa:** un AGENTS.md corto que dice qué es el proyecto, cómo se comprueba, dónde está cada cosa, qué leer antes de cada tipo de tarea y las reglas que valen para todo. Los documentos se quedan en el repo.
- **inflado:** el mismo mapa con todos los documentos pegados dentro (`generar_inflado.py`), y sin `docs/` ni `CONTEXT.md` en el repo. Lleva la misma información que el mapa.
- **sin:** sin AGENTS.md, con los documentos en el repo.

Encargos (`tareas/`), cada uno con su prompt y sus tests ocultos, que el agente no ve:

- **t1-cancelar:** cancelar reservas según la política del club, que está en los documentos.
- **t2-semana:** un fallo con un test que lo demuestra. No necesita los documentos.
- **t3-bloqueos:** bloquear pistas siguiendo las convenciones de la API, la auditoría y las notificaciones.

`runner/correr.py` hace cada ejecución en una copia limpia del repo y guarda tokens, tiempo, peticiones, herramientas, documentos leídos, el resultado del gate (`npm run check`), los tests ocultos y las comprobaciones de reglas (glosario, reloj inyectado, tests añadidos y tests existentes modificados).

## Aislamiento

Cada agente corre sin la configuración de su usuario: sin instrucciones globales, sin skills propias, sin servidores MCP y sin plugins instalados. Solo lleva lo que trae de serie.

- **Claude Code:** `--setting-sources project,local --strict-mcp-config --disable-slash-commands`, permisos abiertos dentro del sandbox de Claude Code (con `allowLocalBinding`, porque los tests abren un servidor en 127.0.0.1, y sin la opción de salir del sandbox) y escritura fuera del repo denegada.
- **Codex:** un `CODEX_HOME` y un `HOME` vacíos (solo con la sesión iniciada), `sandbox_mode = "workspace-write"` con `network_access = true` (por el mismo motivo) y `approval_policy = "never"`. En la prueba 1, `project_doc_max_bytes = 65536`, para que el AGENTS.md inflado (41,2 KB) llegue entero: con el valor por defecto, 32 KiB, Codex lo cortaría (ver la prueba 0).
- **OpenCode:** `HOME` y `XDG_*` vacíos, `OPENCODE_DISABLE_CLAUDE_CODE=1`, y el proceso dentro de `sandbox-exec` sin permiso de escritura en `/Users`.

Una ejecución piloto (`resultados/piloto/`) destapó el problema de los puertos: con el sandbox por defecto, los tests se quedaban colgados y el agente tardaba 7,7 minutos en un cambio de una línea. No entra en el análisis.

## Cambios durante la prueba 1 (8-nov-2026)

- **Codex por el router:** con la conexión directa (websockets), Codex se quedaba esperando la respuesta del modelo hasta 10 minutos y en muchas ejecuciones no volvía. En la prueba 1 pasa por el codex-router local de Antonio (`openai_base_url` y `model_catalog_json`), que habla con el mismo modelo por HTTP. Un "Responde solo: OK" da los mismos tokens por los dos caminos (15.507 y 17.915, las dos cifras entre las que varía el contexto base de Codex).
- **OpenCode con Qwen alojado:** con Qwen 3.8 27B en local, solo 1 de 9 ejecuciones terminó dentro de los 45 minutos. En la prueba 1 usa el mismo modelo alojado en OpenRouter (`qwen/qwen3.8-27b`), con `OPENROUTER_API_KEY` en el entorno. La prueba 0 de OpenCode se hizo con el modelo en local: el tokenizador es el mismo, y los tiempos de esa prueba son los del portátil.
- **Vigilante:** si el registro del agente no cambia en 10 minutos (15 en OpenCode), la ejecución se corta y queda marcada como `estancado`. Cada resultado guarda la duración que mide el propio agente (`duracion_s_agente`).
- Las ejecuciones descartadas están en `resultados/descartados/`.

El aislamiento se comprobó con el mismo método de palabras clave: una frase que solo está en las instrucciones globales del usuario no llega al contexto.

## Límites

Un repo, tres encargos y tres repeticiones por combinación: es una medición orientativa, no un benchmark. Los tokens no se comparan entre agentes, porque cada modelo usa su propio tokenizador. Cada agente se compara consigo mismo.

## Resultados

Mediana de tres ejecuciones (detalle en `analisis/resumen.md`):

- **Calidad:** las 63 ejecuciones de la prueba 1 pasan todos los tests ocultos y el gate, con el mapa, con todo dentro y sin AGENTS.md, en los tres agentes.
- **Codex:** con todo dentro procesa más tokens que con el mapa: +36 % al cancelar reservas, +72 % al arreglar el fallo y +20 % al bloquear pistas.
- **Claude Code:** con el mapa lee los diez documentos al empezar las tareas que los necesitan, así que no ahorra tokens. El coste es parecido, salvo en la tarea corta, donde todo dentro cuesta un 46 % más.
- **OpenCode:** depende de la tarea. Al bloquear pistas, todo dentro cuesta un 63 % más y tarda el doble. Al cancelar reservas, con el mapa procesa un 28 % más.
- **Prueba 0:** Codex 0.167.0 corta la cadena de AGENTS.md a los 32 KiB sin avisar. Claude Code y OpenCode cargan el fichero entero.
- **Prueba 0b:** en Claude Code, las rutas con `@` cargan los documentos al arrancar (+48 % de contexto). En Codex, `@` no hace nada.

Lo cuenta el artículo [Context engineering](https://devexpert.io/blog/context-engineering).

## Cómo repetirlo

Hace falta Node 26, Python 3 y los tres agentes con la sesión iniciada. Las rutas temporales de los resultados están sustituidas por `<scratch>`. Los registros completos de cada sesión no se incluyen: pesan mucho y llevan dentro el system prompt de cada herramienta.

```sh
cd app && npm install && cd ..
export LAB_SCRATCH=/tmp/context-lab        # carpeta de trabajo: copias del repo, registros y HOME limpio
export OPENROUTER_API_KEY=...              # para OpenCode (o LAB_SECRETOS=<comando que la ponga>)

python3 -I prueba0/generar.py 1000 prueba0/agents/AGENTS-1000.md
python3 -I prueba0/medir.py "$LAB_SCRATCH" claude codex opencode
python3 -I prueba0/medir_arroba.py "$LAB_SCRATCH"
python3 -I variantes/generar_inflado.py
runner/lote.sh claude          # y lo mismo con codex y opencode
python3 -I analisis/resumen.py
```

Antes de lanzarlo, prepara el aislamiento descrito arriba: `$LAB_SCRATCH/home-limpio` con la configuración de OpenCode y `$LAB_SCRATCH/codex-home` con un `config.toml` mínimo y tu `auth.json`.

## Licencia

MIT.

