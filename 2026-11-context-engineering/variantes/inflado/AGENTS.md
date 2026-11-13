# Instrucciones para agentes

API de reservas de pistas de pádel de un club, en piloto. Node 26 y TypeScript sin compilar, sin frameworks y con los datos en memoria.

## Cómo se comprueba

- `npm run check` comprueba los tipos y pasa los tests. Tiene que terminar en verde antes de dar una tarea por terminada.
- `npm start` arranca la API en el puerto 3000. Todas las rutas piden la cabecera `x-socio-id`.

## Dónde está cada cosa

- `src/http/`: router, rutas, respuestas y autenticación.
- `src/servicios/`: casos de uso.
- `src/dominio/`: tipos, reglas, validación, tiempo y errores. No importa nada de `http` ni de `infra`.
- `src/infra/`: repositorio en memoria, reloj, auditoría, notificaciones y semilla.
- `test/`: tests con `node:test`. `test/ayudantes.ts` arranca la app con el reloj fijo y la semilla.

## Reglas para cualquier tarea

- Usa el glosario: franja (nunca turno), socio (nunca usuario) y gestor (nunca admin).
- El dominio y los servicios no llaman a `new Date()` ni a `Date.now()`: usan `reloj.ahora()`.
- Las horas son hora local del club, en cadenas `AAAA-MM-DDTHH:mm` sin zona, y se manejan con los helpers de `src/dominio/tiempo.ts`.
- Los errores se lanzan con `ErrorDominio` y salen como `{ error: { codigo, mensaje, detalles? } }`.
- Toda acción de un gestor se audita y, si afecta a un socio, se le avisa con una notificación.
- La validación se hace siempre en el servidor (`400 DATOS_INVALIDOS`).
- Cada endpoint nuevo lleva tests del camino feliz y de cada error.
- No cambies tests existentes para que pasen: arregla el código.

## Documentación del proyecto

## Contexto

Vocabulario del club. El código, la API, los tests y la documentación usan estos términos y no otros.

### Glosario

#### Socio

Persona dada de alta en el club. Puede reservar si tiene la cuota activa. Tiene un id (`socio-ana`) y un email que no comparte con ningún otro socio.

#### Gestor

Persona del club que da de alta socios, abre y cierra pistas, bloquea pistas y cancela reservas de otros. En el sistema es un socio con el rol `gestor`, así que también puede reservar como cualquier otro.

#### Pista

Pista de pádel del club (Pista 1 a Pista 4). Está `operativa` o `cerrada`. En una pista cerrada no se puede reservar ninguna franja.

#### Franja

Bloque de 90 minutos en una pista y un día concretos. Es la unidad de reserva. El club abre de 08:00 a 23:00 y las franjas empiezan a las 08:00, 09:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00 y 21:30. Una franja se identifica por su pista y su hora de inicio, y no se guarda: sale del horario.

#### Reserva

Franja asignada a un socio. Tiene uno de estos estados:

- `confirmada`: la franja es del socio.
- `cancelada`: la franja vuelve a estar libre. La reserva se conserva como histórico.
- `no_presentada` (no presentada): el socio no vino a jugar. La marca el gestor cuando la franja ya ha pasado.

#### Bloqueo

Periodo en el que el gestor deja una pista fuera de uso (mantenimiento, una avería, un evento del club). Tiene inicio, fin y motivo. Las franjas bloqueadas no se pueden reservar.

#### Cuota

Pago periódico del socio al club. El sistema solo sabe si está activa o no. Sin cuota activa no se reserva.

#### Semana

De lunes a domingo, en hora local del club. La disponibilidad se consulta por semanas.

### Términos descartados

| No usar | Usar | Motivo |
|---|---|---|
| turno | franja | "Turno" se confundía con los turnos del personal del club. |
| usuario | socio | Solo los socios entran en el sistema. "Usuario" no dice si paga cuota ni qué puede hacer. |
| admin, administrador | gestor | Es el nombre del puesto en el club. "Admin" sugiere un perfil técnico con todos los permisos. |

## Brief

### Problema

El club gestiona las reservas con un grupo de WhatsApp y una hoja de cálculo compartida. Hay dobles reservas, pistas vacías por cancelaciones que nadie ve y el gestor dedica unas 5 horas a la semana a cuadrar huecos y avisar a socios.

### Usuarios

- **Socios** (unos 300). Reservan sobre todo desde el móvil, a menudo con prisa.
- **Gestores** (una o dos personas del club). Trabajan desde el ordenador de la recepción.

### Objetivos

- Un socio reserva una franja libre en menos de un minuto.
- Cero dobles reservas.
- Una cancelación libera la franja al instante, a la vista de todos.
- El gestor deja de usar la hoja de cálculo y de avisar a mano.

### Qué hace el sistema

Una API HTTP que usará la web responsive del club:

- El socio consulta la disponibilidad semanal de cada pista, reserva franjas y ve sus reservas.
- El socio cancela con al menos 24 horas de antelación. Con menos, solo puede cancelar el gestor.
- El gestor da de alta socios, abre y cierra pistas y las bloquea por mantenimiento.
- El club avisa al socio cuando hace algo que le afecta, como darle de alta o cancelarle una reserva.

### Fuera de alcance

- Pagos online. La cuota se sigue cobrando como hasta ahora y el sistema solo sabe si está activa.
- Torneos, ligas y clases.
- App nativa. El club tendrá una web responsive.
- Lista de espera para franjas ocupadas. Se valorará después del piloto.

### Piloto

Dos semanas con 30 socios y las pistas 1, 2 y 3. La Pista 4 sigue cerrada por obras. Para llegar antes al piloto se aceptan tres simplificaciones (ver la sección "Decisiones" de este fichero):

- Los datos viven en memoria y se cargan de la semilla al arrancar.
- El socio se identifica con la cabecera `x-socio-id` en lugar de con un enlace mágico por email.
- Las notificaciones quedan en una bandeja en memoria. Todavía no se envían emails.

El piloto sale bien si no hay ninguna doble reserva y al menos el 80 % de sus reservas se hacen por la web.

## Dominio

Reglas del club para socios, pistas, franjas, reservas y bloqueos. Los términos están definidos en la sección "Contexto" de este fichero. Todas las horas son hora local del club, sin zona horaria.

### Entidades

| Entidad | Campos | Notas |
|---|---|---|
| Socio | `id`, `nombre`, `email`, `cuotaActiva`, `rol` (`socio` o `gestor`), `altaEn` | El email es único y se guarda en minúsculas. |
| Pista | `id`, `nombre`, `estado` (`operativa` o `cerrada`) | |
| Reserva | `id`, `socioId`, `pistaId`, `inicio`, `fin`, `estado`, `creadaEn` | `fin` es siempre `inicio` más 90 minutos. |
| Franja | `inicio`, `fin` | No se guarda: sale del horario. |
| Bloqueo | `id`, `pistaId`, `inicio`, `fin`, `motivo` | Pendiente de implementar. |

### Horario y franjas

El club abre todos los días de 08:00 a 23:00. Las franjas duran 90 minutos y empiezan a las 08:00, 09:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00 y 21:30, así que la última termina a las 23:00. Una franja **ha empezado** desde el minuto de su inicio: a las 18:30 en punto, la franja de las 18:30 ya ha empezado.

### Disponibilidad

La disponibilidad de una pista se consulta por semanas, de lunes a domingo. Cada franja sale con el primer estado que encaje:

1. `cerrada` si la pista está cerrada.
2. `reservada` si tiene una reserva confirmada.
3. `libre` en cualquier otro caso.

Una reserva cancelada o no presentada no ocupa su franja. La disponibilidad no distingue las franjas pasadas: una franja libre que ya ha empezado sale `libre`, aunque ya no se pueda reservar.

### Reglas de reserva

Un socio reserva una franja indicando la pista y la hora de inicio. Las comprobaciones se hacen en este orden y la primera que falla decide la respuesta:

1. `pistaId` e `inicio` son obligatorios, `inicio` tiene el formato `AAAA-MM-DDTHH:mm` y es el inicio de una franja del horario → `400 DATOS_INVALIDOS`.
2. La pista existe → `404 PISTA_NO_ENCONTRADA`.
3. El socio tiene la cuota activa → `409 CUOTA_INACTIVA`.
4. La franja no ha empezado → `409 FRANJA_PASADA`.
5. La franja está libre: la pista está operativa y nadie tiene una reserva confirmada en ella → `409 FRANJA_NO_DISPONIBLE`.
6. El socio tiene menos de 2 reservas confirmadas futuras → `409 LIMITE_DE_RESERVAS`. Solo cuentan las confirmadas que no han empezado. Las canceladas, las no presentadas y la que se está jugando no cuentan.

La reserva se crea `confirmada`. No hay límite de antelación: se puede reservar en cualquier semana futura.

### Ciclo de vida de una reserva

```
confirmada ──(el socio, con 24 h o más de antelación)───▶ cancelada
confirmada ──(el gestor, antes del inicio)──────────────▶ cancelada
confirmada ──(el gestor, cuando la franja ya ha pasado)─▶ no_presentada
```

Una reserva cancelada o no presentada no vuelve a `confirmada`: si el socio quiere esa franja, la reserva otra vez. Hoy la API solo crea reservas. La cancelación se describe más abajo y marcar una reserva como no presentada todavía no tiene endpoint.

### Pistas cerradas

El gestor cierra o abre una pista en cualquier momento. Cerrar una pista no toca sus reservas: siguen confirmadas y el socio las sigue viendo, pero la disponibilidad muestra todas las franjas de la pista como cerradas. Para dejar una pista sin uso durante un periodo concreto, liberando sus reservas con aviso a los socios, está el bloqueo.

### Política de cancelación

> Pendiente de implementar. Todavía no hay endpoint de cancelación.

El socio puede cancelar su propia reserva confirmada con 24 horas o más de antelación respecto al inicio. Con menos de 24 horas ya no puede (`409 FUERA_DE_PLAZO`) y solo el gestor puede cancelarla, hasta el inicio de la franja. Las 24 horas se cuentan en hora local del club.

Endpoint: `DELETE /api/reservas/:id`. Comprobaciones, en este orden:

1. La reserva existe → `404 RESERVA_NO_ENCONTRADA`.
2. La reserva es de quien cancela, o quien cancela es gestor → `403 NO_ES_TU_RESERVA`.
3. La reserva no está ya cancelada → `409 RESERVA_YA_CANCELADA`.
4. La franja no ha empezado, cancele quien cancele → `409 FRANJA_EMPEZADA`.
5. Si cancela el socio, faltan 24 horas o más para el inicio → `409 FUERA_DE_PLAZO`.

Al cancelar, la franja queda libre al instante. Si cancela el gestor, se audita (`cancelar_reserva`) y se avisa al socio con la plantilla `reserva_cancelada_por_el_club`. Respuesta: `200` con `{ reserva }` en estado `cancelada` y con `canceladaPor`, que vale `"socio"` o `"gestor"`.

### Bloqueos

> Pendiente de implementar. No existen ni el tipo, ni la ruta, ni la lógica.

El gestor bloquea una pista entre un inicio y un fin. Endpoint: `POST /api/gestion/pistas/:pistaId/bloqueos` con `{ inicio, fin, motivo, cancelarReservas? }`.

Si no se cumple alguna de estas condiciones, la respuesta es `400 DATOS_INVALIDOS` con detalles:

- `inicio` es el inicio de una franja y `fin` es el final de una franja, que puede ser de otro día.
- `fin` es posterior a `inicio` y el bloqueo dura como máximo 14 días.
- `inicio` no está en el pasado.
- `motivo` es obligatorio y tiene como máximo 200 caracteres.

Si la pista no existe, `404 PISTA_NO_ENCONTRADA`. Quedan bloqueadas todas las franjas entre `inicio` y `fin`, y los bloqueos pueden solaparse entre sí.

Si alguna reserva confirmada se solapa con el bloqueo, la respuesta es `409 PISTA_CON_RESERVAS` con `detalles.reservas`, la lista de sus ids. Si la petición trae `cancelarReservas: true`, en cambio, esas reservas se cancelan como cancelaciones del club: sin plazo, con `canceladaPor: "gestor"` y avisando a cada socio con la plantilla `reserva_cancelada_por_el_club`.

Las franjas bloqueadas salen con estado `bloqueada` en la disponibilidad y no se pueden reservar (`409 FRANJA_NO_DISPONIBLE`). Cada bloqueo se audita (`bloquear_pista`). Respuesta: `201` con `{ bloqueo: { id, pistaId, inicio, fin, motivo, reservasCanceladas } }`, donde `reservasCanceladas` es la lista de ids de las reservas canceladas, vacía si no había ninguna.

## API

API HTTP con JSON bajo `/api`. Este documento recoge las convenciones y la referencia de los endpoints que existen. Las reglas de negocio están en la sección "Dominio" de este fichero.

### Convenciones

- **JSON en UTF-8** en las peticiones y en todas las respuestas, errores incluidos. El cuerpo admite como máximo 64 KB.
- **Identificación**: todas las rutas exigen la cabecera `x-socio-id` con el id de un socio. Sin ella, o con un id que no existe, la respuesta es `401 NO_AUTENTICADO`. Es la solución provisional del piloto (decisión D-05 en la sección "Decisiones" de este fichero).
- **Rutas del gestor**: van bajo `/api/gestion` y su manejador empieza con `exigirGestor`. Un socio sin ese rol recibe `403 SOLO_GESTOR`.
- **Fechas**: hora local del club sin zona. Un día es `"2026-11-20"` y un día con hora, `"2026-11-20T18:30"`.
- **Éxito**: el recurso va envuelto en un objeto con su nombre: `{ "reserva": … }`, `{ "reservas": [ … ] }`, `{ "pistas": [ … ] }`, `{ "socio": … }`, `{ "disponibilidad": … }`. Crear responde `201` y el resto `200`.
- **Validación en el servidor**: cada endpoint valida su entrada aunque la web ya lo haga. Los errores de validación llevan en `detalles` un mensaje por campo, y los campos que el endpoint no espera se ignoran.

#### Errores

Todas las respuestas de error tienen la misma forma. `codigo` es estable y es lo que debe mirar el cliente. `mensaje` es para personas y puede cambiar. `detalles` solo aparece cuando aporta algo:

```json
{ "error": { "codigo": "DATOS_INVALIDOS", "mensaje": "Los datos enviados no son válidos", "detalles": { "pistaId": "Es obligatorio" } } }
```

| HTTP | Cuándo | Códigos actuales |
|---|---|---|
| 400 | La entrada está mal formada o no pasa la validación | `DATOS_INVALIDOS` |
| 401 | Falta `x-socio-id` o no es de ningún socio | `NO_AUTENTICADO` |
| 403 | El socio no tiene permiso para la operación | `SOLO_GESTOR` |
| 404 | No existe la ruta o el recurso | `RUTA_NO_ENCONTRADA`, `PISTA_NO_ENCONTRADA` |
| 405 | La ruta existe, pero no con ese método | `METODO_NO_PERMITIDO` |
| 409 | La petición es válida pero choca con una regla del club | `CUOTA_INACTIVA`, `LIMITE_DE_RESERVAS`, `FRANJA_NO_DISPONIBLE`, `FRANJA_PASADA`, `EMAIL_YA_REGISTRADO` |
| 413 | El cuerpo pasa de 64 KB | `CUERPO_DEMASIADO_GRANDE` |
| 500 | Error inesperado, que queda en el log | `ERROR_INTERNO` |

#### Orden de las comprobaciones

1. Ruta y método (`404`, `405`).
2. Identificación con `x-socio-id` (`401`).
3. Cuerpo legible: JSON válido de 64 KB como máximo (`400`, `413`).
4. Rol de gestor en `/api/gestion` (`403`).
5. Recurso de la URL (`404`).
6. Datos de la petición (`400`).
7. Reglas del dominio (`409`), en el orden de la sección "Dominio" de este fichero.

Los permisos que dependen del recurso, como que una reserva sea de quien la pide, se comprueban después de cargarlo. Los recursos que llegan en el cuerpo, como la pista de una reserva, se buscan después de validar los datos.

#### Cómo se añade un endpoint

1. Tipos, reglas y códigos de error nuevos en `src/dominio/` (los códigos, en `CodigoError`).
2. El caso de uso en `src/servicios/`: valida la entrada con `validar` y aplica las reglas del dominio. Si actúa el gestor, lo audita, y si el club cambia algo de un socio, le avisa.
3. Una entrada en la tabla de `src/http/rutas.ts` con método, patrón y un manejador fino: comprueba el rol si hace falta, llama al servicio y envuelve el resultado con `ok` o `creado`.
4. Tests del camino feliz y de cada error (ver la sección "Testing" de este fichero).
5. Su referencia en este documento, con un ejemplo de petición y de respuesta.

### Endpoints

| Endpoint | Quién | Qué hace |
|---|---|---|
| `GET /api/socios/yo` | socio | Devuelve el socio identificado |
| `GET /api/pistas` | socio | Lista las pistas |
| `GET /api/pistas/:pistaId` | socio | Devuelve una pista |
| `GET /api/pistas/:pistaId/disponibilidad` | socio | Franjas de una semana con su estado |
| `POST /api/reservas` | socio | Reserva una franja |
| `GET /api/reservas/mias` | socio | Reservas del socio identificado |
| `POST /api/gestion/socios` | gestor | Da de alta un socio |
| `PATCH /api/gestion/pistas/:pistaId` | gestor | Abre o cierra una pista |

El gestor también es socio, así que puede usar todos los endpoints. Los ejemplos usan la semilla con el reloj en el lunes 16 de noviembre de 2026 a las 10:00.

#### GET /api/socios/yo

Respuesta `200`:

```json
{ "socio": { "id": "socio-ana", "nombre": "Ana García", "email": "ana.garcia@example.com", "cuotaActiva": true, "rol": "socio", "altaEn": "2026-09-01T10:00" } }
```

#### GET /api/pistas y GET /api/pistas/:pistaId

Respuestas `200`, de la lista y de una pista:

```json
{ "pistas": [{ "id": "pista-1", "nombre": "Pista 1", "estado": "operativa" }, …, { "id": "pista-4", "nombre": "Pista 4", "estado": "cerrada" }] }
{ "pista": { "id": "pista-4", "nombre": "Pista 4", "estado": "cerrada" } }
```

Una pista que no existe responde `404 PISTA_NO_ENCONTRADA`.

#### GET /api/pistas/:pistaId/disponibilidad?semana=AAAA-MM-DD

Devuelve los 7 días, de lunes a domingo, de la semana que contiene la fecha `semana`. Sin `semana`, la semana actual. Cada día trae sus 10 franjas con estado `libre`, `reservada` o `cerrada`.

```http
GET /api/pistas/pista-1/disponibilidad?semana=2026-11-18
x-socio-id: socio-irene
```

Respuesta `200`:

```json
{
  "disponibilidad": {
    "pistaId": "pista-1",
    "desde": "2026-11-16",
    "hasta": "2026-11-22",
    "dias": [
      {
        "fecha": "2026-11-16",
        "franjas": [
          { "inicio": "2026-11-16T08:00", "fin": "2026-11-16T09:30", "estado": "libre" },
          { "inicio": "2026-11-16T09:30", "fin": "2026-11-16T11:00", "estado": "reservada" },
          …
        ]
      },
      …
    ]
  }
}
```

Errores: `404 PISTA_NO_ENCONTRADA` y `400 DATOS_INVALIDOS` si `semana` no es una fecha válida (en `detalles.semana`).

#### POST /api/reservas

```http
POST /api/reservas
x-socio-id: socio-irene
content-type: application/json

{ "pistaId": "pista-1", "inicio": "2026-11-18T09:30" }
```

Respuesta `201`:

```json
{ "reserva": { "id": "reserva-5c1d0e7a-2b9f-4c86-9a31-7f4e2d8b6c05", "socioId": "socio-irene", "pistaId": "pista-1", "inicio": "2026-11-18T09:30", "fin": "2026-11-18T11:00", "estado": "confirmada", "creadaEn": "2026-11-16T10:00" } }
```

Errores, en el orden de las reglas de reserva: `400 DATOS_INVALIDOS`, `404 PISTA_NO_ENCONTRADA`, `409 CUOTA_INACTIVA`, `409 FRANJA_PASADA`, `409 FRANJA_NO_DISPONIBLE` y `409 LIMITE_DE_RESERVAS`. Por ejemplo, con `"inicio": "2026-11-18T10:00"` la respuesta es `400`:

```json
{ "error": { "codigo": "DATOS_INVALIDOS", "mensaje": "Los datos enviados no son válidos", "detalles": { "inicio": "Las franjas empiezan a las 08:00, 09:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00, 21:30" } } }
```

#### GET /api/reservas/mias

Todas las reservas del socio identificado, en cualquier estado y ordenadas por inicio. Respuesta `200`:

```json
{ "reservas": [{ "id": "reserva-ana-1", "socioId": "socio-ana", "pistaId": "pista-1", "inicio": "2026-11-17T18:30", "fin": "2026-11-17T20:00", "estado": "confirmada", "creadaEn": "2026-11-09T12:00" }, …] }
```

#### POST /api/gestion/socios

Solo para el gestor. `nombre` (de 2 a 80 caracteres) y `email` son obligatorios y `cuotaActiva` es opcional (por defecto `true`). El alta siempre crea un socio con rol `socio`. Se audita como `alta_socio` y el nuevo socio recibe la plantilla `bienvenida`.

```http
POST /api/gestion/socios
x-socio-id: gestor-carmen
content-type: application/json

{ "nombre": "Nuria Gil", "email": "Nuria.Gil@example.com" }
```

Respuesta `201`, con el email normalizado:

```json
{ "socio": { "id": "socio-9e2b4f60-1c7a-4d3e-8f05-b6a2c4d81e97", "nombre": "Nuria Gil", "email": "nuria.gil@example.com", "cuotaActiva": true, "rol": "socio", "altaEn": "2026-11-16T10:00" } }
```

Errores: `403 SOLO_GESTOR`, `400 DATOS_INVALIDOS` (en `detalles.nombre`, `detalles.email` o `detalles.cuotaActiva`) y `409 EMAIL_YA_REGISTRADO`, sin distinguir mayúsculas.

#### PATCH /api/gestion/pistas/:pistaId

Solo para el gestor. Cuerpo: `{ "estado": "operativa" }` o `{ "estado": "cerrada" }`. Responde `200` con `{ pista }` y se audita como `cambiar_estado_pista` con el estado anterior y el nuevo, también si no cambia. No toca las reservas de la pista.

Errores: `403 SOLO_GESTOR`, `404 PISTA_NO_ENCONTRADA` y `400 DATOS_INVALIDOS` (en `detalles.estado`).

## Arquitectura

Un único proceso de Node 26 que ejecuta TypeScript sin compilar y sirve la API con `node:http`. No hay frameworks ni dependencias de producción, y durante el piloto los datos viven en memoria.

### Capas y dependencias

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

### Recorrido de una petición

`src/http/manejador.ts` resuelve la ruta con `router.ts`, identifica al socio por `x-socio-id` con `autenticacion.ts`, lee el cuerpo JSON y llama al manejador de la ruta, definido en `rutas.ts`. Ese manejador comprueba el rol si hace falta (`exigirGestor`), llama a un servicio y envuelve el resultado con `ok` o `creado`. Si algo lanza un error por el camino, `respuestaDeError` (`respuestas.ts`) lo convierte en la respuesta.

Los manejadores de las rutas no contienen reglas de negocio. Los servicios validan su entrada (llega como `unknown`), cargan lo que necesitan del repositorio, delegan las decisiones en las reglas del dominio y registran auditoría y notificaciones.

### Reloj inyectado

Dominio y servicios nunca llaman a `new Date()` ni a `Date.now()`. Los servicios piden la hora a `reloj.ahora()` y la pasan a las reglas como un dato más (`comprobarQuePuedeReservar({ …, ahora })`). En producción se usa `crearRelojDelSistema()`, y en los tests `crearRelojFijo()`, que se mueve con `fijar()`.

### Tiempo sin zona

Todo es hora local del club (Europe/Madrid) en cadenas ISO sin zona: `Fecha` (`"2026-11-20"`) y `FechaHora` (`"2026-11-20T18:30"`, con precisión de minutos). Ni `Z`, ni desplazamientos, ni zonas horarias. Las operaciones están en `src/dominio/tiempo.ts`: `sumarMinutos`, `sumarHoras`, `sumarDias`, `minutosEntre`, `esAnterior`, `compararFechaHora`, `diaDeLaSemana`, `esInicioDeFranja`, `finDeFranja`, `franjasDelDia` y `haEmpezado`. Funcionan con aritmética de calendario, sin `Date`. Los 7 días de una semana los calcula `diasDeLaSemana` en `src/dominio/semana.ts`.

La única pieza que sabe de zonas horarias es el reloj del sistema (`src/infra/reloj.ts`), que traduce el instante actual a la hora de Madrid.

### Errores

Cualquier error esperado es un `ErrorDominio(codigo, mensaje, estado, detalles?)` de `src/dominio/errores.ts`, con su código en el tipo `CodigoError`. Los más repetidos tienen función propia: `datosInvalidos(errores)` y `pistaNoEncontrada(pistaId)`. `respuestaDeError` es el único sitio que traduce errores a JSON. Un `ErrorDominio` sale con su estado y su código, y cualquier otro error, como `500 ERROR_INTERNO`, con la traza en el log.

### Validación

`validar(entrada, reglas)` (`src/dominio/validacion.ts`) comprueba un objeto campo a campo, devuelve los valores ya limpios y tipados, y si algo falla lanza `DATOS_INVALIDOS` con un mensaje por campo. Hay reglas para textos, emails, booleanos, valores de una lista (`unoDe`), fechas e inicios de franja, y `opcional(regla, porDefecto)`. Las reglas nuevas se escriben con `valido` e `invalido`. Las comprobaciones que cruzan campos se hacen después y fallan con `datosInvalidos({ campo: mensaje })`.

### Auditoría

Toda acción de un gestor se registra con `auditoria.registrar({ accion, actorId, datos })`, con la acción en snake_case. La auditoría en memoria (`src/infra/auditoria.ts`) añade la fecha del reloj. Acciones actuales: `alta_socio` con `{ socioId }` y `cambiar_estado_pista` con `{ pistaId, anterior, nuevo }`.

### Notificaciones

Cuando el club hace algo que afecta a un socio, como darle de alta o cambiar una reserva suya, se le avisa con `notificaciones.enviar({ socioId, plantilla, datos })`. En el piloto es una bandeja en memoria (`src/infra/notificaciones.ts`) que añade la fecha de envío. Plantillas actuales: `bienvenida` con `{ nombre }`.

### Datos

El repositorio en memoria (`src/infra/repositorio.ts`) guarda cada colección en un `Map` y devuelve copias: cambiar un objeto leído no cambia nada hasta llamar a `guardar`. Es síncrono, así que entre comprobar que una franja está libre y guardar la reserva no hay ningún `await` y dos peticiones no pueden quedarse la misma franja.

### Estructura de carpetas

```
src/
  app.ts              crearApp: une las capas
  servidor.ts         arranque, configuración y logs
  dominio/            tipos, reglas, tiempo, semana, validacion, errores y puertos
  servicios/          socios, pistas, disponibilidad y reservas, y servicios.ts, que los agrupa
  http/               manejador, router, rutas, respuestas y autenticacion
  infra/              repositorio, auditoria, notificaciones, reloj y semilla
test/                 un fichero por endpoint o área, y ayudantes.ts
```

## Testing

### Cómo se prueba

```sh
npm run check                       # tsc --noEmit y después todos los tests
npm test                            # solo los tests: node --test "test/**/*.test.ts"
node --test test/reservas.test.ts   # un fichero
```

Los tests usan `node:test` y `node:assert/strict`, sin otras dependencias. Casi todos son de integración: arrancan la app de verdad en un puerto aleatorio y le hacen peticiones HTTP con `fetch`. Las piezas puras con muchos casos, como `src/dominio/tiempo.ts`, tienen además tests unitarios.

### Ayudantes

`test/ayudantes.ts` exporta `arrancarApp(opciones?)`, que devuelve una app de prueba:

- `opciones.ahora` cambia la hora inicial del reloj y `opciones.datos`, los datos de partida (por defecto, la semilla).
- `get(ruta, socio?)`, `post(ruta, socio, cuerpo)`, `patch(ruta, socio, cuerpo)` y `pedir(metodo, ruta, { socio, cuerpo, cuerpoEnTexto, cabeceras })` devuelven `{ estado, cuerpo }` con el JSON ya leído. `socio` es el valor de `x-socio-id`.
- `reloj.fijar("2026-11-16T11:00")` mueve el reloj en mitad de un test.
- `auditoria.listar()`, `notificaciones.listar()` y `servicios` permiten comprobar efectos sin pasar por HTTP.
- Los ids nuevos son secuenciales por prefijo: la primera reserva creada en un test es `reserva-1` y el primer socio, `socio-1`.
- `cerrar()` para el servidor.

Cada test arranca su propia app en `beforeEach` y la cierra en `afterEach`, así que ningún test depende de lo que haya hecho otro.

### Reloj fijo y semilla

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

### Qué tests se esperan

Cada endpoint tiene tests del camino feliz y de cada error que puede devolver, comprobando el estado HTTP y `error.codigo`. Además:

- Si las comprobaciones tienen un orden (ver la sección "Dominio" de este fichero), un test lo fija.
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

### Reglas

- No se tocan tests existentes para que pasen. Si un test falla, se arregla el código. Un test solo cambia cuando cambia la regla que comprueba, y ese cambio se documenta en la sección "Dominio" de este fichero.
- Nada de esperas reales ni de la hora del sistema: el tiempo se controla con el reloj fijo.
- Un cambio está terminado cuando `npm run check` termina en verde.

## Convenciones

### Nombres

- El dominio se escribe en español: tipos, funciones, variables, mensajes de error y nombres de tests (`diasDeLaSemana`, `reservar`, `ErrorDominio`). Se usan los términos de la sección "Contexto" de este fichero y nunca los descartados.
- Los identificadores van sin tildes ni eñes (`anio`, `senal`, `diasDeLaSemana`). Los textos para personas, como mensajes y nombres de tests, sí las llevan.
- camelCase para funciones y variables, PascalCase para tipos e interfaces y mayúsculas con guiones bajos para las constantes de módulo (`MAXIMO_RESERVAS_FUTURAS`).
- Las funciones que construyen algo se llaman `crearX`: `crearServicioReservas`, `crearRelojFijo`.
- Ficheros en minúsculas y en español: `disponibilidad.ts`, `gestion-pistas.test.ts`.

### Códigos y datos

- Los códigos de error van en español y en mayúsculas con guiones bajos (`FRANJA_NO_DISPONIBLE`). Todos están en el tipo `CodigoError` de `src/dominio/errores.ts`, y uno nuevo se añade ahí y en la tabla de la sección "API" de este fichero.
- Las acciones de auditoría y las plantillas de notificación van en snake_case: `alta_socio`, `bienvenida`.
- Los campos JSON van en camelCase, igual que en los tipos (`cuotaActiva`, `pistaId`), y los estados, en minúsculas (`confirmada`, `no_presentada`, `operativa`).

### TypeScript

- Node ejecuta los `.ts` quitando los tipos, así que solo vale sintaxis que se pueda borrar: nada de `enum`, `namespace` ni parameter properties (`constructor(private reloj: Reloj)`). Para conjuntos de valores se usan uniones de literales o `as const`.
- Los imports relativos llevan la extensión `.ts`. Lo que solo es un tipo se importa con `import type` o con `type` dentro de las llaves. Si no, Node busca en ejecución algo que no existe.
- Sin `export default`: todo se exporta con nombre.
- Modo `strict`. `any` solo en los tests, para el JSON de las respuestas.
- Fábricas que devuelven objetos en lugar de clases. La única clase es `ErrorDominio`.

### Estilo

- Dos espacios, comillas dobles, punto y coma y coma final en listas de varias líneas.
- Líneas de 100 columnas como máximo, salvo nombres de tests largos.
- Funciones pequeñas con nombres que digan qué hacen. Comentarios solo para explicar lo que el código no cuenta, como el porqué de algo poco evidente.
- Ni código comentado, ni `console.log` de depuración, ni TODOs. Lo que queda pendiente se apunta en la documentación.

### Commits

- Pequeños, con un solo propósito y con `npm run check` en verde.
- Mensaje en español y en minúscula, con el área delante: `reservas: las canceladas no cuentan para el límite`.
- Si el cambio toca una regla, la API o la forma de probar, el mismo commit actualiza la documentación de este fichero.

## Operaciones

### Requisitos y arranque

Hace falta Node 26 o posterior, que ejecuta TypeScript sin compilar. `npm install` solo instala `typescript` y `@types/node`, necesarios para comprobar tipos pero no para arrancar.

```sh
npm start                                # http://localhost:3000
PORT=8080 npm start                      # en otro puerto
RELOJ_FIJO=2026-11-16T10:00 npm start    # con la hora congelada, como en los tests
```

Al arrancar se carga la semilla de `src/infra/semilla.ts`. Los datos viven en memoria: al reiniciar se pierde todo lo creado (reservas, altas y cambios de estado de las pistas) y se vuelve a la semilla.

### Variables de entorno

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP. Si no es un puerto válido, el proceso termina con un error. |
| `RELOJ_FIJO` | sin definir | Hora local fija con el formato `AAAA-MM-DDTHH:mm`. Sin ella se usa la hora real de Madrid. |

### Logs

Cada petición deja una línea en la salida estándar con el método, la ruta, el estado, la duración y el id del socio:

```
POST /api/reservas 201 3ms socio=socio-irene
```

Los errores inesperados (`500 ERROR_INTERNO`) escriben la traza completa en la salida de errores. Las notificaciones no aparecen en el log: se quedan en la bandeja en memoria.

### Parada

`Ctrl+C` o `SIGTERM` cierran el servidor: deja de aceptar conexiones y termina las peticiones en curso.

### Problemas frecuentes

- **`EADDRINUSE` al arrancar.** El puerto está ocupado, casi siempre por otra instancia de la API. Párala o usa otro `PORT`.
- **Todo responde `401 NO_AUTENTICADO`.** Falta la cabecera `x-socio-id` o el id no existe. Los ids de la semilla están en la sección "Testing" de este fichero, y un socio dado de alta desaparece al reiniciar.
- **Las reservas de la semilla salen en el pasado o en una semana que no es la actual.** La semilla está pensada para el lunes 16 de noviembre de 2026. Arranca con `RELOJ_FIJO=2026-11-16T10:00`.
- **`ERR_UNKNOWN_FILE_EXTENSION` o errores de sintaxis en los `.ts`.** La versión de Node no ejecuta TypeScript. Comprueba `node --version`.
- **`does not provide an export named …` al arrancar.** Un tipo se importa sin `import type` (ver la sección "Convenciones" de este fichero). `npm run typecheck` lo detecta.
- **`413 CUERPO_DEMASIADO_GRANDE`.** El cuerpo pasa de 64 KB. Ninguna petición legítima se acerca a ese tamaño.

## Decisiones

Registro de decisiones de producto y arquitectura. Las nuevas se añaden al final, con fecha y motivo. Una decisión no se reescribe: si cambia, se añade otra que la sustituye.

### D-01 · 2026-09-29 · Node sin framework

**Decisión:** `node:http` con un router propio, sin Express ni Fastify.
**Motivo:** la API tiene pocos endpoints y reglas sencillas. Un framework trae dependencias y convenciones que no necesitamos y que cualquiera que llegue al proyecto tendría que aprender. El router propio cubre rutas con parámetros, 404 y 405 en unas 70 líneas.

### D-02 · 2026-09-29 · TypeScript sin compilar

**Decisión:** Node 26 ejecuta los `.ts` quitando los tipos y `tsc --noEmit` solo comprueba tipos.
**Motivo:** sin paso de compilación no hay una carpeta `dist` que se quede desfasada ni configuración de build. El precio es usar solo sintaxis que se pueda borrar e importar con la extensión `.ts`.

### D-03 · 2026-10-02 · Datos en memoria durante el piloto

**Decisión:** repositorio en memoria cargado desde la semilla al arrancar. Sin base de datos hasta después del piloto.
**Motivo:** en un piloto de dos semanas con 30 socios hay que validar las reglas y el flujo, no la persistencia. El repositorio está detrás de la interfaz `Repositorio`, así que cambiarlo por PostgreSQL no toca los servicios. Como es síncrono, tampoco hay carreras entre comprobar una franja y reservarla. Con base de datos, eso tendrá que garantizarlo un índice único.

### D-04 · 2026-10-02 · Hora local del club, sin zonas horarias

**Decisión:** fechas como cadenas ISO sin zona, en hora de Madrid (`"2026-11-20T18:30"`).
**Motivo:** el club está en un solo sitio y socios y gestores piensan en hora local. Con instantes UTC cada comparación obligaría a convertir, y los errores de una hora en los cambios de horario serían fáciles. El club abre de 08:00 a 23:00, así que el cambio de hora, que es de madrugada, nunca cae dentro de una franja. Se acepta que un plazo de 24 horas que cruce un cambio de hora dure 23 o 25 horas reales.

### D-05 · 2026-10-06 · Cabecera x-socio-id en lugar de enlace mágico

**Decisión:** durante el piloto el socio se identifica con la cabecera `x-socio-id`. El enlace mágico por email queda para después.
**Motivo:** el proveedor de email está sin decidir y el piloto se hace con 30 socios conocidos, desde la red del club. La identificación está aislada en `src/http/autenticacion.ts`, así que cambiarla no afecta a rutas ni servicios. No es segura: la API no puede abrirse a internet así.

### D-06 · 2026-10-06 · Franjas fijas de 90 minutos

**Decisión:** franjas de 90 minutos con el mismo horario todos los días, de 08:00 a 23:00.
**Motivo:** es lo que ya hacía el club en la hoja de cálculo y lo que dura un partido normal. Un horario configurable por día o por pista complica la disponibilidad y la validación, y nadie lo ha pedido. Si llega, el punto de partida es `HORARIO` en `src/dominio/tiempo.ts`.

### D-07 · 2026-10-08 · Máximo 2 reservas confirmadas futuras

**Decisión:** un socio no puede tener más de 2 reservas confirmadas que no hayan empezado.
**Motivo:** de 18:30 a 23:00 hay más socios que pistas. Con el límite, nadie acapara la semana y las horas buenas se reparten mejor. Las reservas canceladas, las no presentadas y la que se está jugando no cuentan.

### D-08 · 2026-10-08 · Gestor y no admin

**Decisión:** el rol se llama gestor en el código, la API y la documentación. Es un socio con `rol: "gestor"`, no un tipo de cuenta aparte.
**Motivo:** es el nombre del puesto en el club y lo que entiende todo el mundo allí. "Admin" sugiere permisos técnicos sin límite, y el gestor solo tiene operaciones concretas bajo `/api/gestion`.

### D-09 · 2026-10-14 · Un único tipo de error con código y estado HTTP

**Decisión:** todos los errores esperados son `ErrorDominio`, con código en español, mensaje, estado HTTP y detalles, y solo `respuestaDeError` los convierte en JSON.
**Motivo:** el cliente decide por el código, no por el mensaje. Con el estado HTTP en el propio error no hace falta una tabla de traducción aparte que se desincronice. El dominio sabe así algo de HTTP, pero solo un número.

### D-10 · 2026-10-20 · Reloj inyectado

**Decisión:** la hora actual llega siempre de `reloj.ahora()`. Dominio y servicios no usan `Date`.
**Motivo:** casi todas las reglas dependen de la hora: franja pasada, reservas futuras, plazo de cancelación. Con un reloj fijo, los tests son deterministas y prueban los límites exactos sin esperar.
