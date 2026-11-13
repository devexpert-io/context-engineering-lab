import type { Dependencias } from "../dominio/puertos.ts";
import { comprobarQuePuedeReservar } from "../dominio/reglas.ts";
import { finDeFranja } from "../dominio/tiempo.ts";
import type { Reserva, Socio } from "../dominio/tipos.ts";
import { inicioDeFranja, texto, validar } from "../dominio/validacion.ts";
import { obtenerPista } from "./pistas.ts";

export function crearServicioReservas({
  repositorio,
  reloj,
  generarId,
}: Pick<Dependencias, "repositorio" | "reloj" | "generarId">) {
  return {
    reservar(socio: Socio, entrada: unknown): Reserva {
      const { pistaId, inicio } = validar(entrada, {
        pistaId: texto({ max: 64 }),
        inicio: inicioDeFranja,
      });
      const pista = obtenerPista(repositorio.pistas, pistaId);
      const ahora = reloj.ahora();
      const fin = finDeFranja(inicio);

      comprobarQuePuedeReservar({
        socio,
        pista,
        inicio,
        ahora,
        reservasDeLaPista: repositorio.reservas.dePistaEntre(pistaId, inicio, fin),
        reservasDelSocio: repositorio.reservas.deSocio(socio.id),
      });

      const reserva: Reserva = {
        id: generarId("reserva"),
        socioId: socio.id,
        pistaId,
        inicio,
        fin,
        estado: "confirmada",
        creadaEn: ahora,
      };
      repositorio.reservas.guardar(reserva);
      return reserva;
    },

    deSocio(socioId: string): Reserva[] {
      return repositorio.reservas.deSocio(socioId);
    },
  };
}

export type ServicioReservas = ReturnType<typeof crearServicioReservas>;
