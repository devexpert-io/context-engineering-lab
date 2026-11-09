import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { type AppDePrueba, arrancarApp } from "./ayudantes.ts";

describe("POST /api/gestion/socios", () => {
  let prueba: AppDePrueba;

  beforeEach(async () => {
    prueba = await arrancarApp();
  });

  afterEach(() => prueba.cerrar());

  function darDeAlta(socio: string, cuerpo: unknown) {
    return prueba.post("/api/gestion/socios", socio, cuerpo);
  }

  it("el gestor da de alta un socio: 201, auditoría alta_socio y aviso de bienvenida", async () => {
    const { estado, cuerpo } = await darDeAlta("gestor-carmen", {
      nombre: "Nuria Gil",
      email: "nuria.gil@example.com",
    });

    assert.equal(estado, 201);
    assert.deepEqual(cuerpo, {
      socio: {
        id: "socio-1",
        nombre: "Nuria Gil",
        email: "nuria.gil@example.com",
        cuotaActiva: true,
        rol: "socio",
        altaEn: "2026-11-16T10:00",
      },
    });
    assert.deepEqual(prueba.auditoria.listar(), [
      {
        accion: "alta_socio",
        actorId: "gestor-carmen",
        datos: { socioId: "socio-1" },
        fecha: "2026-11-16T10:00",
      },
    ]);
    assert.deepEqual(prueba.notificaciones.listar(), [
      {
        socioId: "socio-1",
        plantilla: "bienvenida",
        datos: { nombre: "Nuria Gil" },
        enviadaEn: "2026-11-16T10:00",
      },
    ]);
  });

  it("normaliza nombre y email y respeta cuotaActiva: false", async () => {
    const { cuerpo } = await darDeAlta("gestor-carmen", {
      nombre: "  Nuria Gil ",
      email: " Nuria.Gil@Example.com ",
      cuotaActiva: false,
    });

    assert.equal(cuerpo.socio.nombre, "Nuria Gil");
    assert.equal(cuerpo.socio.email, "nuria.gil@example.com");
    assert.equal(cuerpo.socio.cuotaActiva, false);
  });

  it("el socio dado de alta ya puede identificarse con su id", async () => {
    const { cuerpo } = await darDeAlta("gestor-carmen", {
      nombre: "Nuria Gil",
      email: "nuria.gil@example.com",
    });

    const yo = await prueba.get("/api/socios/yo", cuerpo.socio.id);
    assert.equal(yo.estado, 200);
    assert.equal(yo.cuerpo.socio.email, "nuria.gil@example.com");
  });

  it("valida los campos: 400 DATOS_INVALIDOS con detalles y sin efectos", async () => {
    const { estado, cuerpo } = await darDeAlta("gestor-carmen", {
      nombre: "N",
      email: "nuria-sin-arroba",
      cuotaActiva: "sí",
    });

    assert.equal(estado, 400);
    assert.deepEqual(cuerpo.error, {
      codigo: "DATOS_INVALIDOS",
      mensaje: "Los datos enviados no son válidos",
      detalles: {
        nombre: "Debe tener al menos 2 caracteres",
        email: "No es un email válido",
        cuotaActiva: "Debe ser true o false",
      },
    });
    assert.deepEqual(prueba.auditoria.listar(), []);
    assert.deepEqual(prueba.notificaciones.listar(), []);
  });

  it("exige nombre y email", async () => {
    const { estado, cuerpo } = await darDeAlta("gestor-carmen", { nombre: "   " });

    assert.equal(estado, 400);
    assert.deepEqual(cuerpo.error.detalles, { nombre: "Es obligatorio", email: "Es obligatorio" });
  });

  it("un email ya registrado responde 409 EMAIL_YA_REGISTRADO", async () => {
    const { estado, cuerpo } = await darDeAlta("gestor-carmen", {
      nombre: "Ana García",
      email: "ANA.GARCIA@example.com",
    });

    assert.equal(estado, 409);
    assert.equal(cuerpo.error.codigo, "EMAIL_YA_REGISTRADO");
    assert.deepEqual(prueba.notificaciones.listar(), []);
  });

  it("un socio que no es gestor recibe 403 SOLO_GESTOR y no se da de alta a nadie", async () => {
    const { estado, cuerpo } = await darDeAlta("socio-ana", {
      nombre: "Nuria Gil",
      email: "nuria.gil@example.com",
    });

    assert.equal(estado, 403);
    assert.equal(cuerpo.error.codigo, "SOLO_GESTOR");
    assert.equal(prueba.servicios.socios.buscar("socio-1"), undefined);
    assert.deepEqual(prueba.auditoria.listar(), []);
  });
});
