// Servidor MCP del club (stdio). Cada tool llama a la API HTTP, como hacen la mayoría de servidores MCP reales.
//   CLUB_API=http://127.0.0.1:4800 node src/mcp.ts
//   CLUB_API=… node src/mcp.ts --solo-lectura   (sin las tools que cambian datos)
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { llamar, type Respuesta } from "./cliente.ts";
import { CAMPOS, TEXTOS } from "./textos.ts";

const soloLectura = process.argv.includes("--solo-lectura");

function resultado({ ok, datos }: Respuesta) {
  return { content: [{ type: "text" as const, text: JSON.stringify(datos) }], ...(ok ? {} : { isError: true }) };
}

function crearServidor() {
  const server = new McpServer({ name: "club-padel", version: "1.0.0" }, { instructions: TEXTOS.sistema });
  const lectura = { readOnlyHint: true };

  server.registerTool(
    "listar_pistas",
    { description: TEXTOS.listarPistas, inputSchema: z.object({}), annotations: lectura },
    async () => resultado(await llamar("GET", "/api/pistas")),
  );

  server.registerTool(
    "consultar_disponibilidad",
    {
      description: TEXTOS.disponibilidad,
      inputSchema: z.object({
        fecha: z.string().describe(CAMPOS.fecha),
        pista: z.string().optional().describe(CAMPOS.pista),
      }),
      annotations: lectura,
    },
    async ({ fecha, pista }) => resultado(await llamar("GET", "/api/disponibilidad", { consulta: { fecha, pista } })),
  );

  server.registerTool(
    "buscar_socios",
    {
      description: TEXTOS.buscarSocios,
      inputSchema: z.object({ texto: z.string().describe(CAMPOS.texto) }),
      annotations: lectura,
    },
    async ({ texto }) => resultado(await llamar("GET", "/api/socios", { consulta: { texto } })),
  );

  server.registerTool(
    "listar_reservas",
    {
      description: TEXTOS.listarReservas,
      inputSchema: z.object({
        fecha: z.string().optional().describe(CAMPOS.fecha),
        desde: z.string().optional().describe(CAMPOS.desde),
        hasta: z.string().optional().describe(CAMPOS.hasta),
        socio: z.string().optional().describe(CAMPOS.socio),
        pista: z.string().optional().describe(CAMPOS.pista),
        estado: z.string().optional().describe(CAMPOS.estadoReserva),
        limite: z.number().int().optional().describe(CAMPOS.limite),
        pagina: z.number().int().optional().describe(CAMPOS.pagina),
      }),
      annotations: lectura,
    },
    async (filtros) => resultado(await llamar("GET", "/api/reservas", { consulta: filtros })),
  );

  server.registerTool(
    "obtener_reserva",
    {
      description: TEXTOS.obtenerReserva,
      inputSchema: z.object({ reserva: z.string().describe(CAMPOS.reserva) }),
      annotations: lectura,
    },
    async ({ reserva }) => resultado(await llamar("GET", `/api/reservas/${encodeURIComponent(reserva)}`)),
  );

  if (soloLectura) return server;

  server.registerTool(
    "crear_reserva",
    {
      description: TEXTOS.crearReserva,
      inputSchema: z.object({
        socio: z.string().describe(CAMPOS.socio),
        pista: z.string().describe(CAMPOS.pista),
        inicio: z.string().describe(CAMPOS.inicio),
        notas: z.string().optional().describe(CAMPOS.notas),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ socio, pista, inicio, notas }) =>
      resultado(await llamar("POST", "/api/reservas", { cuerpo: { socioId: socio, pistaId: pista, inicio, notas } })),
  );

  server.registerTool(
    "cancelar_reserva",
    {
      description: TEXTOS.cancelarReserva,
      inputSchema: z.object({
        reserva: z.string().describe(CAMPOS.reserva),
        forzar: z.boolean().optional().describe(CAMPOS.forzar),
        motivo: z.string().optional().describe(CAMPOS.motivo),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ reserva, forzar, motivo }) =>
      resultado(await llamar("POST", `/api/reservas/${encodeURIComponent(reserva)}/cancelar`, { cuerpo: { forzar, motivo } })),
  );

  server.registerTool(
    "cambiar_estado_pista",
    {
      description: TEXTOS.cambiarEstadoPista,
      inputSchema: z.object({
        pista: z.string().describe(CAMPOS.pista),
        estado: z.string().describe(CAMPOS.estadoPista),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ pista, estado }) => resultado(await llamar("PATCH", `/api/pistas/${encodeURIComponent(pista)}`, { cuerpo: { estado } })),
  );

  return server;
}

serveStdio(crearServidor);
