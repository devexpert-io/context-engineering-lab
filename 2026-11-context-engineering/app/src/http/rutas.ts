import type { Servicios } from "../servicios/servicios.ts";
import { exigirGestor } from "./autenticacion.ts";
import { creado, ok } from "./respuestas.ts";
import type { Ruta } from "./router.ts";

export function crearRutas(servicios: Servicios): Ruta[] {
  return [
    {
      metodo: "GET",
      patron: "/api/socios/yo",
      manejar: ({ socio }) => ok({ socio }),
    },
    {
      metodo: "GET",
      patron: "/api/pistas",
      manejar: () => ok({ pistas: servicios.pistas.listar() }),
    },
    {
      metodo: "GET",
      patron: "/api/pistas/:pistaId",
      manejar: ({ parametros }) => ok({ pista: servicios.pistas.obtener(parametros.pistaId) }),
    },
    {
      metodo: "GET",
      patron: "/api/pistas/:pistaId/disponibilidad",
      manejar: ({ parametros, consulta }) => {
        const semana = consulta.get("semana") ?? undefined;
        const disponibilidad = servicios.disponibilidad.deLaSemana(parametros.pistaId, semana);
        return ok({ disponibilidad });
      },
    },
    {
      metodo: "POST",
      patron: "/api/reservas",
      manejar: ({ socio, cuerpo }) =>
        creado({ reserva: servicios.reservas.reservar(socio, cuerpo) }),
    },
    {
      metodo: "GET",
      patron: "/api/reservas/mias",
      manejar: ({ socio }) => ok({ reservas: servicios.reservas.deSocio(socio.id) }),
    },
    {
      metodo: "POST",
      patron: "/api/gestion/socios",
      manejar: ({ socio, cuerpo }) => {
        const gestor = exigirGestor(socio);
        return creado({ socio: servicios.socios.darDeAlta(gestor, cuerpo) });
      },
    },
    {
      metodo: "PATCH",
      patron: "/api/gestion/pistas/:pistaId",
      manejar: ({ socio, parametros, cuerpo }) => {
        const gestor = exigirGestor(socio);
        return ok({ pista: servicios.pistas.cambiarEstado(gestor, parametros.pistaId, cuerpo) });
      },
    },
  ];
}
