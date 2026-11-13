import { ErrorDominio } from "./errores.ts";
import { haEmpezado } from "./tiempo.ts";
import type { EstadoFranja, FechaHora, Pista, Reserva, Socio } from "./tipos.ts";

export const MAXIMO_RESERVAS_FUTURAS = 2;

const MOTIVO_NO_DISPONIBLE: Record<Exclude<EstadoFranja, "libre">, string> = {
  reservada: "La franja ya está reservada",
  cerrada: "La pista está cerrada",
};

export function ocupaLaFranja(reserva: Reserva): boolean {
  return reserva.estado === "confirmada";
}

export function estadoDeFranja(
  pista: Pista,
  inicio: FechaHora,
  reservasDeLaPista: Reserva[],
): EstadoFranja {
  if (pista.estado === "cerrada") return "cerrada";
  const reservada = reservasDeLaPista.some(
    (reserva) => reserva.inicio === inicio && ocupaLaFranja(reserva),
  );
  return reservada ? "reservada" : "libre";
}

export function reservasFuturas(reservas: Reserva[], ahora: FechaHora): Reserva[] {
  return reservas.filter((reserva) => ocupaLaFranja(reserva) && !haEmpezado(reserva.inicio, ahora));
}

export interface SolicitudDeReserva {
  socio: Socio;
  pista: Pista;
  inicio: FechaHora;
  ahora: FechaHora;
  reservasDeLaPista: Reserva[];
  reservasDelSocio: Reserva[];
}

export function comprobarQuePuedeReservar(solicitud: SolicitudDeReserva): void {
  const { socio, pista, inicio, ahora } = solicitud;
  if (!socio.cuotaActiva) {
    throw new ErrorDominio("CUOTA_INACTIVA", "Tu cuota no está activa: no puedes reservar", 409);
  }
  if (haEmpezado(inicio, ahora)) {
    throw new ErrorDominio("FRANJA_PASADA", "La franja ya ha empezado", 409);
  }
  const estado = estadoDeFranja(pista, inicio, solicitud.reservasDeLaPista);
  if (estado !== "libre") {
    throw new ErrorDominio("FRANJA_NO_DISPONIBLE", MOTIVO_NO_DISPONIBLE[estado], 409);
  }
  if (reservasFuturas(solicitud.reservasDelSocio, ahora).length >= MAXIMO_RESERVAS_FUTURAS) {
    throw new ErrorDominio(
      "LIMITE_DE_RESERVAS",
      `Ya tienes ${MAXIMO_RESERVAS_FUTURAS} reservas confirmadas pendientes de jugar`,
      409,
    );
  }
}
