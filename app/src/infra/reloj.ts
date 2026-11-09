import type { Reloj } from "../dominio/puertos.ts";
import type { FechaHora } from "../dominio/tipos.ts";

export const ZONA_HORARIA_DEL_CLUB = "Europe/Madrid";

export interface RelojFijo extends Reloj {
  fijar(fechaHora: FechaHora): void;
}

export function crearRelojDelSistema(zonaHoraria: string = ZONA_HORARIA_DEL_CLUB): Reloj {
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return {
    ahora() {
      const partes = Object.fromEntries(
        formato.formatToParts(new Date()).map(({ type, value }) => [type, value]),
      );
      return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
    },
  };
}

export function crearRelojFijo(inicial: FechaHora): RelojFijo {
  let actual = inicial;

  return {
    ahora: () => actual,
    fijar(fechaHora) {
      actual = fechaHora;
    },
  };
}
