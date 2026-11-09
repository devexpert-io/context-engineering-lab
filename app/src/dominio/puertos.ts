import type { FechaHora, Pista, Reserva, Socio } from "./tipos.ts";

export interface Reloj {
  ahora(): FechaHora;
}

export interface Coleccion<T> {
  buscar(id: string): T | undefined;
  listar(): T[];
  guardar(entidad: T): void;
}

export interface RepositorioSocios extends Coleccion<Socio> {
  buscarPorEmail(email: string): Socio | undefined;
}

export interface RepositorioReservas extends Coleccion<Reserva> {
  deSocio(socioId: string): Reserva[];
  /** Reservas de la pista, en cualquier estado, que se solapan con el intervalo [desde, hasta). */
  dePistaEntre(pistaId: string, desde: FechaHora, hasta: FechaHora): Reserva[];
}

export interface Repositorio {
  socios: RepositorioSocios;
  pistas: Coleccion<Pista>;
  reservas: RepositorioReservas;
}

export interface EntradaAuditoria {
  accion: string;
  actorId: string;
  datos: Record<string, unknown>;
}

export interface Auditoria {
  registrar(entrada: EntradaAuditoria): void;
}

export interface Notificacion {
  socioId: string;
  plantilla: string;
  datos: Record<string, unknown>;
}

export interface Notificaciones {
  enviar(notificacion: Notificacion): void;
}

export type GenerarId = (prefijo: string) => string;

export interface Dependencias {
  repositorio: Repositorio;
  reloj: Reloj;
  auditoria: Auditoria;
  notificaciones: Notificaciones;
  generarId: GenerarId;
}
