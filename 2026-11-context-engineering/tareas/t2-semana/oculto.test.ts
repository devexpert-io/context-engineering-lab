// Tests ocultos de T2 (la semana sale con 8 días). El agente no los ve: se copian al repo al terminar.
// T2.01 llama directamente a diasDeLaSemana: si el agente solo recorta la respuesta HTTP, falla.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { crearApp } from "../src/app.ts";
import { diasDeLaSemana } from "../src/dominio/semana.ts";
import { crearRelojFijo } from "../src/infra/reloj.ts";
import { crearSemilla } from "../src/infra/semilla.ts";

const SEMANA_BASE = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"];

async function disponibilidad(pista: string, semana: string) {
  const app = crearApp({ reloj: crearRelojFijo("2026-11-16T10:00"), datos: crearSemilla() });
  const servidor = createServer(app.manejador);
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
  const { port } = servidor.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/pistas/${pista}/disponibilidad?semana=${semana}`, {
      headers: { "x-socio-id": "socio-irene" },
    });
    return { estado: res.status, cuerpo: (await res.json()) as any };
  } finally {
    servidor.closeAllConnections();
    await new Promise<void>((r) => servidor.close(() => r()));
  }
}

test("T2.01 diasDeLaSemana devuelve 7 días de lunes a domingo", () => {
  assert.deepEqual(diasDeLaSemana("2026-11-18"), SEMANA_BASE);
  assert.deepEqual(diasDeLaSemana("2026-11-22"), SEMANA_BASE);
  assert.deepEqual(diasDeLaSemana("2027-01-01"), [
    "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
  ]);
});

test("T2.02 la disponibilidad de la API devuelve los 7 días de la semana", async () => {
  const r = await disponibilidad("pista-1", "2026-11-18");
  assert.equal(r.estado, 200);
  assert.deepEqual(r.cuerpo.disponibilidad.dias.map((d: any) => d.fecha), SEMANA_BASE);
});

test("T2.03 cada día sigue teniendo sus 10 franjas", async () => {
  const r = await disponibilidad("pista-1", "2026-11-18");
  assert.ok(r.cuerpo.disponibilidad.dias.every((d: any) => d.franjas.length === 10));
});

test("T2.04 la disponibilidad sigue marcando reservas y pistas cerradas", async () => {
  const r = await disponibilidad("pista-1", "2026-11-18");
  const martes = r.cuerpo.disponibilidad.dias.find((d: any) => d.fecha === "2026-11-17");
  assert.equal(martes.franjas.find((f: any) => f.inicio === "2026-11-17T18:30").estado, "reservada");
  const cerrada = await disponibilidad("pista-4", "2026-11-18");
  assert.ok(cerrada.cuerpo.disponibilidad.dias.every((d: any) => d.franjas.every((f: any) => f.estado === "cerrada")));
});
