import type { Auditoria, EntradaAuditoria, Reloj } from "../dominio/puertos.ts";
import type { FechaHora } from "../dominio/tipos.ts";

export interface RegistroDeAuditoria extends EntradaAuditoria {
  fecha: FechaHora;
}

export interface AuditoriaEnMemoria extends Auditoria {
  listar(): RegistroDeAuditoria[];
}

export function crearAuditoriaEnMemoria(reloj: Reloj): AuditoriaEnMemoria {
  const registros: RegistroDeAuditoria[] = [];

  return {
    registrar(entrada) {
      registros.push({ ...entrada, fecha: reloj.ahora() });
    },
    listar: () => registros.map((registro) => ({ ...registro })),
  };
}
