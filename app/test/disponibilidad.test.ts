import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { DiaDisponible, FranjaConEstado } from "../src/dominio/tipos.ts";
import { type AppDePrueba, arrancarApp } from "./ayudantes.ts";

const SEMANA_BASE = [
  "2026-11-16",
  "2026-11-17",
  "2026-11-18",
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
];

const FRANJAS_DEL_HORARIO = [
  ["08:00", "09:30"],
  ["09:30", "11:00"],
  ["11:00", "12:30"],
  ["12:30", "14:00"],
  ["14:00", "15:30"],
  ["15:30", "17:00"],
  ["17:00", "18:30"],
  ["18:30", "20:00"],
  ["20:00", "21:30"],
  ["21:30", "23:00"],
];

function franjaQueEmpieza(dias: DiaDisponible[], inicio: string): FranjaConEstado | undefined {
  return dias.flatMap((dia) => dia.franjas).find((candidata) => candidata.inicio === inicio);
}

describe("GET /api/pistas/:pistaId/disponibilidad", () => {
  let prueba: AppDePrueba;

  beforeEach(async () => {
    prueba = await arrancarApp();
  });

  afterEach(() => prueba.cerrar());

  it("devuelve 7 días de lunes a domingo, también si la fecha es domingo o la semana cambia de mes", async () => {
    const casos = [
      { semana: "2026-11-18", dias: SEMANA_BASE },
      { semana: "2026-11-22", dias: SEMANA_BASE },
      {
        semana: "2026-12-02",
        dias: [
          "2026-11-30",
          "2026-12-01",
          "2026-12-02",
          "2026-12-03",
          "2026-12-04",
          "2026-12-05",
          "2026-12-06",
        ],
      },
      {
        semana: "2027-01-01",
        dias: [
          "2026-12-28",
          "2026-12-29",
          "2026-12-30",
          "2026-12-31",
          "2027-01-01",
          "2027-01-02",
          "2027-01-03",
        ],
      },
    ];

    for (const caso of casos) {
      const { estado, cuerpo } = await prueba.get(
        `/api/pistas/pista-1/disponibilidad?semana=${caso.semana}`,
        "socio-ana",
      );
      assert.equal(estado, 200);
      const { desde, hasta, dias } = cuerpo.disponibilidad;
      assert.deepEqual(
        dias.map((dia: DiaDisponible) => dia.fecha),
        caso.dias,
        `semana=${caso.semana}`,
      );
      assert.equal(desde, caso.dias[0]);
      assert.equal(hasta, caso.dias[6]);
    }
  });

  it("cada día tiene las 10 franjas de 90 minutos del horario del club", async () => {
    const { cuerpo } = await prueba.get(
      "/api/pistas/pista-3/disponibilidad?semana=2026-11-18",
      "socio-ana",
    );

    for (const dia of cuerpo.disponibilidad.dias as DiaDisponible[]) {
      assert.deepEqual(
        dia.franjas.map((franja) => [franja.inicio, franja.fin]),
        FRANJAS_DEL_HORARIO.map((horas) => horas.map((hora) => `${dia.fecha}T${hora}`)),
      );
    }
  });

  it("marca como reservadas las franjas con una reserva confirmada, aunque ya hayan empezado", async () => {
    const { cuerpo } = await prueba.get(
      "/api/pistas/pista-1/disponibilidad?semana=2026-11-16",
      "socio-irene",
    );
    const { dias } = cuerpo.disponibilidad;

    assert.equal(franjaQueEmpieza(dias, "2026-11-17T18:30")?.estado, "reservada");
    assert.equal(franjaQueEmpieza(dias, "2026-11-18T18:30")?.estado, "reservada");
    assert.equal(franjaQueEmpieza(dias, "2026-11-16T09:30")?.estado, "reservada");
    assert.equal(franjaQueEmpieza(dias, "2026-11-17T20:00")?.estado, "libre");
  });

  it("una reserva cancelada no ocupa su franja", async () => {
    const { cuerpo } = await prueba.get(
      "/api/pistas/pista-2/disponibilidad?semana=2026-11-16",
      "socio-irene",
    );
    const { dias } = cuerpo.disponibilidad;

    assert.equal(franjaQueEmpieza(dias, "2026-11-18T20:00")?.estado, "libre");
    assert.equal(franjaQueEmpieza(dias, "2026-11-19T20:00")?.estado, "reservada");
  });

  it("todas las franjas de una pista cerrada salen cerradas", async () => {
    const { estado, cuerpo } = await prueba.get("/api/pistas/pista-4/disponibilidad", "socio-ana");

    assert.equal(estado, 200);
    const franjas = (cuerpo.disponibilidad.dias as DiaDisponible[]).flatMap((dia) => dia.franjas);
    assert.ok(franjas.length > 0);
    assert.ok(franjas.every((franja) => franja.estado === "cerrada"));
  });

  it("sin el parámetro semana devuelve la semana actual del reloj", async () => {
    const sinSemana = await prueba.get("/api/pistas/pista-1/disponibilidad", "socio-ana");
    const conSemana = await prueba.get(
      "/api/pistas/pista-1/disponibilidad?semana=2026-11-16",
      "socio-ana",
    );

    assert.equal(sinSemana.estado, 200);
    assert.deepEqual(sinSemana.cuerpo, conSemana.cuerpo);
  });

  it("una semana con formato incorrecto responde 400 DATOS_INVALIDOS", async () => {
    for (const semana of ["16-11-2026", "2026-02-30", ""]) {
      const { estado, cuerpo } = await prueba.get(
        `/api/pistas/pista-1/disponibilidad?semana=${semana}`,
        "socio-ana",
      );
      assert.equal(estado, 400, `semana=${semana}`);
      assert.equal(cuerpo.error.codigo, "DATOS_INVALIDOS");
      assert.equal(cuerpo.error.detalles.semana, "Debe ser una fecha con formato AAAA-MM-DD");
    }
  });

  it("una pista que no existe responde 404 PISTA_NO_ENCONTRADA", async () => {
    const { estado, cuerpo } = await prueba.get("/api/pistas/pista-9/disponibilidad", "socio-ana");

    assert.equal(estado, 404);
    assert.equal(cuerpo.error.codigo, "PISTA_NO_ENCONTRADA");
  });
});
