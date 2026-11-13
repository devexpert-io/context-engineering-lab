import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diaDeLaSemana,
  esFecha,
  esFechaHora,
  esInicioDeFranja,
  finDeFranja,
  franjasDelDia,
  haEmpezado,
  minutosEntre,
  sumarDias,
  sumarHoras,
  sumarMinutos,
} from "../src/dominio/tiempo.ts";

describe("dominio/tiempo", () => {
  it("suma minutos y horas cruzando días, meses y años", () => {
    assert.equal(sumarMinutos("2026-11-20T21:30", 90), "2026-11-20T23:00");
    assert.equal(sumarMinutos("2026-11-30T23:30", 45), "2026-12-01T00:15");
    assert.equal(sumarMinutos("2027-01-01T00:10", -20), "2026-12-31T23:50");
    assert.equal(sumarHoras("2026-11-20T18:30", 24), "2026-11-21T18:30");
    assert.equal(sumarHoras("2026-11-20T18:30", -24 * 14), "2026-11-06T18:30");
  });

  it("suma días teniendo en cuenta los años bisiestos", () => {
    assert.equal(sumarDias("2028-02-28", 1), "2028-02-29");
    assert.equal(sumarDias("2026-02-28", 1), "2026-03-01");
    assert.equal(sumarDias("2026-12-28", 7), "2027-01-04");
    assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
  });

  it("calcula los minutos entre dos momentos", () => {
    assert.equal(minutosEntre("2026-11-20T18:30", "2026-11-21T18:30"), 24 * 60);
    assert.equal(minutosEntre("2026-11-20T18:30", "2026-11-20T17:00"), -90);
  });

  it("valida fechas y fechas con hora sin zona", () => {
    assert.ok(esFecha("2028-02-29"));
    assert.ok(!esFecha("2026-02-29"));
    assert.ok(!esFecha("2026-11-20T18:30"));
    assert.ok(esFechaHora("2026-11-20T18:30"));
    assert.ok(!esFechaHora("2026-11-20T24:00"));
    assert.ok(!esFechaHora("2026-11-20T18:30:00"));
    assert.ok(!esFechaHora("2026-11-20T18:30Z"));
    assert.ok(!esFechaHora(20261120));
  });

  it("numera los días de la semana de lunes (1) a domingo (7)", () => {
    assert.equal(diaDeLaSemana("2026-11-16"), 1);
    assert.equal(diaDeLaSemana("2026-11-20"), 5);
    assert.equal(diaDeLaSemana("2026-11-22"), 7);
    assert.equal(diaDeLaSemana("1969-12-31"), 3);
  });

  it("genera las franjas del día de 08:00 a 23:00", () => {
    const franjas = franjasDelDia("2026-11-20");

    assert.equal(franjas.length, 10);
    assert.deepEqual(franjas[0], { inicio: "2026-11-20T08:00", fin: "2026-11-20T09:30" });
    assert.deepEqual(franjas[9], { inicio: "2026-11-20T21:30", fin: "2026-11-20T23:00" });
    assert.equal(finDeFranja("2026-11-20T12:30"), "2026-11-20T14:00");
  });

  it("reconoce el inicio de una franja", () => {
    assert.ok(esInicioDeFranja("2026-11-20T09:30"));
    assert.ok(esInicioDeFranja("2026-11-20T21:30"));
    assert.ok(!esInicioDeFranja("2026-11-20T10:00"));
    assert.ok(!esInicioDeFranja("2026-11-20T23:00"));
  });

  it("una franja ha empezado desde el minuto de su inicio", () => {
    assert.ok(!haEmpezado("2026-11-20T18:30", "2026-11-20T18:29"));
    assert.ok(haEmpezado("2026-11-20T18:30", "2026-11-20T18:30"));
    assert.ok(haEmpezado("2026-11-20T18:30", "2026-11-20T19:00"));
  });
});
