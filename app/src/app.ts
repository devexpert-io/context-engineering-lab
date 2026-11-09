import { randomUUID } from "node:crypto";
import type { GenerarId, Reloj } from "./dominio/puertos.ts";
import { crearManejador } from "./http/manejador.ts";
import { crearAuditoriaEnMemoria } from "./infra/auditoria.ts";
import { crearBandejaDeNotificaciones } from "./infra/notificaciones.ts";
import { crearRepositorioEnMemoria, type DatosIniciales } from "./infra/repositorio.ts";
import { crearSemilla } from "./infra/semilla.ts";
import { crearServicios } from "./servicios/servicios.ts";

export interface OpcionesApp {
  reloj: Reloj;
  datos?: DatosIniciales;
  generarId?: GenerarId;
}

export function crearApp({
  reloj,
  datos = crearSemilla(),
  generarId = generarIdAleatorio,
}: OpcionesApp) {
  const auditoria = crearAuditoriaEnMemoria(reloj);
  const notificaciones = crearBandejaDeNotificaciones(reloj);
  const repositorio = crearRepositorioEnMemoria(datos);
  const servicios = crearServicios({ repositorio, reloj, auditoria, notificaciones, generarId });

  return { manejador: crearManejador(servicios), servicios, auditoria, notificaciones };
}

export type App = ReturnType<typeof crearApp>;

function generarIdAleatorio(prefijo: string): string {
  return `${prefijo}-${randomUUID()}`;
}
