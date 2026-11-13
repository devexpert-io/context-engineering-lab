import { pistaNoEncontrada } from "../dominio/errores.ts";
import type { Coleccion, Dependencias } from "../dominio/puertos.ts";
import { ESTADOS_PISTA, type Pista, type Socio } from "../dominio/tipos.ts";
import { unoDe, validar } from "../dominio/validacion.ts";

export function obtenerPista(pistas: Coleccion<Pista>, pistaId: string): Pista {
  const pista = pistas.buscar(pistaId);
  if (!pista) throw pistaNoEncontrada(pistaId);
  return pista;
}

export function crearServicioPistas({
  repositorio,
  auditoria,
}: Pick<Dependencias, "repositorio" | "auditoria">) {
  return {
    listar(): Pista[] {
      return repositorio.pistas.listar();
    },

    obtener(pistaId: string): Pista {
      return obtenerPista(repositorio.pistas, pistaId);
    },

    cambiarEstado(gestor: Socio, pistaId: string, entrada: unknown): Pista {
      const pista = obtenerPista(repositorio.pistas, pistaId);
      const { estado } = validar(entrada, { estado: unoDe(ESTADOS_PISTA) });
      const actualizada: Pista = { ...pista, estado };
      repositorio.pistas.guardar(actualizada);
      auditoria.registrar({
        accion: "cambiar_estado_pista",
        actorId: gestor.id,
        datos: { pistaId, anterior: pista.estado, nuevo: estado },
      });
      return actualizada;
    },
  };
}

export type ServicioPistas = ReturnType<typeof crearServicioPistas>;
