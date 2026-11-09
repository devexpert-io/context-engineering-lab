import { diaDeLaSemana, sumarDias } from "./tiempo.ts";
import type { Fecha } from "./tipos.ts";

export const DIAS_POR_SEMANA = 7;

export function lunesDeLaSemana(fecha: Fecha): Fecha {
  return sumarDias(fecha, 1 - diaDeLaSemana(fecha));
}

export function diasDeLaSemana(fecha: Fecha): Fecha[] {
  const lunes = lunesDeLaSemana(fecha);
  const dias: Fecha[] = [];
  for (let desplazamiento = 0; desplazamiento < DIAS_POR_SEMANA; desplazamiento++) {
    dias.push(sumarDias(lunes, desplazamiento));
  }
  return dias;
}
