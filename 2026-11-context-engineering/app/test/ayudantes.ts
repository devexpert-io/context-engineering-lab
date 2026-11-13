import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { type App, crearApp } from "../src/app.ts";
import type { FechaHora } from "../src/dominio/tipos.ts";
import { CABECERA_SOCIO } from "../src/http/autenticacion.ts";
import type { DatosIniciales } from "../src/infra/repositorio.ts";
import { crearRelojFijo, type RelojFijo } from "../src/infra/reloj.ts";
import { AHORA_BASE, crearSemilla } from "../src/infra/semilla.ts";

export interface OpcionesDePrueba {
  ahora?: FechaHora;
  datos?: DatosIniciales;
}

export interface OpcionesDePeticion {
  socio?: string;
  cuerpo?: unknown;
  cuerpoEnTexto?: string;
  cabeceras?: Record<string, string>;
}

export interface RespuestaDePrueba {
  estado: number;
  // El JSON de la respuesta: cada test comprueba la forma que espera.
  cuerpo: any;
}

export interface AppDePrueba extends App {
  reloj: RelojFijo;
  url: string;
  pedir(metodo: string, ruta: string, opciones?: OpcionesDePeticion): Promise<RespuestaDePrueba>;
  get(ruta: string, socio?: string): Promise<RespuestaDePrueba>;
  post(ruta: string, socio: string | undefined, cuerpo: unknown): Promise<RespuestaDePrueba>;
  patch(ruta: string, socio: string | undefined, cuerpo: unknown): Promise<RespuestaDePrueba>;
  cerrar(): Promise<void>;
}

/**
 * Arranca la app en un puerto aleatorio con la semilla, el reloj fijo en AHORA_BASE (o en `ahora`)
 * e ids secuenciales por prefijo: "reserva-1", "reserva-2"… y "socio-1", "socio-2"…
 */
export async function arrancarApp(opciones: OpcionesDePrueba = {}): Promise<AppDePrueba> {
  const reloj = crearRelojFijo(opciones.ahora ?? AHORA_BASE);
  const contadores = new Map<string, number>();
  const app = crearApp({
    reloj,
    datos: opciones.datos ?? crearSemilla(),
    generarId: (prefijo) => {
      const siguiente = (contadores.get(prefijo) ?? 0) + 1;
      contadores.set(prefijo, siguiente);
      return `${prefijo}-${siguiente}`;
    },
  });

  const servidor = createServer(app.manejador);
  await new Promise<void>((resolver) => servidor.listen(0, "127.0.0.1", resolver));
  const { port } = servidor.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  async function pedir(
    metodo: string,
    ruta: string,
    { socio, cuerpo, cuerpoEnTexto, cabeceras = {} }: OpcionesDePeticion = {},
  ): Promise<RespuestaDePrueba> {
    const texto = cuerpoEnTexto ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo));
    const respuesta = await fetch(`${url}${ruta}`, {
      method: metodo,
      headers: {
        ...(socio === undefined ? {} : { [CABECERA_SOCIO]: socio }),
        ...(texto === undefined ? {} : { "content-type": "application/json" }),
        ...cabeceras,
      },
      body: texto,
    });
    const recibido = await respuesta.text();
    return { estado: respuesta.status, cuerpo: recibido === "" ? undefined : JSON.parse(recibido) };
  }

  return {
    ...app,
    reloj,
    url,
    pedir,
    get: (ruta, socio) => pedir("GET", ruta, { socio }),
    post: (ruta, socio, cuerpo) => pedir("POST", ruta, { socio, cuerpo }),
    patch: (ruta, socio, cuerpo) => pedir("PATCH", ruta, { socio, cuerpo }),
    cerrar: () =>
      new Promise<void>((resolver, rechazar) => {
        servidor.closeAllConnections();
        servidor.close((error) => (error ? rechazar(error) : resolver()));
      }),
  };
}
