# Testing

## Cómo se prueba

```sh
npm run check                       # tsc --noEmit y después todos los tests
npm test                            # solo los tests: node --test "test/**/*.test.ts"
node --test test/reservas.test.ts   # un fichero
```

Los tests usan `node:test` y `node:assert/strict`, sin otras dependencias. Casi todos son de integración: arrancan la app de verdad en un puerto aleatorio y le hacen peticiones HTTP con `fetch`. Las piezas puras con muchos casos, como `src/dominio/tiempo.ts`, tienen además tests unitarios.

## Ayudantes

`test/ayudantes.ts` exporta `arrancarApp(opciones?)`, que devuelve una app de prueba:

- `opciones.ahora` cambia la hora inicial del reloj y `opciones.datos`, los datos de partida (por defecto, la semilla).
- `get(ruta, socio?)`, `post(ruta, socio, cuerpo)`, `patch(ruta, socio, cuerpo)` y `pedir(metodo, ruta, { socio, cuerpo, cuerpoEnTexto, cabeceras })` devuelven `{ estado, cuerpo }` con el JSON ya leído. `socio` es el valor de `x-socio-id`.
- `reloj.fijar("2026-11-16T11:00")` mueve el reloj en mitad de un test.
- `auditoria.listar()`, `notificaciones.listar()` y `servicios` permiten comprobar efectos sin pasar por HTTP.
- Los ids nuevos son secuenciales por prefijo: la primera reserva creada en un test es `reserva-1` y el primer socio, `socio-1`.
- `cerrar()` para el servidor.

Cada test arranca su propia app en `beforeEach` y la cierra en `afterEach`, así que ningún test depende de lo que haya hecho otro.

## Reloj fijo y semilla

El reloj de los tests empieza en `AHORA_BASE`, el lunes 16 de noviembre de 2026 a las 10:00. `FECHA_BASE` es ese lunes y las reservas de la semilla se calculan a partir de él. Las dos constantes están en `src/infra/semilla.ts`.

| Socio | Nombre | Rol | Cuota | Situación a las 10:00 del lunes |
|---|---|---|---|---|
| `socio-ana` | Ana García | socio | activa | 2 reservas futuras: está en el límite |
| `socio-marta` | Marta López | socio | activa | 1 reserva futura y 1 cancelada |
| `socio-pablo` | Pablo Ruiz | socio | activa | 1 reserva en juego y 1 no presentada |
| `socio-irene` | Irene Sanz | socio | activa | Sin reservas |
| `socio-luis` | Luis Martín | socio | inactiva | No puede reservar |
| `gestor-carmen` | Carmen Díaz | gestor | activa | Sin reservas |

Pistas: `pista-1`, `pista-2` y `pista-3` están operativas y `pista-4`, cerrada.

| Reserva | Socio | Pista | Inicio | Estado |
|---|---|---|---|---|
| `reserva-pablo-2` | `socio-pablo` | `pista-3` | viernes 13, 20:00 | `no_presentada` |
| `reserva-pablo-1` | `socio-pablo` | `pista-1` | lunes 16, 09:30 | `confirmada`, en juego |
| `reserva-ana-1` | `socio-ana` | `pista-1` | martes 17, 18:30 | `confirmada` |
| `reserva-marta-1` | `socio-marta` | `pista-1` | miércoles 18, 18:30 | `confirmada` |
| `reserva-marta-2` | `socio-marta` | `pista-2` | miércoles 18, 20:00 | `cancelada` |
| `reserva-ana-2` | `socio-ana` | `pista-2` | jueves 19, 20:00 | `confirmada` |

Si un test necesita otra situación, la prepara él mismo con peticiones, con `reloj.fijar` o pasando `datos`, en lugar de cambiar la semilla, de la que dependen otros tests.

## Qué tests se esperan

Cada endpoint tiene tests del camino feliz y de cada error que puede devolver, comprobando el estado HTTP y `error.codigo`. Además:

- Si las comprobaciones tienen un orden (ver `dominio.md`), un test lo fija.
- Los límites de tiempo se prueban justo antes y justo en el límite, moviendo el reloj.
- Si el caso de uso audita o avisa, el test comprueba `auditoria.listar()` y `notificaciones.listar()`, y también que no queda nada registrado cuando la petición falla.
- Cada ruta de gestión tiene su test de `403 SOLO_GESTOR`.
- Un endpoint que escribe comprueba que el cambio se ve después, en la disponibilidad o en `/api/reservas/mias`.

| Fichero | Qué cubre |
|---|---|
| `autenticacion.test.ts` | `x-socio-id`, `GET /api/socios/yo` y el `403` de las rutas de gestión |
| `http.test.ts` | Respuestas JSON, `404` y `405` del router, cuerpos inválidos o demasiado grandes |
| `pistas.test.ts` | `GET /api/pistas` y `GET /api/pistas/:pistaId` |
| `disponibilidad.test.ts` | Semana de lunes a domingo, horario y estados de las franjas |
| `reservas.test.ts` | `POST /api/reservas` y `GET /api/reservas/mias` |
| `gestion-socios.test.ts` | `POST /api/gestion/socios` |
| `gestion-pistas.test.ts` | `PATCH /api/gestion/pistas/:pistaId` |
| `tiempo.test.ts` | Aritmética de fechas y franjas |

## Reglas

- No se tocan tests existentes para que pasen. Si un test falla, se arregla el código. Un test solo cambia cuando cambia la regla que comprueba, y ese cambio se documenta en `dominio.md`.
- Nada de esperas reales ni de la hora del sistema: el tiempo se controla con el reloj fijo.
- Un cambio está terminado cuando `npm run check` termina en verde.
