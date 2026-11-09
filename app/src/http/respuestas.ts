import type { ServerResponse } from "node:http";
import { type CodigoError, type Detalles, ErrorDominio } from "../dominio/errores.ts";
import type { Respuesta } from "./router.ts";

export interface CuerpoDeError {
  error: { codigo: CodigoError; mensaje: string; detalles?: Detalles };
}

export function ok(cuerpo: unknown): Respuesta {
  return { estado: 200, cuerpo };
}

export function creado(cuerpo: unknown): Respuesta {
  return { estado: 201, cuerpo };
}

export function respuestaDeError(error: unknown): Respuesta {
  if (error instanceof ErrorDominio) {
    const cuerpo: CuerpoDeError = { error: { codigo: error.codigo, mensaje: error.message } };
    if (error.detalles !== undefined) cuerpo.error.detalles = error.detalles;
    return { estado: error.estado, cuerpo };
  }

  console.error(error);
  const cuerpo: CuerpoDeError = {
    error: { codigo: "ERROR_INTERNO", mensaje: "Error inesperado del servidor" },
  };
  return { estado: 500, cuerpo };
}

export function enviar(res: ServerResponse, { estado, cuerpo }: Respuesta): void {
  const json = JSON.stringify(cuerpo);
  res.writeHead(estado, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
  });
  res.end(json);
}
