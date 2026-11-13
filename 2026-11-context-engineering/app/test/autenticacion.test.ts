import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { type AppDePrueba, arrancarApp } from "./ayudantes.ts";

describe("autenticación con la cabecera x-socio-id", () => {
  let prueba: AppDePrueba;

  beforeEach(async () => {
    prueba = await arrancarApp();
  });

  afterEach(() => prueba.cerrar());

  it("sin cabecera responde 401 NO_AUTENTICADO", async () => {
    const { estado, cuerpo } = await prueba.get("/api/pistas");

    assert.equal(estado, 401);
    assert.deepEqual(cuerpo, {
      error: { codigo: "NO_AUTENTICADO", mensaje: "Falta la cabecera x-socio-id" },
    });
  });

  it("con un id que no es de ningún socio responde 401 NO_AUTENTICADO", async () => {
    const { estado, cuerpo } = await prueba.get("/api/pistas", "socio-fantasma");

    assert.equal(estado, 401);
    assert.equal(cuerpo.error.codigo, "NO_AUTENTICADO");
  });

  it("también exige la cabecera en las rutas de gestión", async () => {
    const { estado } = await prueba.post("/api/gestion/socios", undefined, {
      nombre: "Nuria Gil",
      email: "nuria.gil@example.com",
    });

    assert.equal(estado, 401);
  });

  it("GET /api/socios/yo devuelve el socio identificado", async () => {
    const { estado, cuerpo } = await prueba.get("/api/socios/yo", "gestor-carmen");

    assert.equal(estado, 200);
    assert.deepEqual(cuerpo, {
      socio: {
        id: "gestor-carmen",
        nombre: "Carmen Díaz",
        email: "carmen.diaz@example.com",
        cuotaActiva: true,
        rol: "gestor",
        altaEn: "2026-09-01T10:00",
      },
    });
  });

  it("las rutas de gestión responden 403 SOLO_GESTOR a un socio sin ese rol", async () => {
    const alta = await prueba.post("/api/gestion/socios", "socio-marta", {});
    const pista = await prueba.patch("/api/gestion/pistas/pista-1", "socio-marta", {});

    for (const { estado, cuerpo } of [alta, pista]) {
      assert.equal(estado, 403);
      assert.deepEqual(cuerpo, {
        error: { codigo: "SOLO_GESTOR", mensaje: "Solo el gestor puede hacer esta operación" },
      });
    }
  });
});
