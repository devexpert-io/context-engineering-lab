import type { IncomingHttpHeaders } from "node:http";
import { ErrorDominio } from "../dominio/errores.ts";
import type { Socio } from "../dominio/tipos.ts";

export const CABECERA_SOCIO = "x-socio-id";

export function identificarSocio(
  cabeceras: IncomingHttpHeaders,
  socios: { buscar(socioId: string): Socio | undefined },
): Socio {
  const valor = cabeceras[CABECERA_SOCIO];
  const socioId = typeof valor === "string" ? valor.trim() : "";
  if (socioId === "") {
    throw new ErrorDominio("NO_AUTENTICADO", `Falta la cabecera ${CABECERA_SOCIO}`, 401);
  }

  const socio = socios.buscar(socioId);
  if (!socio) {
    throw new ErrorDominio("NO_AUTENTICADO", `No hay ningún socio con el id ${socioId}`, 401);
  }
  return socio;
}

export function exigirGestor(socio: Socio): Socio {
  if (socio.rol !== "gestor") {
    throw new ErrorDominio("SOLO_GESTOR", "Solo el gestor puede hacer esta operación", 403);
  }
  return socio;
}
