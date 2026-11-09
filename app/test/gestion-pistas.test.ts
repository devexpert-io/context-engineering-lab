import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { DiaDisponible } from "../src/dominio/tipos.ts";
import { type AppDePrueba, arrancarApp } from "./ayudantes.ts";

describe("PATCH /api/gestion/pistas/:pistaId", () => {
  let prueba: AppDePrueba;

  beforeEach(async () => {
    prueba = await arrancarApp();
  });

  afterEach(() => prueba.cerrar());

  it("el gestor cierra una pista: 200 con la pista y registro en la auditoría", async () => {
    const { estado, cuerpo } = await prueba.patch("/api/gestion/pistas/pista-2", "gestor-carmen", {
      estado: "cerrada",
    });

    assert.equal(estado, 200);
    assert.deepEqual(cuerpo, { pista: { id: "pista-2", nombre: "Pista 2", estado: "cerrada" } });
    assert.deepEqual(prueba.auditoria.listar(), [
      {
        accion: "cambiar_estado_pista",
        actorId: "gestor-carmen",
        datos: { pistaId: "pista-2", anterior: "operativa", nuevo: "cerrada" },
        fecha: "2026-11-16T10:00",
      },
    ]);
  });

  it("con la pista cerrada sus franjas salen cerradas y no se pueden reservar", async () => {
    await prueba.patch("/api/gestion/pistas/pista-2", "gestor-carmen", { estado: "cerrada" });

    const disponibilidad = await prueba.get("/api/pistas/pista-2/disponibilidad", "socio-irene");
    const franjas = (disponibilidad.cuerpo.disponibilidad.dias as DiaDisponible[]).flatMap(
      (dia) => dia.franjas,
    );
    const reserva = await prueba.post("/api/reservas", "socio-irene", {
      pistaId: "pista-2",
      inicio: "2026-11-18T09:30",
    });

    assert.ok(franjas.every((franja) => franja.estado === "cerrada"));
    assert.equal(reserva.estado, 409);
    assert.equal(reserva.cuerpo.error.codigo, "FRANJA_NO_DISPONIBLE");
  });

  it("cerrar una pista no cancela sus reservas confirmadas", async () => {
    await prueba.patch("/api/gestion/pistas/pista-2", "gestor-carmen", { estado: "cerrada" });

    const { cuerpo } = await prueba.get("/api/reservas/mias", "socio-ana");
    const enLaPista2 = cuerpo.reservas.find(
      (reserva: { id: string }) => reserva.id === "reserva-ana-2",
    );
    assert.equal(enLaPista2.estado, "confirmada");
    assert.deepEqual(prueba.notificaciones.listar(), []);
  });

  it("el gestor abre una pista cerrada y sus franjas vuelven a reservarse", async () => {
    const apertura = await prueba.patch("/api/gestion/pistas/pista-4", "gestor-carmen", {
      estado: "operativa",
    });
    const reserva = await prueba.post("/api/reservas", "socio-irene", {
      pistaId: "pista-4",
      inicio: "2026-11-18T09:30",
    });

    assert.equal(apertura.cuerpo.pista.estado, "operativa");
    assert.equal(reserva.estado, 201);
  });

  it("un estado que no existe responde 400 DATOS_INVALIDOS", async () => {
    const { estado, cuerpo } = await prueba.patch("/api/gestion/pistas/pista-1", "gestor-carmen", {
      estado: "en obras",
    });

    assert.equal(estado, 400);
    assert.deepEqual(cuerpo.error.detalles, {
      estado: "Debe ser uno de estos valores: operativa, cerrada",
    });
    assert.deepEqual(prueba.auditoria.listar(), []);
  });

  it("una pista que no existe responde 404 PISTA_NO_ENCONTRADA", async () => {
    const { estado, cuerpo } = await prueba.patch("/api/gestion/pistas/pista-9", "gestor-carmen", {
      estado: "cerrada",
    });

    assert.equal(estado, 404);
    assert.equal(cuerpo.error.codigo, "PISTA_NO_ENCONTRADA");
  });

  it("un socio que no es gestor recibe 403 SOLO_GESTOR y la pista no cambia", async () => {
    const { estado, cuerpo } = await prueba.patch("/api/gestion/pistas/pista-1", "socio-ana", {
      estado: "cerrada",
    });
    const pista = await prueba.get("/api/pistas/pista-1", "socio-ana");

    assert.equal(estado, 403);
    assert.equal(cuerpo.error.codigo, "SOLO_GESTOR");
    assert.equal(pista.cuerpo.pista.estado, "operativa");
  });
});
