import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { type AppDePrueba, arrancarApp } from "./ayudantes.ts";

describe("convenciones HTTP", () => {
  let prueba: AppDePrueba;

  beforeEach(async () => {
    prueba = await arrancarApp();
  });

  afterEach(() => prueba.cerrar());

  it("responde siempre JSON en UTF-8", async () => {
    const respuesta = await fetch(`${prueba.url}/api/pistas`, {
      headers: { "x-socio-id": "socio-ana" },
    });

    assert.equal(respuesta.headers.get("content-type"), "application/json; charset=utf-8");
  });

  it("una ruta que no existe responde 404 RUTA_NO_ENCONTRADA", async () => {
    const { estado, cuerpo } = await prueba.get("/api/no-existe", "socio-ana");

    assert.equal(estado, 404);
    assert.deepEqual(cuerpo, {
      error: { codigo: "RUTA_NO_ENCONTRADA", mensaje: "No existe la ruta GET /api/no-existe" },
    });
  });

  it("un método que la ruta no admite responde 405 METODO_NO_PERMITIDO", async () => {
    const { estado, cuerpo } = await prueba.pedir("DELETE", "/api/pistas", { socio: "socio-ana" });

    assert.equal(estado, 405);
    assert.equal(cuerpo.error.codigo, "METODO_NO_PERMITIDO");
  });

  it("un cuerpo que no es JSON responde 400 DATOS_INVALIDOS", async () => {
    const { estado, cuerpo } = await prueba.pedir("POST", "/api/reservas", {
      socio: "socio-irene",
      cuerpoEnTexto: "{pistaId: pista-1",
    });

    assert.equal(estado, 400);
    assert.deepEqual(cuerpo.error.detalles, { cuerpo: "No es un JSON válido" });
  });

  it("un cuerpo JSON que no es un objeto responde 400 DATOS_INVALIDOS", async () => {
    const { estado, cuerpo } = await prueba.post("/api/reservas", "socio-irene", ["pista-1"]);

    assert.equal(estado, 400);
    assert.deepEqual(cuerpo.error.detalles, { cuerpo: "Se esperaba un objeto JSON" });
  });

  it("un cuerpo de más de 64 KB responde 413 CUERPO_DEMASIADO_GRANDE", async () => {
    const { estado, cuerpo } = await prueba.post("/api/reservas", "socio-irene", {
      pistaId: "pista-1",
      relleno: "x".repeat(70 * 1024),
    });

    assert.equal(estado, 413);
    assert.equal(cuerpo.error.codigo, "CUERPO_DEMASIADO_GRANDE");
  });
});
