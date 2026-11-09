import type { Dependencias } from "../dominio/puertos.ts";
import { estadoDeFranja } from "../dominio/reglas.ts";
import { diasDeLaSemana } from "../dominio/semana.ts";
import { fechaDe, franjasDelDia, inicioDelDia, sumarDias } from "../dominio/tiempo.ts";
import type { Disponibilidad } from "../dominio/tipos.ts";
import { fecha, opcional, validar } from "../dominio/validacion.ts";
import { obtenerPista } from "./pistas.ts";

export function crearServicioDisponibilidad({
  repositorio,
  reloj,
}: Pick<Dependencias, "repositorio" | "reloj">) {
  return {
    deLaSemana(pistaId: string, semana: string | undefined): Disponibilidad {
      const pista = obtenerPista(repositorio.pistas, pistaId);
      const hoy = fechaDe(reloj.ahora());
      const { semana: dia } = validar({ semana }, { semana: opcional(fecha, hoy) });

      const dias = diasDeLaSemana(dia);
      const desde = dias[0];
      const hasta = dias[dias.length - 1];
      const reservas = repositorio.reservas.dePistaEntre(
        pistaId,
        inicioDelDia(desde),
        inicioDelDia(sumarDias(hasta, 1)),
      );

      return {
        pistaId,
        desde,
        hasta,
        dias: dias.map((fechaDelDia) => ({
          fecha: fechaDelDia,
          franjas: franjasDelDia(fechaDelDia).map((franja) => ({
            ...franja,
            estado: estadoDeFranja(pista, franja.inicio, reservas),
          })),
        })),
      };
    },
  };
}

export type ServicioDisponibilidad = ReturnType<typeof crearServicioDisponibilidad>;
