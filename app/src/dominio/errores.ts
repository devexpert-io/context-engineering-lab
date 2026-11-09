export type CodigoError =
  | "DATOS_INVALIDOS"
  | "NO_AUTENTICADO"
  | "SOLO_GESTOR"
  | "RUTA_NO_ENCONTRADA"
  | "PISTA_NO_ENCONTRADA"
  | "METODO_NO_PERMITIDO"
  | "CUOTA_INACTIVA"
  | "LIMITE_DE_RESERVAS"
  | "FRANJA_NO_DISPONIBLE"
  | "FRANJA_PASADA"
  | "EMAIL_YA_REGISTRADO"
  | "CUERPO_DEMASIADO_GRANDE"
  | "ERROR_INTERNO";

export type Detalles = Record<string, unknown>;

export class ErrorDominio extends Error {
  readonly codigo: CodigoError;
  readonly estado: number;
  readonly detalles: Detalles | undefined;

  constructor(codigo: CodigoError, mensaje: string, estado: number, detalles?: Detalles) {
    super(mensaje);
    this.name = "ErrorDominio";
    this.codigo = codigo;
    this.estado = estado;
    this.detalles = detalles;
  }
}

export function datosInvalidos(errores: Record<string, string>): ErrorDominio {
  return new ErrorDominio("DATOS_INVALIDOS", "Los datos enviados no son válidos", 400, errores);
}

export function pistaNoEncontrada(pistaId: string): ErrorDominio {
  return new ErrorDominio("PISTA_NO_ENCONTRADA", `No existe la pista ${pistaId}`, 404);
}
