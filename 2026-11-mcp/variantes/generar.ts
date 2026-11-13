// Genera lo que ve el agente en cada variante a partir de los mismos textos que usan la CLI y el servidor MCP.
//   node variantes/generar.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { CAMPOS, TEXTOS } from "../club/src/textos.ts";

const aqui = import.meta.dirname;
const escribir = (ruta: string, texto: string) => {
  mkdirSync(`${aqui}/${ruta}`.replace(/\/[^/]+$/, ""), { recursive: true });
  writeFileSync(`${aqui}/${ruta}`, texto);
};

const FLUJOS = `## Flujos habituales

- **Reservar:** busca al socio para tener su id, consulta la disponibilidad del día y crea la reserva.
- **Cancelar:** localiza la reserva del socio y cancélala. Si devuelve FUERA_DE_PLAZO, no fuerces sin que el socio haya aceptado la penalización.
- **Informes:** lista las reservas del periodo página a página hasta tener todas.`;

// CLI sola: el agente solo sabe que la CLI existe.
escribir("cli/AGENTS.md", "Para consultar o cambiar algo en el sistema de reservas del club usa la CLI `padel`, que está en el PATH. `padel --help` lista los comandos.\n");

// CLI con skill.
escribir("cli-skill/club-padel/SKILL.md", `---
name: club-padel
description: Opera el sistema de reservas del club de pádel con la CLI padel (pistas, disponibilidad, socios, reservas y cancelaciones). Úsala siempre que haya que consultar o cambiar algo en el sistema del club.
---

# Club de pádel con la CLI \`padel\`

${TEXTOS.sistema}

La CLI \`padel\` está en el PATH. Todos los comandos escriben JSON. Los errores salen por stderr con código de salida 1.

## Comandos

- \`padel pistas listar\`: ${TEXTOS.listarPistas}
- \`padel pistas estado <pista> <estado>\`: ${TEXTOS.cambiarEstadoPista} El estado es ${CAMPOS.estadoPista}.
- \`padel disponibilidad --fecha <fecha> [--pista <pista>]\`: ${TEXTOS.disponibilidad}
- \`padel socios buscar <texto>\`: ${TEXTOS.buscarSocios}
- \`padel reservas listar [--fecha <fecha> | --desde <fecha> --hasta <fecha>] [--socio <socio>] [--pista <pista>] [--estado <estado>] [--limite <n>] [--pagina <n>]\`: ${TEXTOS.listarReservas} El estado es ${CAMPOS.estadoReserva}.
- \`padel reservas ver <reserva>\`: ${TEXTOS.obtenerReserva}
- \`padel reservas crear --socio <socio> --pista <pista> --inicio <inicio> [--notas <texto>]\`: ${TEXTOS.crearReserva} El inicio va como AAAA-MM-DDTHH:MM.
- \`padel reservas cancelar <reserva> [--forzar] [--motivo <texto>]\`: ${TEXTOS.cancelarReserva}

${FLUJOS}
`);

// Skill sobre la API, sin CLI. {{CLUB_API}} se sustituye por la dirección de la API en cada ejecución.
escribir("skill-api/club-padel/SKILL.md", `---
name: club-padel
description: Opera el sistema de reservas del club de pádel con su API HTTP (pistas, disponibilidad, socios, reservas y cancelaciones). Úsala siempre que haya que consultar o cambiar algo en el sistema del club.
---

# Club de pádel con la API HTTP

${TEXTOS.sistema}

La API está en \`{{CLUB_API}}\` y se usa con \`curl\`. Responde siempre JSON. Los errores llevan un código HTTP 4xx y el cuerpo \`{"error":{"codigo":"…","mensaje":"…"}}\`.

## Endpoints

- \`curl -s {{CLUB_API}}/api/pistas\`: ${TEXTOS.listarPistas}
- \`curl -s -X PATCH {{CLUB_API}}/api/pistas/<pista> -H 'content-type: application/json' -d '{"estado":"cerrada"}'\`: ${TEXTOS.cambiarEstadoPista} El estado es ${CAMPOS.estadoPista}.
- \`curl -s '{{CLUB_API}}/api/disponibilidad?fecha=<fecha>&pista=<pista>'\`: ${TEXTOS.disponibilidad} \`pista\` es opcional.
- \`curl -s '{{CLUB_API}}/api/socios?texto=<texto>'\`: ${TEXTOS.buscarSocios}
- \`curl -s '{{CLUB_API}}/api/reservas?fecha=<fecha>'\`: ${TEXTOS.listarReservas} Parámetros, todos opcionales: \`fecha\`, o \`desde\` y \`hasta\`, \`socio\`, \`pista\`, \`estado\` (${CAMPOS.estadoReserva}), \`limite\` y \`pagina\`.
- \`curl -s {{CLUB_API}}/api/reservas/<reserva>\`: ${TEXTOS.obtenerReserva}
- \`curl -s -X POST {{CLUB_API}}/api/reservas -H 'content-type: application/json' -d '{"socioId":"<socio>","pistaId":"<pista>","inicio":"<inicio>","notas":"<texto>"}'\`: ${TEXTOS.crearReserva} El inicio va como AAAA-MM-DDTHH:MM y \`notas\` es opcional.
- \`curl -s -X POST {{CLUB_API}}/api/reservas/<reserva>/cancelar -H 'content-type: application/json' -d '{"forzar":false,"motivo":"<texto>"}'\`: ${TEXTOS.cancelarReserva} \`forzar\` y \`motivo\` son opcionales.

${FLUJOS}
`);
console.log("variantes generadas");
