// Comprueba que las tres puertas (API, CLI y servidor MCP) responden lo mismo y que la semilla
// deja el estado que esperan las tareas.
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { after, before, test } from "node:test";

let api: ChildProcess;
let base = "";

before(async () => {
  api = spawn("node", ["src/servidor.ts"], { env: { ...process.env, PORT: "0" } });
  base = await new Promise<string>((resolver) => {
    api.stdout!.on("data", (trozo: Buffer) => {
      const puerto = /PUERTO=(\d+)/.exec(trozo.toString())?.[1];
      if (puerto) resolver(`http://127.0.0.1:${puerto}`);
    });
  });
});
after(() => api.kill());

const cli = (...argumentos: string[]) =>
  JSON.parse(execFileSync("node", ["src/cli.ts", ...argumentos], { env: { ...process.env, CLUB_API: base }, encoding: "utf8" }));

test("la semilla deja el estado que esperan las tareas", async () => {
  const estado = await (await fetch(`${base}/_estado`)).json();
  const nombres = estado.socios.map((s: { nombre: string }) => s.nombre);
  for (const nombre of ["Irene Sanz", "Marta López", "Luis Martín"]) {
    assert.equal(nombres.filter((n: string) => n === nombre).length, 1, `${nombre} debe ser único`);
  }
  const jueves = cli("disponibilidad", "--fecha", "2026-11-19");
  const a1930 = Object.fromEntries(jueves.pistas.map((p: any) => [p.pistaId, p.franjas.find((f: any) => f.inicio.endsWith("19:30")).estado]));
  assert.deepEqual(a1930, { "pista-1": "reservada", "pista-2": "libre", "pista-3": "libre", "pista-4": "cerrada" });
  const sabado = cli("disponibilidad", "--fecha", "2026-11-21");
  const libresCubiertas = sabado.pistas
    .filter((p: any) => p.cubierta)
    .flatMap((p: any) => p.franjas.filter((f: any) => f.estado === "libre" && f.inicio.slice(11) >= "15:00").map((f: any) => `${f.inicio} ${p.pistaId}`))
    .sort();
  assert.equal(libresCubiertas[0], "2026-11-21T16:30 pista-2");
  assert.equal(cli("reservas", "listar", "--desde", "2026-10-01", "--hasta", "2026-10-31", "--limite", "1").total, 315);
});

test("la CLI y el servidor MCP devuelven lo mismo que la API", async () => {
  const cliente = new Client({ name: "test", version: "1.0.0" });
  await cliente.connect(new StdioClientTransport({ command: "node", args: ["src/mcp.ts"], env: { ...process.env, CLUB_API: base } as Record<string, string> }));
  const { tools } = await cliente.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    "buscar_socios", "cambiar_estado_pista", "cancelar_reserva", "consultar_disponibilidad",
    "crear_reserva", "listar_pistas", "listar_reservas", "obtener_reserva",
  ]);
  const porMcp = await cliente.callTool({ name: "listar_reservas", arguments: { fecha: "2026-11-19" } });
  const texto = (porMcp.content as { text: string }[])[0]!.text;
  const porApi = await (await fetch(`${base}/api/reservas?fecha=2026-11-19`)).text();
  assert.equal(texto, porApi);
  assert.deepEqual(cli("reservas", "listar", "--fecha", "2026-11-19"), JSON.parse(porApi));

  const fuera = await cliente.callTool({ name: "cancelar_reserva", arguments: { reserva: "R-0520" } });
  assert.equal(fuera.isError, true);
  assert.match((fuera.content as { text: string }[])[0]!.text, /FUERA_DE_PLAZO/);
  await cliente.close();
});

test("el servidor MCP de solo lectura no expone las tools que cambian datos", async () => {
  const cliente = new Client({ name: "test", version: "1.0.0" });
  await cliente.connect(new StdioClientTransport({ command: "node", args: ["src/mcp.ts", "--solo-lectura"], env: { ...process.env, CLUB_API: base } as Record<string, string> }));
  const { tools } = await cliente.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["buscar_socios", "consultar_disponibilidad", "listar_pistas", "listar_reservas", "obtener_reserva"]);
  await cliente.close();
});

test("reservar y cancelar siguen las reglas del club", async () => {
  const creada = cli("reservas", "crear", "--socio", "socio-004", "--pista", "pista-2", "--inicio", "2026-11-21T16:30");
  assert.equal(creada.reserva.importe, 2800);
  assert.throws(() => cli("reservas", "crear", "--socio", "socio-004", "--pista", "pista-2", "--inicio", "2026-11-21T16:30"), /FRANJA_NO_DISPONIBLE/);
  assert.throws(() => cli("reservas", "cancelar", "R-0520"), /FUERA_DE_PLAZO/);
  assert.equal(cli("reservas", "cancelar", "R-0520", "--forzar").reserva.penalizacion, 1200);
  assert.equal(cli("reservas", "cancelar", creada.reserva.id).reserva.penalizacion, undefined);
});
