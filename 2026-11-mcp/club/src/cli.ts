// CLI del club: `padel`. Cada comando llama a la API HTTP y escribe la respuesta en JSON.
//   CLUB_API=http://127.0.0.1:4800 node src/cli.ts reservas listar --fecha 2026-11-19
import { llamar, type Respuesta } from "./cliente.ts";
import { CAMPOS, TEXTOS } from "./textos.ts";

interface Comando {
  uso: string;
  descripcion: string;
  opciones?: Record<string, string>;
  ejecutar: (posicionales: string[], opciones: Record<string, string | boolean>) => Promise<Respuesta>;
}

class ErrorDeUso extends Error {}

function exigir(valor: string | boolean | undefined, nombre: string): string {
  if (typeof valor !== "string" || valor === "") throw new ErrorDeUso(`Falta ${nombre}`);
  return valor;
}

function entero(valor: string | boolean | undefined, nombre: string): number | undefined {
  if (valor === undefined) return undefined;
  const n = Number(valor);
  if (typeof valor !== "string" || !Number.isInteger(n)) throw new ErrorDeUso(`${nombre} debe ser un número entero`);
  return n;
}

const COMANDOS: Record<string, Comando> = {
  "pistas listar": {
    uso: "padel pistas listar",
    descripcion: TEXTOS.listarPistas,
    ejecutar: () => llamar("GET", "/api/pistas"),
  },
  "pistas estado": {
    uso: "padel pistas estado <pista> <estado>",
    descripcion: TEXTOS.cambiarEstadoPista,
    opciones: { "<pista>": CAMPOS.pista, "<estado>": CAMPOS.estadoPista },
    ejecutar: ([pista, estado]) =>
      llamar("PATCH", `/api/pistas/${encodeURIComponent(exigir(pista, "<pista>"))}`, { cuerpo: { estado: exigir(estado, "<estado>") } }),
  },
  disponibilidad: {
    uso: "padel disponibilidad --fecha <fecha> [--pista <pista>]",
    descripcion: TEXTOS.disponibilidad,
    opciones: { "--fecha": CAMPOS.fecha, "--pista": CAMPOS.pista },
    ejecutar: (_, o) => llamar("GET", "/api/disponibilidad", { consulta: { fecha: exigir(o.fecha, "--fecha"), pista: o.pista } }),
  },
  "socios buscar": {
    uso: "padel socios buscar <texto>",
    descripcion: TEXTOS.buscarSocios,
    opciones: { "<texto>": CAMPOS.texto },
    ejecutar: (posicionales) => llamar("GET", "/api/socios", { consulta: { texto: exigir(posicionales.join(" "), "<texto>") } }),
  },
  "reservas listar": {
    uso: "padel reservas listar [--fecha <fecha> | --desde <fecha> --hasta <fecha>] [--socio <socio>] [--pista <pista>] [--estado <estado>] [--limite <n>] [--pagina <n>]",
    descripcion: TEXTOS.listarReservas,
    opciones: {
      "--fecha": CAMPOS.fecha, "--desde": CAMPOS.desde, "--hasta": CAMPOS.hasta, "--socio": CAMPOS.socio,
      "--pista": CAMPOS.pista, "--estado": CAMPOS.estadoReserva, "--limite": CAMPOS.limite, "--pagina": CAMPOS.pagina,
    },
    ejecutar: (_, o) =>
      llamar("GET", "/api/reservas", {
        consulta: {
          fecha: o.fecha, desde: o.desde, hasta: o.hasta, socio: o.socio, pista: o.pista, estado: o.estado,
          limite: entero(o.limite, "--limite"), pagina: entero(o.pagina, "--pagina"),
        },
      }),
  },
  "reservas ver": {
    uso: "padel reservas ver <reserva>",
    descripcion: TEXTOS.obtenerReserva,
    opciones: { "<reserva>": CAMPOS.reserva },
    ejecutar: ([id]) => llamar("GET", `/api/reservas/${encodeURIComponent(exigir(id, "<reserva>"))}`),
  },
  "reservas crear": {
    uso: "padel reservas crear --socio <socio> --pista <pista> --inicio <inicio> [--notas <texto>]",
    descripcion: TEXTOS.crearReserva,
    opciones: { "--socio": CAMPOS.socio, "--pista": CAMPOS.pista, "--inicio": CAMPOS.inicio, "--notas": CAMPOS.notas },
    ejecutar: (_, o) =>
      llamar("POST", "/api/reservas", {
        cuerpo: { socioId: exigir(o.socio, "--socio"), pistaId: exigir(o.pista, "--pista"), inicio: exigir(o.inicio, "--inicio"), notas: o.notas },
      }),
  },
  "reservas cancelar": {
    uso: "padel reservas cancelar <reserva> [--forzar] [--motivo <texto>]",
    descripcion: TEXTOS.cancelarReserva,
    opciones: { "<reserva>": CAMPOS.reserva, "--forzar": CAMPOS.forzar, "--motivo": CAMPOS.motivo },
    ejecutar: ([id], o) =>
      llamar("POST", `/api/reservas/${encodeURIComponent(exigir(id, "<reserva>"))}/cancelar`, {
        cuerpo: { forzar: o.forzar === true ? true : undefined, motivo: o.motivo },
      }),
  },
};

function ayudaGeneral(): string {
  const lineas = ["padel: la CLI del club de pádel", "", TEXTOS.sistema, "", "Todos los comandos escriben JSON. Los errores salen por stderr con código de salida 1.", "", "Comandos:"];
  for (const comando of Object.values(COMANDOS)) lineas.push(`  ${comando.uso}`, `      ${comando.descripcion}`);
  lineas.push("", "padel <comando> --help muestra las opciones de un comando.");
  return lineas.join("\n");
}

function ayudaDe(comando: Comando): string {
  const lineas = [`Uso: ${comando.uso}`, "", comando.descripcion];
  if (comando.opciones) {
    lineas.push("", "Opciones:");
    for (const [nombre, texto] of Object.entries(comando.opciones)) lineas.push(`  ${nombre.padEnd(10)} ${texto}`);
  }
  return lineas.join("\n");
}

function separar(argumentos: string[]) {
  const posicionales: string[] = [];
  const opciones: Record<string, string | boolean> = {};
  for (let i = 0; i < argumentos.length; i++) {
    const argumento = argumentos[i]!;
    if (!argumento.startsWith("--")) {
      posicionales.push(argumento);
      continue;
    }
    const [nombre, pegado] = argumento.slice(2).split(/=(.*)/s, 2) as [string, string | undefined];
    const siguiente = argumentos[i + 1];
    if (pegado !== undefined) opciones[nombre] = pegado;
    else if (nombre === "forzar" || nombre === "help" || siguiente === undefined || siguiente.startsWith("--")) opciones[nombre] = true;
    else {
      opciones[nombre] = siguiente;
      i += 1;
    }
  }
  return { posicionales, opciones };
}

async function main(): Promise<number> {
  const { posicionales, opciones } = separar(process.argv.slice(2));
  const nombre = COMANDOS[posicionales.slice(0, 2).join(" ")] ? posicionales.slice(0, 2).join(" ") : (posicionales[0] ?? "");
  const comando = COMANDOS[nombre];
  if (!comando) {
    const propios = Object.values(COMANDOS).filter((c) => posicionales[0] && c.uso.startsWith(`padel ${posicionales[0]} `));
    if (opciones.help || posicionales.length === 0) {
      console.log(propios.length ? propios.map(ayudaDe).join("\n\n") : ayudaGeneral());
      return 0;
    }
    console.error(`No existe el comando "${posicionales.join(" ")}".\n\n${ayudaGeneral()}`);
    return 1;
  }
  if (opciones.help) {
    console.log(ayudaDe(comando));
    return 0;
  }
  try {
    const respuesta = await comando.ejecutar(posicionales.slice(nombre.split(" ").length), opciones);
    (respuesta.ok ? console.log : console.error)(JSON.stringify(respuesta.datos));
    return respuesta.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof ErrorDeUso) {
      console.error(`${error.message}\n\n${ayudaDe(comando)}`);
      return 1;
    }
    throw error;
  }
}

process.exitCode = await main();
