import type { Coleccion, Repositorio } from "../dominio/puertos.ts";
import { compararFechaHora, esAnterior } from "../dominio/tiempo.ts";
import type { Pista, Reserva, Socio } from "../dominio/tipos.ts";

export interface DatosIniciales {
  socios: Socio[];
  pistas: Pista[];
  reservas: Reserva[];
}

export function crearRepositorioEnMemoria(datos: DatosIniciales): Repositorio {
  const socios = crearColeccion(datos.socios);
  const reservas = crearColeccion(datos.reservas);

  return {
    socios: {
      ...socios,
      buscarPorEmail: (email) => socios.listar().find((socio) => socio.email === email),
    },
    pistas: crearColeccion(datos.pistas),
    reservas: {
      ...reservas,
      deSocio: (socioId) =>
        porInicio(reservas.listar().filter((reserva) => reserva.socioId === socioId)),
      dePistaEntre: (pistaId, desde, hasta) =>
        porInicio(
          reservas
            .listar()
            .filter(
              (reserva) =>
                reserva.pistaId === pistaId &&
                esAnterior(reserva.inicio, hasta) &&
                esAnterior(desde, reserva.fin),
            ),
        ),
    },
  };
}

function crearColeccion<T extends { id: string }>(iniciales: T[]): Coleccion<T> {
  const entidades = new Map<string, T>(iniciales.map((entidad) => [entidad.id, { ...entidad }]));

  return {
    buscar(id) {
      const entidad = entidades.get(id);
      return entidad && { ...entidad };
    },
    listar: () => [...entidades.values()].map((entidad) => ({ ...entidad })),
    guardar(entidad) {
      entidades.set(entidad.id, { ...entidad });
    },
  };
}

function porInicio(reservas: Reserva[]): Reserva[] {
  return reservas.sort((a, b) => compararFechaHora(a.inicio, b.inicio));
}
