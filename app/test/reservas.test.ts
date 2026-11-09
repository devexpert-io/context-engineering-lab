import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { DiaDisponible, Reserva } from "../src/dominio/tipos.ts";
import { type AppDePrueba, arrancarApp } from "./ayudantes.ts";

describe("POST /api/reservas", () => {
  let prueba: AppDePrueba;

  beforeEach(async () => {
    prueba = await arrancarApp();
  });

  afterEach(() => prueba.cerrar());

  function reservar(socio: string, pistaId: string, inicio: string) {
    return prueba.post("/api/reservas", socio, { pistaId, inicio });
  }

  it("reserva una franja libre y responde 201 con la reserva confirmada", async () => {
    const { estado, cuerpo } = await reservar("socio-irene", "pista-1", "2026-11-18T09:30");

    assert.equal(estado, 201);
    assert.deepEqual(cuerpo, {
      reserva: {
        id: "reserva-1",
        socioId: "socio-irene",
        pistaId: "pista-1",
        inicio: "2026-11-18T09:30",
        fin: "2026-11-18T11:00",
        estado: "confirmada",
        creadaEn: "2026-11-16T10:00",
      },
    });
  });

  it("la franja reservada aparece como reservada para los demás socios", async () => {
    await reservar("socio-irene", "pista-3", "2026-11-20T17:00");

    const { cuerpo } = await prueba.get(
      "/api/pistas/pista-3/disponibilidad?semana=2026-11-20",
      "socio-ana",
    );
    const viernes = (cuerpo.disponibilidad.dias as DiaDisponible[]).find(
      (dia) => dia.fecha === "2026-11-20",
    );
    const franja = viernes?.franjas.find((candidata) => candidata.inicio === "2026-11-20T17:00");
    assert.equal(franja?.estado, "reservada");
  });

  it("una franja cuya única reserva está cancelada se puede reservar", async () => {
    const { estado, cuerpo } = await reservar("socio-irene", "pista-2", "2026-11-18T20:00");

    assert.equal(estado, 201);
    assert.equal(cuerpo.reserva.estado, "confirmada");
  });

  it("un socio sin cuota activa no puede reservar: 409 CUOTA_INACTIVA", async () => {
    const { estado, cuerpo } = await reservar("socio-luis", "pista-1", "2026-11-18T09:30");

    assert.equal(estado, 409);
    assert.equal(cuerpo.error.codigo, "CUOTA_INACTIVA");
  });

  it("con 2 reservas confirmadas futuras, la tercera responde 409 LIMITE_DE_RESERVAS", async () => {
    const { estado, cuerpo } = await reservar("socio-ana", "pista-3", "2026-11-21T11:00");

    assert.equal(estado, 409);
    assert.equal(cuerpo.error.codigo, "LIMITE_DE_RESERVAS");
  });

  it("las reservas canceladas no cuentan para el límite", async () => {
    const segunda = await reservar("socio-marta", "pista-3", "2026-11-21T11:00");
    const tercera = await reservar("socio-marta", "pista-3", "2026-11-22T11:00");

    assert.equal(segunda.estado, 201);
    assert.equal(tercera.estado, 409);
    assert.equal(tercera.cuerpo.error.codigo, "LIMITE_DE_RESERVAS");
  });

  it("las reservas que ya han empezado no cuentan para el límite", async () => {
    const primera = await reservar("socio-pablo", "pista-2", "2026-11-17T08:00");
    const segunda = await reservar("socio-pablo", "pista-2", "2026-11-18T08:00");
    const tercera = await reservar("socio-pablo", "pista-2", "2026-11-19T08:00");

    assert.equal(primera.estado, 201);
    assert.equal(segunda.estado, 201);
    assert.equal(tercera.cuerpo.error.codigo, "LIMITE_DE_RESERVAS");
  });

  it("una franja ya reservada responde 409 FRANJA_NO_DISPONIBLE", async () => {
    const { estado, cuerpo } = await reservar("socio-irene", "pista-1", "2026-11-17T18:30");

    assert.equal(estado, 409);
    assert.deepEqual(cuerpo, {
      error: { codigo: "FRANJA_NO_DISPONIBLE", mensaje: "La franja ya está reservada" },
    });
  });

  it("una franja de una pista cerrada responde 409 FRANJA_NO_DISPONIBLE", async () => {
    const { estado, cuerpo } = await reservar("socio-irene", "pista-4", "2026-11-18T09:30");

    assert.equal(estado, 409);
    assert.deepEqual(cuerpo, {
      error: { codigo: "FRANJA_NO_DISPONIBLE", mensaje: "La pista está cerrada" },
    });
  });

  it("una franja que ya ha empezado responde 409 FRANJA_PASADA", async () => {
    for (const inicio of ["2026-11-16T09:30", "2026-11-13T18:30"]) {
      const { estado, cuerpo } = await reservar("socio-irene", "pista-2", inicio);
      assert.equal(estado, 409, inicio);
      assert.equal(cuerpo.error.codigo, "FRANJA_PASADA");
    }
  });

  it("una franja se puede reservar hasta el minuto anterior a su inicio", async () => {
    prueba.reloj.fijar("2026-11-16T10:59");
    const antes = await reservar("socio-irene", "pista-2", "2026-11-16T11:00");
    prueba.reloj.fijar("2026-11-16T11:00");
    const despues = await reservar("socio-marta", "pista-3", "2026-11-16T11:00");

    assert.equal(antes.estado, 201);
    assert.equal(despues.estado, 409);
    assert.equal(despues.cuerpo.error.codigo, "FRANJA_PASADA");
  });

  it("un inicio que no es el de una franja responde 400 DATOS_INVALIDOS", async () => {
    for (const inicio of ["2026-11-18T10:00", "2026-11-18T22:00", "2026-11-18T07:30"]) {
      const { estado, cuerpo } = await reservar("socio-irene", "pista-1", inicio);
      assert.equal(estado, 400, inicio);
      assert.equal(cuerpo.error.codigo, "DATOS_INVALIDOS");
      assert.match(cuerpo.error.detalles.inicio, /^Las franjas empiezan a las 08:00, 09:30/);
    }
  });

  it("valida el formato de los campos y los devuelve en detalles", async () => {
    const vacia = await prueba.post("/api/reservas", "socio-irene", {});
    const malFormada = await reservar("socio-irene", "pista-1", "2026-02-30T09:30");

    assert.equal(vacia.estado, 400);
    assert.deepEqual(vacia.cuerpo.error.detalles, {
      pistaId: "Es obligatorio",
      inicio: "Es obligatorio",
    });
    assert.equal(malFormada.estado, 400);
    assert.deepEqual(malFormada.cuerpo.error.detalles, {
      inicio: "Debe ser una fecha y hora con formato AAAA-MM-DDTHH:mm",
    });
  });

  it("una pista que no existe responde 404 PISTA_NO_ENCONTRADA", async () => {
    const { estado, cuerpo } = await reservar("socio-irene", "pista-9", "2026-11-18T09:30");

    assert.equal(estado, 404);
    assert.equal(cuerpo.error.codigo, "PISTA_NO_ENCONTRADA");
  });

  it("aplica las reglas en el orden documentado", async () => {
    const cuotaAntesQuePasada = await reservar("socio-luis", "pista-1", "2026-11-16T09:30");
    const pasadaAntesQueOcupada = await reservar("socio-irene", "pista-1", "2026-11-16T09:30");
    const ocupadaAntesQueLimite = await reservar("socio-ana", "pista-1", "2026-11-18T18:30");

    assert.equal(cuotaAntesQuePasada.cuerpo.error.codigo, "CUOTA_INACTIVA");
    assert.equal(pasadaAntesQueOcupada.cuerpo.error.codigo, "FRANJA_PASADA");
    assert.equal(ocupadaAntesQueLimite.cuerpo.error.codigo, "FRANJA_NO_DISPONIBLE");
  });

  it("no crea ninguna reserva cuando la petición falla", async () => {
    await reservar("socio-luis", "pista-1", "2026-11-18T09:30");
    await reservar("socio-irene", "pista-1", "2026-11-17T18:30");

    assert.deepEqual(prueba.servicios.reservas.deSocio("socio-luis"), []);
    assert.deepEqual(prueba.servicios.reservas.deSocio("socio-irene"), []);
  });
});

describe("GET /api/reservas/mias", () => {
  let prueba: AppDePrueba;

  beforeEach(async () => {
    prueba = await arrancarApp();
  });

  afterEach(() => prueba.cerrar());

  it("devuelve las reservas del socio en cualquier estado, ordenadas por inicio", async () => {
    const { estado, cuerpo } = await prueba.get("/api/reservas/mias", "socio-pablo");

    assert.equal(estado, 200);
    assert.deepEqual(
      cuerpo.reservas.map((reserva: Reserva) => [reserva.id, reserva.inicio, reserva.estado]),
      [
        ["reserva-pablo-2", "2026-11-13T20:00", "no_presentada"],
        ["reserva-pablo-1", "2026-11-16T09:30", "confirmada"],
      ],
    );
  });

  it("solo incluye reservas del socio identificado", async () => {
    const antes = await prueba.get("/api/reservas/mias", "socio-irene");
    await prueba.post("/api/reservas", "socio-irene", {
      pistaId: "pista-2",
      inicio: "2026-11-17T08:00",
    });
    const despues = await prueba.get("/api/reservas/mias", "socio-irene");

    assert.deepEqual(antes.cuerpo, { reservas: [] });
    assert.deepEqual(
      despues.cuerpo.reservas.map((reserva: Reserva) => reserva.socioId),
      ["socio-irene"],
    );
  });
});
