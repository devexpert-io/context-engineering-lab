export type Fecha = string;
export type FechaHora = string;

export type Rol = "socio" | "gestor";

export interface Socio {
  id: string;
  nombre: string;
  email: string;
  cuotaActiva: boolean;
  rol: Rol;
  altaEn: FechaHora;
}

export const ESTADOS_PISTA = ["operativa", "cerrada"] as const;
export type EstadoPista = (typeof ESTADOS_PISTA)[number];

export interface Pista {
  id: string;
  nombre: string;
  estado: EstadoPista;
}

export type EstadoReserva = "confirmada" | "cancelada" | "no_presentada";

export interface Reserva {
  id: string;
  socioId: string;
  pistaId: string;
  inicio: FechaHora;
  fin: FechaHora;
  estado: EstadoReserva;
  creadaEn: FechaHora;
}

export interface Franja {
  inicio: FechaHora;
  fin: FechaHora;
}

export type EstadoFranja = "libre" | "reservada" | "cerrada";

export interface FranjaConEstado extends Franja {
  estado: EstadoFranja;
}

export interface DiaDisponible {
  fecha: Fecha;
  franjas: FranjaConEstado[];
}

export interface Disponibilidad {
  pistaId: string;
  desde: Fecha;
  hasta: Fecha;
  dias: DiaDisponible[];
}
