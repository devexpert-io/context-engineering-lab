# Arquitectura

Un único proceso de Node 26 que ejecuta TypeScript sin compilar y sirve la API con `node:http`. No hay frameworks ni dependencias de producción, y durante el piloto los datos viven en memoria.

## Capas y dependencias

```
http ──▶ servicios ──▶ dominio ◀── infra
  ▲                                  ▲
  └────────────── app.ts ────────────┘
```

| Capa | Carpeta | Qué contiene | Puede importar |
|---|---|---|---|
| dominio | `src/dominio/` | Tipos, reglas, tiempo, semana, validación, errores y puertos | Solo `dominio` |
| servicios | `src/servicios/` | Casos de uso: `reservar`, `darDeAlta`, `cambiarEstado`… | `dominio` |
| http | `src/http/` | Router, tabla de rutas, respuestas y autenticación | `servicios`, `dominio` y `node:http` |
| infra | `src/infra/` | Repositorio en memoria, auditoría, notificaciones, reloj del sistema y semilla | `dominio` y módulos de Node |

`src/app.ts` es el único sitio que conoce todas las capas. `crearApp({ reloj, datos?, generarId? })` crea el repositorio con `datos` (la semilla, si no se pasan), la auditoría, la bandeja de notificaciones y los servicios, y devuelve `{ manejador, servicios, auditoria, notificaciones }`, donde `manejador` es el `(req, res)` que espera `node:http`. Sin `generarId`, los ids nuevos son el prefijo y un UUID (`reserva-5c1d…`). `src/servidor.ts` lee la configuración, crea la app con el reloj del sistema (o con uno fijo si se define `RELOJ_FIJO`) y escucha en `PORT`.

Los puertos (`src/dominio/puertos.ts`) son las interfaces de lo que el dominio necesita de fuera: `Reloj`, `Repositorio`, `Auditoria`, `Notificaciones` y `GenerarId`, agrupadas en `Dependencias`. Cada servicio recibe las suyas al crearse (`crearServicioReservas({ repositorio, reloj, generarId })`) y nunca importa nada de `infra`. Por eso los tests pueden montar la app con un reloj fijo y otros datos.

## Recorrido de una petición

`src/http/manejador.ts` resuelve la ruta con `router.ts`, identifica al socio por `x-socio-id` con `autenticacion.ts`, lee el cuerpo JSON y llama al manejador de la ruta, definido en `rutas.ts`. Ese manejador comprueba el rol si hace falta (`exigirGestor`), llama a un servicio y envuelve el resultado con `ok` o `creado`. Si algo lanza un error por el camino, `respuestaDeError` (`respuestas.ts`) lo convierte en la respuesta.

Los manejadores de las rutas no contienen reglas de negocio. Los servicios validan su entrada (llega como `unknown`), cargan lo que necesitan del repositorio, delegan las decisiones en las reglas del dominio y registran auditoría y notificaciones.

## Reloj inyectado

Dominio y servicios nunca llaman a `new Date()` ni a `Date.now()`. Los servicios piden la hora a `reloj.ahora()` y la pasan a las reglas como un dato más (`comprobarQuePuedeReservar({ …, ahora })`). En producción se usa `crearRelojDelSistema()`, y en los tests `crearRelojFijo()`, que se mueve con `fijar()`.

## Tiempo sin zona

Todo es hora local del club (Europe/Madrid) en cadenas ISO sin zona: `Fecha` (`"2026-11-20"`) y `FechaHora` (`"2026-11-20T18:30"`, con precisión de minutos). Ni `Z`, ni desplazamientos, ni zonas horarias. Las operaciones están en `src/dominio/tiempo.ts`: `sumarMinutos`, `sumarHoras`, `sumarDias`, `minutosEntre`, `esAnterior`, `compararFechaHora`, `diaDeLaSemana`, `esInicioDeFranja`, `finDeFranja`, `franjasDelDia` y `haEmpezado`. Funcionan con aritmética de calendario, sin `Date`. Los 7 días de una semana los calcula `diasDeLaSemana` en `src/dominio/semana.ts`.

La única pieza que sabe de zonas horarias es el reloj del sistema (`src/infra/reloj.ts`), que traduce el instante actual a la hora de Madrid.

## Errores

Cualquier error esperado es un `ErrorDominio(codigo, mensaje, estado, detalles?)` de `src/dominio/errores.ts`, con su código en el tipo `CodigoError`. Los más repetidos tienen función propia: `datosInvalidos(errores)` y `pistaNoEncontrada(pistaId)`. `respuestaDeError` es el único sitio que traduce errores a JSON. Un `ErrorDominio` sale con su estado y su código, y cualquier otro error, como `500 ERROR_INTERNO`, con la traza en el log.

## Validación

`validar(entrada, reglas)` (`src/dominio/validacion.ts`) comprueba un objeto campo a campo, devuelve los valores ya limpios y tipados, y si algo falla lanza `DATOS_INVALIDOS` con un mensaje por campo. Hay reglas para textos, emails, booleanos, valores de una lista (`unoDe`), fechas e inicios de franja, y `opcional(regla, porDefecto)`. Las reglas nuevas se escriben con `valido` e `invalido`. Las comprobaciones que cruzan campos se hacen después y fallan con `datosInvalidos({ campo: mensaje })`.

## Auditoría

Toda acción de un gestor se registra con `auditoria.registrar({ accion, actorId, datos })`, con la acción en snake_case. La auditoría en memoria (`src/infra/auditoria.ts`) añade la fecha del reloj. Acciones actuales: `alta_socio` con `{ socioId }` y `cambiar_estado_pista` con `{ pistaId, anterior, nuevo }`.

## Notificaciones

Cuando el club hace algo que afecta a un socio, como darle de alta o cambiar una reserva suya, se le avisa con `notificaciones.enviar({ socioId, plantilla, datos })`. En el piloto es una bandeja en memoria (`src/infra/notificaciones.ts`) que añade la fecha de envío. Plantillas actuales: `bienvenida` con `{ nombre }`.

## Datos

El repositorio en memoria (`src/infra/repositorio.ts`) guarda cada colección en un `Map` y devuelve copias: cambiar un objeto leído no cambia nada hasta llamar a `guardar`. Es síncrono, así que entre comprobar que una franja está libre y guardar la reserva no hay ningún `await` y dos peticiones no pueden quedarse la misma franja.

## Estructura de carpetas

```
src/
  app.ts              crearApp: une las capas
  servidor.ts         arranque, configuración y logs
  dominio/            tipos, reglas, tiempo, semana, validacion, errores y puertos
  servicios/          socios, pistas, disponibilidad y reservas, y servicios.ts, que los agrupa
  http/               manejador, router, rutas, respuestas y autenticacion
  infra/              repositorio, auditoria, notificaciones, reloj y semilla
test/                 un fichero por endpoint o área, y ayudantes.ts
docs/                 documentación del proyecto
```
