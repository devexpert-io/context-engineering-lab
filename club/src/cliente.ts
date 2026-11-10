// Cliente mínimo de la API del club. Lo usan la CLI y el servidor MCP.
export interface Respuesta {
  ok: boolean;
  datos: unknown;
}

export async function llamar(metodo: string, ruta: string, opciones: { consulta?: Record<string, unknown>; cuerpo?: Record<string, unknown> } = {}): Promise<Respuesta> {
  const base = process.env.CLUB_API;
  if (!base) throw new Error("Falta la variable CLUB_API con la dirección de la API del club");
  const url = new URL(ruta, base);
  for (const [clave, valor] of Object.entries(opciones.consulta ?? {})) {
    if (valor !== undefined && valor !== "") url.searchParams.set(clave, String(valor));
  }
  const cuerpo = opciones.cuerpo && Object.fromEntries(Object.entries(opciones.cuerpo).filter(([, valor]) => valor !== undefined));
  const respuesta = await fetch(url, {
    method: metodo,
    headers: cuerpo ? { "content-type": "application/json" } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { ok: respuesta.ok, datos: await respuesta.json() };
}
