import type { Fecha, FechaHora, Franja } from "./tipos.ts";

export const MINUTOS_POR_DIA = 24 * 60;
export const DURACION_FRANJA_MINUTOS = 90;
export const HORARIO = { apertura: "08:00", cierre: "23:00" } as const;
export const HORAS_DE_INICIO: readonly string[] = calcularHorasDeInicio();

const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const PATRON_FECHA_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function esFecha(valor: unknown): valor is Fecha {
  if (typeof valor !== "string") return false;
  const partes = PATRON_FECHA.exec(valor);
  if (partes === null) return false;
  const [anio, mes, dia] = partes.slice(1).map(Number);
  return existeElDia(anio, mes, dia);
}

export function esFechaHora(valor: unknown): valor is FechaHora {
  if (typeof valor !== "string") return false;
  const partes = PATRON_FECHA_HORA.exec(valor);
  if (partes === null) return false;
  const [anio, mes, dia, hora, minuto] = partes.slice(1).map(Number);
  return existeElDia(anio, mes, dia) && hora < 24 && minuto < 60;
}

export function fechaDe(fechaHora: FechaHora): Fecha {
  return fechaHora.slice(0, 10);
}

export function horaDe(fechaHora: FechaHora): string {
  return fechaHora.slice(11, 16);
}

export function unirFechaYHora(fecha: Fecha, hora: string): FechaHora {
  return `${fecha}T${hora}`;
}

export function inicioDelDia(fecha: Fecha): FechaHora {
  return unirFechaYHora(fecha, "00:00");
}

export function sumarMinutos(fechaHora: FechaHora, minutos: number): FechaHora {
  return desdeMinutos(aMinutos(fechaHora) + minutos);
}

export function sumarHoras(fechaHora: FechaHora, horas: number): FechaHora {
  return sumarMinutos(fechaHora, horas * 60);
}

export function sumarDias(fecha: Fecha, dias: number): Fecha {
  return desdeNumeroDeDia(aNumeroDeDia(fecha) + dias);
}

export function minutosEntre(desde: FechaHora, hasta: FechaHora): number {
  return aMinutos(hasta) - aMinutos(desde);
}

export function compararFechaHora(a: FechaHora, b: FechaHora): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function esAnterior(a: FechaHora, b: FechaHora): boolean {
  return compararFechaHora(a, b) < 0;
}

/** 1 = lunes … 7 = domingo. */
export function diaDeLaSemana(fecha: Fecha): number {
  const diasDesdeUnLunes = aNumeroDeDia(fecha) + 3;
  return (((diasDesdeUnLunes % 7) + 7) % 7) + 1;
}

export function esInicioDeFranja(fechaHora: FechaHora): boolean {
  return esFechaHora(fechaHora) && HORAS_DE_INICIO.includes(horaDe(fechaHora));
}

export function finDeFranja(inicio: FechaHora): FechaHora {
  return sumarMinutos(inicio, DURACION_FRANJA_MINUTOS);
}

export function franjasDelDia(fecha: Fecha): Franja[] {
  return HORAS_DE_INICIO.map((hora) => {
    const inicio = unirFechaYHora(fecha, hora);
    return { inicio, fin: finDeFranja(inicio) };
  });
}

export function haEmpezado(inicio: FechaHora, ahora: FechaHora): boolean {
  return !esAnterior(ahora, inicio);
}

function calcularHorasDeInicio(): string[] {
  const horas: string[] = [];
  const cierre = minutosDelDia(HORARIO.cierre);
  let inicio = minutosDelDia(HORARIO.apertura);
  while (inicio + DURACION_FRANJA_MINUTOS <= cierre) {
    horas.push(aHora(inicio));
    inicio += DURACION_FRANJA_MINUTOS;
  }
  return horas;
}

function existeElDia(anio: number, mes: number, dia: number): boolean {
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasDelMes(anio, mes);
}

function diasDelMes(anio: number, mes: number): number {
  if (mes === 2) return esBisiesto(anio) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function minutosDelDia(hora: string): number {
  const [horas, minutos] = hora.split(":").map(Number);
  return horas * 60 + minutos;
}

function aHora(minutosDelDia: number): string {
  return `${dosCifras(Math.floor(minutosDelDia / 60))}:${dosCifras(minutosDelDia % 60)}`;
}

function aMinutos(fechaHora: FechaHora): number {
  const dia = aNumeroDeDia(fechaDe(fechaHora));
  return dia * MINUTOS_POR_DIA + minutosDelDia(horaDe(fechaHora));
}

function desdeMinutos(minutos: number): FechaHora {
  const dia = Math.floor(minutos / MINUTOS_POR_DIA);
  return unirFechaYHora(desdeNumeroDeDia(dia), aHora(minutos - dia * MINUTOS_POR_DIA));
}

// Días desde 1970-01-01 con aritmética de calendario pura
// (algoritmos days_from_civil y civil_from_days de Howard Hinnant).
function aNumeroDeDia(fecha: Fecha): number {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const anioDesdeMarzo = mes <= 2 ? anio - 1 : anio;
  const era = Math.floor(anioDesdeMarzo / 400);
  const anioDeEra = anioDesdeMarzo - era * 400;
  const diaDelAnio = Math.floor((153 * (mes > 2 ? mes - 3 : mes + 9) + 2) / 5) + dia - 1;
  const diaDeEra =
    anioDeEra * 365 + Math.floor(anioDeEra / 4) - Math.floor(anioDeEra / 100) + diaDelAnio;
  return era * 146097 + diaDeEra - 719468;
}

function desdeNumeroDeDia(numero: number): Fecha {
  const desdeLaEraCero = numero + 719468;
  const era = Math.floor(desdeLaEraCero / 146097);
  const diaDeEra = desdeLaEraCero - era * 146097;
  const anioDeEra = Math.floor(
    (diaDeEra -
      Math.floor(diaDeEra / 1460) +
      Math.floor(diaDeEra / 36524) -
      Math.floor(diaDeEra / 146096)) /
      365,
  );
  const diaDelAnio =
    diaDeEra - (365 * anioDeEra + Math.floor(anioDeEra / 4) - Math.floor(anioDeEra / 100));
  const mesDesdeMarzo = Math.floor((5 * diaDelAnio + 2) / 153);
  const dia = diaDelAnio - Math.floor((153 * mesDesdeMarzo + 2) / 5) + 1;
  const mes = mesDesdeMarzo < 10 ? mesDesdeMarzo + 3 : mesDesdeMarzo - 9;
  const anio = anioDeEra + era * 400 + (mes <= 2 ? 1 : 0);
  return `${String(anio).padStart(4, "0")}-${dosCifras(mes)}-${dosCifras(dia)}`;
}

function dosCifras(numero: number): string {
  return String(numero).padStart(2, "0");
}
