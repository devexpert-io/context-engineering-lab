import { ErrorDominio } from "../dominio/errores.ts";
import type { Socio } from "../dominio/tipos.ts";

export type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Peticion {
  socio: Socio;
  parametros: Record<string, string>;
  consulta: URLSearchParams;
  cuerpo: unknown;
}

export interface Respuesta {
  estado: number;
  cuerpo: unknown;
}

export interface Ruta {
  metodo: Metodo;
  patron: string;
  manejar(peticion: Peticion): Respuesta | Promise<Respuesta>;
}

export interface RutaResuelta {
  ruta: Ruta;
  parametros: Record<string, string>;
}

export function crearRouter(rutas: Ruta[]): (metodo: string, camino: string) => RutaResuelta {
  const compiladas = rutas.map((ruta) => ({ ruta, partes: trocear(ruta.patron) }));

  return (metodo, camino) => {
    const partes = trocear(camino);
    let existeConOtroMetodo = false;

    for (const compilada of compiladas) {
      const parametros = encajar(compilada.partes, partes);
      if (parametros === undefined) continue;
      if (compilada.ruta.metodo === metodo) return { ruta: compilada.ruta, parametros };
      existeConOtroMetodo = true;
    }

    if (existeConOtroMetodo) {
      throw new ErrorDominio(
        "METODO_NO_PERMITIDO",
        `El método ${metodo} no está permitido en ${camino}`,
        405,
      );
    }
    throw new ErrorDominio("RUTA_NO_ENCONTRADA", `No existe la ruta ${metodo} ${camino}`, 404);
  };
}

function trocear(camino: string): string[] {
  return camino.split("/").filter((parte) => parte !== "");
}

function encajar(patron: string[], partes: string[]): Record<string, string> | undefined {
  if (patron.length !== partes.length) return undefined;
  const parametros: Record<string, string> = {};
  for (const [indice, esperada] of patron.entries()) {
    const parte = partes[indice];
    if (esperada.startsWith(":")) parametros[esperada.slice(1)] = decodificar(parte);
    else if (esperada !== parte) return undefined;
  }
  return parametros;
}

function decodificar(parte: string): string {
  try {
    return decodeURIComponent(parte);
  } catch {
    return parte;
  }
}
