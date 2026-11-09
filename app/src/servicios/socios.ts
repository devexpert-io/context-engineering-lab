import { ErrorDominio } from "../dominio/errores.ts";
import type { Dependencias } from "../dominio/puertos.ts";
import type { Socio } from "../dominio/tipos.ts";
import { booleano, email, opcional, texto, validar } from "../dominio/validacion.ts";

export function crearServicioSocios({
  repositorio,
  reloj,
  generarId,
  auditoria,
  notificaciones,
}: Dependencias) {
  return {
    buscar(socioId: string): Socio | undefined {
      return repositorio.socios.buscar(socioId);
    },

    darDeAlta(gestor: Socio, entrada: unknown): Socio {
      const datos = validar(entrada, {
        nombre: texto({ min: 2, max: 80 }),
        email,
        cuotaActiva: opcional(booleano, true),
      });
      if (repositorio.socios.buscarPorEmail(datos.email)) {
        throw new ErrorDominio(
          "EMAIL_YA_REGISTRADO",
          `Ya hay un socio con el email ${datos.email}`,
          409,
        );
      }

      const socio: Socio = {
        id: generarId("socio"),
        ...datos,
        rol: "socio",
        altaEn: reloj.ahora(),
      };
      repositorio.socios.guardar(socio);
      auditoria.registrar({
        accion: "alta_socio",
        actorId: gestor.id,
        datos: { socioId: socio.id },
      });
      notificaciones.enviar({
        socioId: socio.id,
        plantilla: "bienvenida",
        datos: { nombre: socio.nombre },
      });
      return socio;
    },
  };
}

export type ServicioSocios = ReturnType<typeof crearServicioSocios>;
