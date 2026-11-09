import type { Dependencias } from "../dominio/puertos.ts";
import { crearServicioDisponibilidad } from "./disponibilidad.ts";
import { crearServicioPistas } from "./pistas.ts";
import { crearServicioReservas } from "./reservas.ts";
import { crearServicioSocios } from "./socios.ts";

export function crearServicios(dependencias: Dependencias) {
  return {
    socios: crearServicioSocios(dependencias),
    pistas: crearServicioPistas(dependencias),
    disponibilidad: crearServicioDisponibilidad(dependencias),
    reservas: crearServicioReservas(dependencias),
  };
}

export type Servicios = ReturnType<typeof crearServicios>;
