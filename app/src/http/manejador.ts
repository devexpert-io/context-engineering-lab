import type { IncomingMessage, ServerResponse } from "node:http";
import { datosInvalidos, ErrorDominio } from "../dominio/errores.ts";
import type { Servicios } from "../servicios/servicios.ts";
import { identificarSocio } from "./autenticacion.ts";
import { enviar, respuestaDeError } from "./respuestas.ts";
import { crearRouter } from "./router.ts";
import { crearRutas } from "./rutas.ts";

export const LIMITE_DEL_CUERPO_EN_BYTES = 64 * 1024;

export type Manejador = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export function crearManejador(servicios: Servicios): Manejador {
  const resolver = crearRouter(crearRutas(servicios));

  return async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const { ruta, parametros } = resolver(req.method ?? "GET", url.pathname);
      const socio = identificarSocio(req.headers, servicios.socios);
      const cuerpo = await leerCuerpo(req);
      enviar(res, await ruta.manejar({ socio, parametros, consulta: url.searchParams, cuerpo }));
    } catch (error) {
      enviar(res, respuestaDeError(error));
    }
  };
}

async function leerCuerpo(req: IncomingMessage): Promise<unknown> {
  const trozos: Buffer[] = [];
  let bytes = 0;
  for await (const trozo of req) {
    bytes += trozo.length;
    if (bytes > LIMITE_DEL_CUERPO_EN_BYTES) {
      throw new ErrorDominio(
        "CUERPO_DEMASIADO_GRANDE",
        "El cuerpo de la petición supera los 64 KB",
        413,
      );
    }
    trozos.push(trozo);
  }

  const texto = Buffer.concat(trozos).toString("utf8");
  if (texto.trim() === "") return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    throw datosInvalidos({ cuerpo: "No es un JSON válido" });
  }
}
