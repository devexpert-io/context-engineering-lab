import { finDeFranja, sumarDias, unirFechaYHora } from "../dominio/tiempo.ts";
import type { EstadoReserva, Fecha, FechaHora, Reserva, Socio } from "../dominio/tipos.ts";
import type { DatosIniciales } from "./repositorio.ts";

/** Lunes de ejemplo: las reservas de la semilla y el reloj de los tests parten de él. */
export const FECHA_BASE: Fecha = "2026-11-16";
export const AHORA_BASE: FechaHora = unirFechaYHora(FECHA_BASE, "10:00");

export function crearSemilla(): DatosIniciales {
  return {
    pistas: [
      { id: "pista-1", nombre: "Pista 1", estado: "operativa" },
      { id: "pista-2", nombre: "Pista 2", estado: "operativa" },
      { id: "pista-3", nombre: "Pista 3", estado: "operativa" },
      { id: "pista-4", nombre: "Pista 4", estado: "cerrada" },
    ],
    socios: [
      socio("socio-ana", "Ana García", "ana.garcia@example.com"),
      socio("socio-marta", "Marta López", "marta.lopez@example.com"),
      socio("socio-pablo", "Pablo Ruiz", "pablo.ruiz@example.com"),
      socio("socio-irene", "Irene Sanz", "irene.sanz@example.com"),
      socio("socio-luis", "Luis Martín", "luis.martin@example.com", { cuotaActiva: false }),
      socio("gestor-carmen", "Carmen Díaz", "carmen.diaz@example.com", { rol: "gestor" }),
    ],
    reservas: [
      reserva("reserva-ana-1", "socio-ana", "pista-1", enElDia(1, "18:30")),
      reserva("reserva-ana-2", "socio-ana", "pista-2", enElDia(3, "20:00")),
      reserva("reserva-marta-1", "socio-marta", "pista-1", enElDia(2, "18:30")),
      reserva("reserva-marta-2", "socio-marta", "pista-2", enElDia(2, "20:00"), "cancelada"),
      reserva("reserva-pablo-1", "socio-pablo", "pista-1", enElDia(0, "09:30")),
      reserva("reserva-pablo-2", "socio-pablo", "pista-3", enElDia(-3, "20:00"), "no_presentada"),
    ],
  };
}

function enElDia(diasDesdeLaBase: number, hora: string): FechaHora {
  return unirFechaYHora(sumarDias(FECHA_BASE, diasDesdeLaBase), hora);
}

function socio(
  id: string,
  nombre: string,
  email: string,
  cambios: Partial<Pick<Socio, "cuotaActiva" | "rol">> = {},
): Socio {
  return {
    id,
    nombre,
    email,
    cuotaActiva: true,
    rol: "socio",
    altaEn: "2026-09-01T10:00",
    ...cambios,
  };
}

function reserva(
  id: string,
  socioId: string,
  pistaId: string,
  inicio: FechaHora,
  estado: EstadoReserva = "confirmada",
): Reserva {
  return {
    id,
    socioId,
    pistaId,
    inicio,
    fin: finDeFranja(inicio),
    estado,
    creadaEn: enElDia(-7, "12:00"),
  };
}
