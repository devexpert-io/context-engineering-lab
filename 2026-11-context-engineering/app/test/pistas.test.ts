import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { type AppDePrueba, arrancarApp } from "./ayudantes.ts";

describe("GET /api/pistas", () => {
  let prueba: AppDePrueba;

  beforeEach(async () => {
    prueba = await arrancarApp();
  });

  afterEach(() => prueba.cerrar());

  it("lista las pistas del club con su estado", async () => {
    const { estado, cuerpo } = await prueba.get("/api/pistas", "socio-ana");

    assert.equal(estado, 200);
    assert.deepEqual(cuerpo, {
      pistas: [
        { id: "pista-1", nombre: "Pista 1", estado: "operativa" },
        { id: "pista-2", nombre: "Pista 2", estado: "operativa" },
        { id: "pista-3", nombre: "Pista 3", estado: "operativa" },
        { id: "pista-4", nombre: "Pista 4", estado: "cerrada" },
      ],
    });
  });

  it("GET /api/pistas/:pistaId devuelve una pista", async () => {
    const { estado, cuerpo } = await prueba.get("/api/pistas/pista-4", "socio-ana");

    assert.equal(estado, 200);
    assert.deepEqual(cuerpo, { pista: { id: "pista-4", nombre: "Pista 4", estado: "cerrada" } });
  });

  it("GET /api/pistas/:pistaId de una pista que no existe responde 404 PISTA_NO_ENCONTRADA", async () => {
    const { estado, cuerpo } = await prueba.get("/api/pistas/pista-9", "socio-ana");

    assert.equal(estado, 404);
    assert.deepEqual(cuerpo, {
      error: { codigo: "PISTA_NO_ENCONTRADA", mensaje: "No existe la pista pista-9" },
    });
  });
});
