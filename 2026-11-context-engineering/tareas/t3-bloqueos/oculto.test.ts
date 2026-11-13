// Tests ocultos de T3 (bloqueos de pista). El agente no los ve: se copian al repo al terminar.
// Siguen la sección de bloqueos de docs/dominio.md y las convenciones de docs/api.md.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { crearApp } from "../src/app.ts";
import { crearRelojFijo } from "../src/infra/reloj.ts";
import { crearSemilla } from "../src/infra/semilla.ts";

async function arrancar(ahora = "2026-11-16T10:00") {
  const reloj = crearRelojFijo(ahora);
  let n = 0;
  const app = crearApp({ reloj, datos: crearSemilla(), generarId: (p: string) => `${p}-oculto-${++n}` });
  const servidor = createServer(app.manejador);
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
  const { port } = servidor.address() as AddressInfo;
  async function pedir(metodo: string, ruta: string, socio?: string, cuerpo?: unknown) {
    const res = await fetch(`http://127.0.0.1:${port}${ruta}`, {
      method: metodo,
      headers: {
        ...(socio ? { "x-socio-id": socio } : {}),
        ...(cuerpo === undefined ? {} : { "content-type": "application/json" }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const texto = await res.text();
    let json: any;
    try {
      json = texto ? JSON.parse(texto) : undefined;
    } catch {
      json = texto;
    }
    return { estado: res.status, cuerpo: json };
  }
  const cerrar = () =>
    new Promise<void>((r) => {
      servidor.closeAllConnections();
      servidor.close(() => r());
    });
  return { app, reloj, pedir, cerrar };
}

type Prueba = Awaited<ReturnType<typeof arrancar>>;
const ruta = (pista: string) => `/api/gestion/pistas/${pista}/bloqueos`;
const bloquear = (p: Prueba, pista: string, cuerpo: unknown, socio = "gestor-carmen") => p.pedir("POST", ruta(pista), socio, cuerpo);

async function estadoDeFranja(p: Prueba, pista: string, inicio: string) {
  const r = await p.pedir("GET", `/api/pistas/${pista}/disponibilidad?semana=${inicio.slice(0, 10)}`, "socio-irene");
  for (const dia of r.cuerpo?.disponibilidad?.dias ?? []) {
    for (const franja of dia.franjas ?? []) {
      if (franja.inicio === inicio) return franja.estado;
    }
  }
  return undefined;
}

test("T3.01 el gestor bloquea una pista sin reservas y recibe 201 con el bloqueo", async () => {
  const p = await arrancar();
  try {
    const r = await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-11-20T12:30", motivo: "Cambio de red" });
    assert.equal(r.estado, 201);
    const b = r.cuerpo?.bloqueo;
    assert.equal(typeof b?.id, "string");
    assert.equal(b.pistaId, "pista-3");
    assert.equal(b.inicio, "2026-11-20T08:00");
    assert.equal(b.fin, "2026-11-20T12:30");
    assert.equal(b.motivo, "Cambio de red");
    assert.deepEqual(b.reservasCanceladas, []);
  } finally {
    await p.cerrar();
  }
});

test("T3.02 las franjas bloqueadas salen como bloqueada en la disponibilidad", async () => {
  const p = await arrancar();
  try {
    await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-11-20T12:30", motivo: "Cambio de red" });
    for (const inicio of ["2026-11-20T08:00", "2026-11-20T09:30", "2026-11-20T11:00"]) {
      assert.equal(await estadoDeFranja(p, "pista-3", inicio), "bloqueada", inicio);
    }
    assert.equal(await estadoDeFranja(p, "pista-3", "2026-11-20T12:30"), "libre");
    assert.equal(await estadoDeFranja(p, "pista-3", "2026-11-19T08:00"), "libre");
  } finally {
    await p.cerrar();
  }
});

test("T3.03 no se puede reservar una franja bloqueada", async () => {
  const p = await arrancar();
  try {
    await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-11-20T12:30", motivo: "Cambio de red" });
    const r = await p.pedir("POST", "/api/reservas", "socio-irene", { pistaId: "pista-3", inicio: "2026-11-20T09:30" });
    assert.equal(r.estado, 409);
    assert.equal(r.cuerpo?.error?.codigo, "FRANJA_NO_DISPONIBLE");
  } finally {
    await p.cerrar();
  }
});

test("T3.04 un bloqueo puede terminar al final de una franja de otro día", async () => {
  const p = await arrancar();
  try {
    const r = await bloquear(p, "pista-3", { inicio: "2026-11-20T21:30", fin: "2026-11-21T09:30", motivo: "Iluminación" });
    assert.equal(r.estado, 201);
    assert.equal(await estadoDeFranja(p, "pista-3", "2026-11-20T21:30"), "bloqueada");
    assert.equal(await estadoDeFranja(p, "pista-3", "2026-11-21T08:00"), "bloqueada");
    assert.equal(await estadoDeFranja(p, "pista-3", "2026-11-21T09:30"), "libre");
  } finally {
    await p.cerrar();
  }
});

test("T3.05 solo el gestor puede bloquear una pista", async () => {
  const p = await arrancar();
  try {
    const r = await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-11-20T09:30", motivo: "x" }, "socio-ana");
    assert.equal(r.estado, 403);
    assert.equal(r.cuerpo?.error?.codigo, "SOLO_GESTOR");
  } finally {
    await p.cerrar();
  }
});

test("T3.06 una pista que no existe devuelve 404 PISTA_NO_ENCONTRADA", async () => {
  const p = await arrancar();
  try {
    const r = await bloquear(p, "pista-9", { inicio: "2026-11-20T08:00", fin: "2026-11-20T09:30", motivo: "x" });
    assert.equal(r.estado, 404);
    assert.equal(r.cuerpo?.error?.codigo, "PISTA_NO_ENCONTRADA");
  } finally {
    await p.cerrar();
  }
});

test("T3.07 inicio y fin tienen que coincidir con el inicio y el final de una franja", async () => {
  const p = await arrancar();
  try {
    const inicioMal = await bloquear(p, "pista-3", { inicio: "2026-11-20T08:15", fin: "2026-11-20T09:30", motivo: "x" });
    assert.equal(inicioMal.estado, 400);
    assert.equal(inicioMal.cuerpo?.error?.codigo, "DATOS_INVALIDOS");
    const finMal = await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-11-20T10:00", motivo: "x" });
    assert.equal(finMal.estado, 400);
    assert.equal(finMal.cuerpo?.error?.codigo, "DATOS_INVALIDOS");
  } finally {
    await p.cerrar();
  }
});

test("T3.08 fin tiene que ser posterior a inicio", async () => {
  const p = await arrancar();
  try {
    const r = await bloquear(p, "pista-3", { inicio: "2026-11-20T11:00", fin: "2026-11-20T09:30", motivo: "x" });
    assert.equal(r.estado, 400);
    assert.equal(r.cuerpo?.error?.codigo, "DATOS_INVALIDOS");
  } finally {
    await p.cerrar();
  }
});

test("T3.09 un bloqueo dura como máximo 14 días", async () => {
  const p = await arrancar();
  try {
    const largo = await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-12-05T23:00", motivo: "Obras" });
    assert.equal(largo.estado, 400);
    assert.equal(largo.cuerpo?.error?.codigo, "DATOS_INVALIDOS");
    const valido = await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-12-03T23:00", motivo: "Obras" });
    assert.equal(valido.estado, 201);
  } finally {
    await p.cerrar();
  }
});

test("T3.10 no se puede bloquear en el pasado", async () => {
  const p = await arrancar();
  try {
    const r = await bloquear(p, "pista-3", { inicio: "2026-11-16T08:00", fin: "2026-11-16T09:30", motivo: "x" });
    assert.equal(r.estado, 400);
    assert.equal(r.cuerpo?.error?.codigo, "DATOS_INVALIDOS");
  } finally {
    await p.cerrar();
  }
});

test("T3.11 el motivo es obligatorio y tiene como máximo 200 caracteres", async () => {
  const p = await arrancar();
  try {
    const sin = await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-11-20T09:30" });
    assert.equal(sin.estado, 400);
    const largo = await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-11-20T09:30", motivo: "x".repeat(201) });
    assert.equal(largo.estado, 400);
    const justo = await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-11-20T09:30", motivo: "x".repeat(200) });
    assert.equal(justo.estado, 201);
  } finally {
    await p.cerrar();
  }
});

test("T3.12 los errores de validación traen detalles", async () => {
  const p = await arrancar();
  try {
    const r = await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-11-20T09:30" });
    assert.equal(r.cuerpo?.error?.codigo, "DATOS_INVALIDOS");
    assert.ok(r.cuerpo?.error?.detalles, "falta error.detalles");
  } finally {
    await p.cerrar();
  }
});

test("T3.13 con reservas que se solapan devuelve 409 PISTA_CON_RESERVAS con sus ids y no bloquea nada", async () => {
  const p = await arrancar();
  try {
    const r = await bloquear(p, "pista-1", { inicio: "2026-11-17T17:00", fin: "2026-11-18T20:00", motivo: "Torneo" });
    assert.equal(r.estado, 409);
    assert.equal(r.cuerpo?.error?.codigo, "PISTA_CON_RESERVAS");
    assert.deepEqual([...(r.cuerpo?.error?.detalles?.reservas ?? [])].sort(), ["reserva-ana-1", "reserva-marta-1"]);
    assert.equal(await estadoDeFranja(p, "pista-1", "2026-11-17T17:00"), "libre");
    assert.equal(await estadoDeFranja(p, "pista-1", "2026-11-17T18:30"), "reservada");
  } finally {
    await p.cerrar();
  }
});

test("T3.14 con cancelarReservas las cancela como cancelaciones del club", async () => {
  const p = await arrancar();
  try {
    const r = await bloquear(p, "pista-1", { inicio: "2026-11-17T17:00", fin: "2026-11-18T20:00", motivo: "Torneo", cancelarReservas: true });
    assert.equal(r.estado, 201);
    assert.deepEqual([...(r.cuerpo?.bloqueo?.reservasCanceladas ?? [])].sort(), ["reserva-ana-1", "reserva-marta-1"]);
    const mias = await p.pedir("GET", "/api/reservas/mias", "socio-ana");
    const ana = mias.cuerpo?.reservas?.find((x: any) => x.id === "reserva-ana-1");
    assert.equal(ana?.estado, "cancelada");
    assert.equal(ana?.canceladaPor, "gestor");
    assert.equal(await estadoDeFranja(p, "pista-1", "2026-11-17T18:30"), "bloqueada");
  } finally {
    await p.cerrar();
  }
});

test("T3.15 avisa a cada socio con una reserva cancelada por el bloqueo", async () => {
  const p = await arrancar();
  try {
    await bloquear(p, "pista-1", { inicio: "2026-11-17T17:00", fin: "2026-11-18T20:00", motivo: "Torneo", cancelarReservas: true });
    const avisos = p.app.notificaciones.listar();
    for (const socio of ["socio-ana", "socio-marta"]) {
      assert.ok(avisos.some((n: any) => n.socioId === socio && n.plantilla === "reserva_cancelada_por_el_club"), socio);
    }
  } finally {
    await p.cerrar();
  }
});

test("T3.16 cada bloqueo se audita", async () => {
  const p = await arrancar();
  try {
    await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-11-20T09:30", motivo: "Cambio de red" });
    assert.ok(p.app.auditoria.listar().some((e: any) => e.accion === "bloquear_pista" && e.actorId === "gestor-carmen"));
  } finally {
    await p.cerrar();
  }
});

test("T3.17 los bloqueos pueden solaparse entre sí", async () => {
  const p = await arrancar();
  try {
    const a = await bloquear(p, "pista-3", { inicio: "2026-11-20T08:00", fin: "2026-11-20T12:30", motivo: "Red" });
    const b = await bloquear(p, "pista-3", { inicio: "2026-11-20T09:30", fin: "2026-11-20T14:00", motivo: "Pintura" });
    assert.equal(a.estado, 201);
    assert.equal(b.estado, 201);
  } finally {
    await p.cerrar();
  }
});

test("T3.18 sin cabecera x-socio-id devuelve 401 NO_AUTENTICADO", async () => {
  const p = await arrancar();
  try {
    const r = await p.pedir("POST", ruta("pista-3"), undefined, { inicio: "2026-11-20T08:00", fin: "2026-11-20T09:30", motivo: "x" });
    assert.equal(r.estado, 401);
    assert.equal(r.cuerpo?.error?.codigo, "NO_AUTENTICADO");
  } finally {
    await p.cerrar();
  }
});
