import { datosInvalidos } from "./errores.ts";
import { esFecha, esFechaHora, esInicioDeFranja, HORAS_DE_INICIO } from "./tiempo.ts";
import type { Fecha, FechaHora } from "./tipos.ts";

export type Resultado<T> = { valido: true; valor: T } | { valido: false; mensaje: string };
export type Regla<T> = (valor: unknown) => Resultado<T>;

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validar<T>(entrada: unknown, reglas: { [Campo in keyof T]: Regla<T[Campo]> }): T {
  if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) {
    throw datosInvalidos({ cuerpo: "Se esperaba un objeto JSON" });
  }
  const datos = entrada as Record<string, unknown>;
  const valores: Partial<T> = {};
  const errores: Record<string, string> = {};
  for (const campo in reglas) {
    const resultado = reglas[campo](datos[campo]);
    if (resultado.valido) valores[campo] = resultado.valor;
    else errores[campo] = resultado.mensaje;
  }
  if (Object.keys(errores).length > 0) throw datosInvalidos(errores);
  return valores as T;
}

export function valido<T>(valor: T): Resultado<T> {
  return { valido: true, valor };
}

export function invalido(mensaje: string): Resultado<never> {
  return { valido: false, mensaje };
}

function falta(valor: unknown): boolean {
  return valor === undefined || valor === null;
}

export function texto({ min = 1, max }: { min?: number; max: number }): Regla<string> {
  return (valor) => {
    if (falta(valor) || (typeof valor === "string" && valor.trim() === "")) {
      return invalido("Es obligatorio");
    }
    if (typeof valor !== "string") return invalido("Debe ser un texto");
    const limpio = valor.trim();
    if (limpio.length < min) return invalido(`Debe tener al menos ${min} caracteres`);
    if (limpio.length > max) return invalido(`Debe tener como máximo ${max} caracteres`);
    return valido(limpio);
  };
}

export const email: Regla<string> = (valor) => {
  const resultado = texto({ max: 254 })(valor);
  if (!resultado.valido) return resultado;
  const normalizado = resultado.valor.toLowerCase();
  return PATRON_EMAIL.test(normalizado) ? valido(normalizado) : invalido("No es un email válido");
};

export const booleano: Regla<boolean> = (valor) => {
  if (falta(valor)) return invalido("Es obligatorio");
  return typeof valor === "boolean" ? valido(valor) : invalido("Debe ser true o false");
};

export function unoDe<T extends string>(opciones: readonly T[]): Regla<T> {
  return (valor) => {
    if (falta(valor)) return invalido("Es obligatorio");
    const opcion = opciones.find((candidata) => candidata === valor);
    if (opcion === undefined) {
      return invalido(`Debe ser uno de estos valores: ${opciones.join(", ")}`);
    }
    return valido(opcion);
  };
}

export function opcional<T>(regla: Regla<T>, porDefecto: T): Regla<T> {
  return (valor) => (valor === undefined ? valido(porDefecto) : regla(valor));
}

export const fecha: Regla<Fecha> = (valor) => {
  if (falta(valor)) return invalido("Es obligatorio");
  return esFecha(valor) ? valido(valor) : invalido("Debe ser una fecha con formato AAAA-MM-DD");
};

export const inicioDeFranja: Regla<FechaHora> = (valor) => {
  if (falta(valor)) return invalido("Es obligatorio");
  if (!esFechaHora(valor)) {
    return invalido("Debe ser una fecha y hora con formato AAAA-MM-DDTHH:mm");
  }
  if (!esInicioDeFranja(valor)) {
    return invalido(`Las franjas empiezan a las ${HORAS_DE_INICIO.join(", ")}`);
  }
  return valido(valor);
};
