// API HTTP del club. Guarda el estado en memoria y es la única puerta que toca los datos:
// la CLI y el servidor MCP son clientes suyos.
//   PORT=4800 node src/servidor.ts          (PORT=0 elige un puerto libre y lo imprime)
//   ESCENARIO=inyeccion node src/servidor.ts (prueba 2: una reserva lleva una nota con instrucciones escondidas)
import { createServer, type IncomingMessage } from "node:http";
import { crearClub, ErrorDelClub, type FiltrosReservas } from "./nucleo.ts";
import { crearSemilla } from "./semilla.ts";

const estado = crearSemilla(process.env.ESCENARIO === "inyeccion" ? "inyeccion" : "normal");
const club = crearClub(estado);

async function leerCuerpo(req: IncomingMessage): Promise<Record<string, unknown>> {
  const trozos: Buffer[] = [];
  for await (const trozo of req) trozos.push(trozo as Buffer);
  const texto = Buffer.concat(trozos).toString("utf8").trim();
  if (!texto) return {};
  try {
    const datos: unknown = JSON.parse(texto);
    if (typeof datos !== "object" || datos === null || Array.isArray(datos)) throw new Error("no es un objeto");
    return datos as Record<string, unknown>;
  } catch {
    throw new ErrorDelClub("DATOS_INVALIDOS", "El cuerpo debe ser un objeto JSON", 400);
  }
}

function numero(valor: string | null): number | undefined {
  return valor === null ? undefined : Number(valor);
}

type Operacion = { nombre: string; argumentos: unknown; ejecutar: () => unknown };

async function resolver(req: IncomingMessage, url: URL): Promise<Operacion> {
  const metodo = req.method ?? "GET";
  const partes = url.pathname.split("/").filter(Boolean);
  const q = url.searchParams;
  if (partes[0] !== "api") throw new ErrorDelClub("RUTA_NO_ENCONTRADA", `No existe ${url.pathname}`, 404);
  const [, recurso, id, accion] = partes;

  if (recurso === "pistas" && !id && metodo === "GET") {
    return { nombre: "listarPistas", argumentos: {}, ejecutar: () => club.listarPistas() };
  }
  if (recurso === "pistas" && id && !accion && metodo === "PATCH") {
    const cuerpo = await leerCuerpo(req);
    return { nombre: "cambiarEstadoPista", argumentos: { pistaId: id, ...cuerpo }, ejecutar: () => club.cambiarEstadoPista(id, cuerpo.estado) };
  }
  if (recurso === "disponibilidad" && !id && metodo === "GET") {
    const argumentos = { fecha: q.get("fecha") ?? undefined, pistaId: q.get("pista") ?? undefined };
    return { nombre: "disponibilidad", argumentos, ejecutar: () => club.disponibilidad(argumentos.fecha, argumentos.pistaId) };
  }
  if (recurso === "socios" && !id && metodo === "GET") {
    const texto = q.get("texto") ?? undefined;
    return { nombre: "buscarSocios", argumentos: { texto }, ejecutar: () => club.buscarSocios(texto) };
  }
  if (recurso === "reservas" && !id && metodo === "GET") {
    const filtros: FiltrosReservas = {
      fecha: q.get("fecha") ?? undefined,
      desde: q.get("desde") ?? undefined,
      hasta: q.get("hasta") ?? undefined,
      socioId: q.get("socio") ?? undefined,
      pistaId: q.get("pista") ?? undefined,
      estado: q.get("estado") ?? undefined,
      limite: numero(q.get("limite")),
      pagina: numero(q.get("pagina")),
    };
    return { nombre: "listarReservas", argumentos: filtros, ejecutar: () => club.listarReservas(filtros) };
  }
  if (recurso === "reservas" && !id && metodo === "POST") {
    const cuerpo = await leerCuerpo(req);
    return { nombre: "crearReserva", argumentos: cuerpo, ejecutar: () => club.crearReserva(cuerpo) };
  }
  if (recurso === "reservas" && id && !accion && metodo === "GET") {
    return { nombre: "obtenerReserva", argumentos: { reservaId: id }, ejecutar: () => club.obtenerReserva(id) };
  }
  if (recurso === "reservas" && id && accion === "cancelar" && metodo === "POST") {
    const cuerpo = await leerCuerpo(req);
    return { nombre: "cancelarReserva", argumentos: { reservaId: id, ...cuerpo }, ejecutar: () => club.cancelarReserva(id, cuerpo) };
  }
  throw new ErrorDelClub("RUTA_NO_ENCONTRADA", `No existe ${metodo} ${url.pathname}`, 404);
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://club.local");
  const responder = (http: number, datos: unknown) => {
    res.writeHead(http, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(datos));
  };
  // Solo para el corrector del laboratorio: el estado completo y el registro de llamadas.
  if (url.pathname === "/_estado") return responder(200, estado);

  let operacion: Operacion | undefined;
  const anotar = (ok: boolean, codigo?: string) => {
    estado.registro.push({
      n: estado.registro.length + 1,
      operacion: operacion?.nombre ?? `${req.method} ${url.pathname}`,
      argumentos: operacion?.argumentos ?? {},
      ok,
      ...(codigo ? { codigo } : {}),
    });
  };
  try {
    operacion = await resolver(req, url);
    const resultado = operacion.ejecutar();
    anotar(true);
    responder(operacion.nombre === "crearReserva" ? 201 : 200, resultado);
  } catch (error) {
    if (error instanceof ErrorDelClub) {
      anotar(false, error.codigo);
      responder(error.http, { error: { codigo: error.codigo, mensaje: error.message } });
    } else {
      anotar(false, "ERROR_INTERNO");
      console.error(error);
      responder(500, { error: { codigo: "ERROR_INTERNO", mensaje: "Error inesperado" } });
    }
  }
});

servidor.listen(Number(process.env.PORT ?? 0), "127.0.0.1", () => {
  const direccion = servidor.address();
  if (direccion && typeof direccion === "object") console.log(`PUERTO=${direccion.port}`);
});

for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, () => servidor.close(() => process.exit(0)));
}
