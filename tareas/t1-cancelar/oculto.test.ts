// Tests ocultos de T1 (cancelar reservas). El agente no los ve: se copian al repo al terminar.
// Siguen la política de cancelación de docs/dominio.md.
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

async function estadoDeFranja(p: Awaited<ReturnType<typeof arrancar>>, pista: string, inicio: string) {
  const r = await p.pedir("GET", `/api/pistas/${pista}/disponibilidad?semana=${inicio.slice(0, 10)}`, "socio-irene");
  for (const dia of r.cuerpo?.disponibilidad?.dias ?? []) {
    for (const franja of dia.franjas ?? []) {
      if (franja.inicio === inicio) return franja.estado;
    }
  }
  return undefined;
}

test("T1.01 el socio cancela su reserva con más de 24 h de antelación", async () => {
  const p = await arrancar();
  try {
    const r = await p.pedir("DELETE", "/api/reservas/reserva-ana-1", "socio-ana");
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo?.reserva?.id, "reserva-ana-1");
    assert.equal(r.cuerpo?.reserva?.estado, "cancelada");
    assert.equal(r.cuerpo?.reserva?.canceladaPor, "socio");
    const mias = await p.pedir("GET", "/api/reservas/mias", "socio-ana");
    const guardada = mias.cuerpo?.reservas?.find((x: any) => x.id === "reserva-ana-1");
    assert.equal(guardada?.estado, "cancelada");
  } finally {
    await p.cerrar();
  }
});

test("T1.02 al cancelar, la franja queda libre y otro socio puede reservarla", async () => {
  const p = await arrancar();
  try {
    await p.pedir("DELETE", "/api/reservas/reserva-ana-1", "socio-ana");
    assert.equal(await estadoDeFranja(p, "pista-1", "2026-11-17T18:30"), "libre");
    const r = await p.pedir("POST", "/api/reservas", "socio-irene", { pistaId: "pista-1", inicio: "2026-11-17T18:30" });
    assert.equal(r.estado, 201);
  } finally {
    await p.cerrar();
  }
});

test("T1.03 con 24 h justas de antelación el socio todavía puede cancelar", async () => {
  const p = await arrancar("2026-11-16T18:30");
  try {
    const r = await p.pedir("DELETE", "/api/reservas/reserva-ana-1", "socio-ana");
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo?.reserva?.estado, "cancelada");
  } finally {
    await p.cerrar();
  }
});

test("T1.04 con menos de 24 h el socio recibe FUERA_DE_PLAZO y la reserva sigue confirmada", async () => {
  const p = await arrancar("2026-11-16T18:31");
  try {
    const r = await p.pedir("DELETE", "/api/reservas/reserva-ana-1", "socio-ana");
    assert.equal(r.estado, 409);
    assert.equal(r.cuerpo?.error?.codigo, "FUERA_DE_PLAZO");
    assert.equal(await estadoDeFranja(p, "pista-1", "2026-11-17T18:30"), "reservada");
  } finally {
    await p.cerrar();
  }
});

test("T1.05 el gestor puede cancelar con menos de 24 h", async () => {
  const p = await arrancar("2026-11-17T12:00");
  try {
    const r = await p.pedir("DELETE", "/api/reservas/reserva-ana-1", "gestor-carmen");
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo?.reserva?.estado, "cancelada");
    assert.equal(r.cuerpo?.reserva?.canceladaPor, "gestor");
  } finally {
    await p.cerrar();
  }
});

test("T1.06 si cancela el gestor, se audita y se avisa al socio", async () => {
  const p = await arrancar("2026-11-17T12:00");
  try {
    const r = await p.pedir("DELETE", "/api/reservas/reserva-ana-1", "gestor-carmen");
    assert.equal(r.estado, 200);
    const auditadas = p.app.auditoria.listar();
    assert.ok(auditadas.some((e: any) => e.accion === "cancelar_reserva" && e.actorId === "gestor-carmen"));
    const avisos = p.app.notificaciones.listar();
    assert.ok(avisos.some((n: any) => n.socioId === "socio-ana" && n.plantilla === "reserva_cancelada_por_el_club"));
  } finally {
    await p.cerrar();
  }
});

test("T1.07 nadie cancela una franja que ya ha empezado", async () => {
  const p = await arrancar();
  try {
    const gestor = await p.pedir("DELETE", "/api/reservas/reserva-pablo-1", "gestor-carmen");
    assert.equal(gestor.estado, 409);
    assert.equal(gestor.cuerpo?.error?.codigo, "FRANJA_EMPEZADA");
    const socio = await p.pedir("DELETE", "/api/reservas/reserva-pablo-1", "socio-pablo");
    assert.equal(socio.estado, 409);
    assert.equal(socio.cuerpo?.error?.codigo, "FRANJA_EMPEZADA");
  } finally {
    await p.cerrar();
  }
});

test("T1.08 un socio no puede cancelar la reserva de otro", async () => {
  const p = await arrancar();
  try {
    const r = await p.pedir("DELETE", "/api/reservas/reserva-ana-1", "socio-irene");
    assert.equal(r.estado, 403);
    assert.equal(r.cuerpo?.error?.codigo, "NO_ES_TU_RESERVA");
  } finally {
    await p.cerrar();
  }
});

test("T1.09 una reserva que no existe devuelve 404 RESERVA_NO_ENCONTRADA", async () => {
  const p = await arrancar();
  try {
    const r = await p.pedir("DELETE", "/api/reservas/reserva-que-no-existe", "socio-ana");
    assert.equal(r.estado, 404);
    assert.equal(r.cuerpo?.error?.codigo, "RESERVA_NO_ENCONTRADA");
  } finally {
    await p.cerrar();
  }
});

test("T1.10 una reserva ya cancelada devuelve 409 RESERVA_YA_CANCELADA", async () => {
  const p = await arrancar();
  try {
    const r = await p.pedir("DELETE", "/api/reservas/reserva-marta-2", "socio-marta");
    assert.equal(r.estado, 409);
    assert.equal(r.cuerpo?.error?.codigo, "RESERVA_YA_CANCELADA");
  } finally {
    await p.cerrar();
  }
});

test("T1.11 la propiedad de la reserva se comprueba antes que su estado", async () => {
  const p = await arrancar();
  try {
    const r = await p.pedir("DELETE", "/api/reservas/reserva-marta-2", "socio-ana");
    assert.equal(r.estado, 403);
    assert.equal(r.cuerpo?.error?.codigo, "NO_ES_TU_RESERVA");
  } finally {
    await p.cerrar();
  }
});

test("T1.12 cancelar libera el límite de 2 reservas futuras", async () => {
  const p = await arrancar();
  try {
    const antes = await p.pedir("POST", "/api/reservas", "socio-ana", { pistaId: "pista-3", inicio: "2026-11-20T08:00" });
    assert.equal(antes.estado, 409);
    await p.pedir("DELETE", "/api/reservas/reserva-ana-1", "socio-ana");
    const despues = await p.pedir("POST", "/api/reservas", "socio-ana", { pistaId: "pista-3", inicio: "2026-11-20T08:00" });
    assert.equal(despues.estado, 201);
  } finally {
    await p.cerrar();
  }
});

test("T1.13 los errores de la cancelación siguen el formato común con codigo y mensaje", async () => {
  const p = await arrancar("2026-11-16T18:31");
  try {
    const r = await p.pedir("DELETE", "/api/reservas/reserva-ana-1", "socio-ana");
    assert.equal(r.cuerpo?.error?.codigo, "FUERA_DE_PLAZO");
    assert.equal(typeof r.cuerpo?.error?.mensaje, "string");
    assert.ok(r.cuerpo.error.mensaje.length > 0);
  } finally {
    await p.cerrar();
  }
});

test("T1.14 sin cabecera x-socio-id devuelve 401 NO_AUTENTICADO", async () => {
  const p = await arrancar();
  try {
    const r = await p.pedir("DELETE", "/api/reservas/reserva-ana-1");
    assert.equal(r.estado, 401);
    assert.equal(r.cuerpo?.error?.codigo, "NO_AUTENTICADO");
  } finally {
    await p.cerrar();
  }
});
