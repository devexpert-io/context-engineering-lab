import { createServer } from "node:http";
import { crearApp } from "./app.ts";
import { esFechaHora } from "./dominio/tiempo.ts";
import { CABECERA_SOCIO } from "./http/autenticacion.ts";
import { crearRelojDelSistema, crearRelojFijo } from "./infra/reloj.ts";

const puerto = Number(process.env.PORT ?? 3000);
const relojFijo = process.env.RELOJ_FIJO || undefined;

if (!Number.isInteger(puerto) || puerto < 0 || puerto > 65535) {
  console.error(`PORT no es un puerto válido: ${process.env.PORT}`);
  process.exit(1);
}
if (relojFijo !== undefined && !esFechaHora(relojFijo)) {
  console.error(`RELOJ_FIJO debe tener el formato AAAA-MM-DDTHH:mm y no "${relojFijo}"`);
  process.exit(1);
}

const reloj = relojFijo === undefined ? crearRelojDelSistema() : crearRelojFijo(relojFijo);
const { manejador } = crearApp({ reloj });

const servidor = createServer((req, res) => {
  const inicio = performance.now();
  res.on("finish", () => {
    const milisegundos = Math.round(performance.now() - inicio);
    const socio = req.headers[CABECERA_SOCIO] ?? "-";
    console.log(`${req.method} ${req.url} ${res.statusCode} ${milisegundos}ms socio=${socio}`);
  });
  void manejador(req, res);
});

servidor.on("error", (error) => {
  console.error(`No se pudo arrancar el servidor: ${error.message}`);
  process.exit(1);
});

servidor.listen(puerto, () => {
  const aviso = relojFijo === undefined ? "" : ` con el reloj fijo en ${relojFijo}`;
  console.log(`API de reservas escuchando en http://localhost:${puerto}${aviso}`);
});

for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, () => servidor.close(() => process.exit(0)));
}
