import type { Notificacion, Notificaciones, Reloj } from "../dominio/puertos.ts";
import type { FechaHora } from "../dominio/tipos.ts";

export interface NotificacionEnviada extends Notificacion {
  enviadaEn: FechaHora;
}

export interface BandejaDeNotificaciones extends Notificaciones {
  listar(): NotificacionEnviada[];
}

export function crearBandejaDeNotificaciones(reloj: Reloj): BandejaDeNotificaciones {
  const enviadas: NotificacionEnviada[] = [];

  return {
    enviar(notificacion) {
      enviadas.push({ ...notificacion, enviadaEn: reloj.ahora() });
    },
    listar: () => enviadas.map((notificacion) => ({ ...notificacion })),
  };
}
