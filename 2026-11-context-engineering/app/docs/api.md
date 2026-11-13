# API

API HTTP con JSON bajo `/api`. Este documento recoge las convenciones y la referencia de los endpoints que existen. Las reglas de negocio están en `dominio.md`.

## Convenciones

- **JSON en UTF-8** en las peticiones y en todas las respuestas, errores incluidos. El cuerpo admite como máximo 64 KB.
- **Identificación**: todas las rutas exigen la cabecera `x-socio-id` con el id de un socio. Sin ella, o con un id que no existe, la respuesta es `401 NO_AUTENTICADO`. Es la solución provisional del piloto (decisión D-05 en `decisiones.md`).
- **Rutas del gestor**: van bajo `/api/gestion` y su manejador empieza con `exigirGestor`. Un socio sin ese rol recibe `403 SOLO_GESTOR`.
- **Fechas**: hora local del club sin zona. Un día es `"2026-11-20"` y un día con hora, `"2026-11-20T18:30"`.
- **Éxito**: el recurso va envuelto en un objeto con su nombre: `{ "reserva": … }`, `{ "reservas": [ … ] }`, `{ "pistas": [ … ] }`, `{ "socio": … }`, `{ "disponibilidad": … }`. Crear responde `201` y el resto `200`.
- **Validación en el servidor**: cada endpoint valida su entrada aunque la web ya lo haga. Los errores de validación llevan en `detalles` un mensaje por campo, y los campos que el endpoint no espera se ignoran.

### Errores

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

### Orden de las comprobaciones

1. Ruta y método (`404`, `405`).
2. Identificación con `x-socio-id` (`401`).
3. Cuerpo legible: JSON válido de 64 KB como máximo (`400`, `413`).
4. Rol de gestor en `/api/gestion` (`403`).
5. Recurso de la URL (`404`).
6. Datos de la petición (`400`).
7. Reglas del dominio (`409`), en el orden de `dominio.md`.

Los permisos que dependen del recurso, como que una reserva sea de quien la pide, se comprueban después de cargarlo. Los recursos que llegan en el cuerpo, como la pista de una reserva, se buscan después de validar los datos.

### Cómo se añade un endpoint

1. Tipos, reglas y códigos de error nuevos en `src/dominio/` (los códigos, en `CodigoError`).
2. El caso de uso en `src/servicios/`: valida la entrada con `validar` y aplica las reglas del dominio. Si actúa el gestor, lo audita, y si el club cambia algo de un socio, le avisa.
3. Una entrada en la tabla de `src/http/rutas.ts` con método, patrón y un manejador fino: comprueba el rol si hace falta, llama al servicio y envuelve el resultado con `ok` o `creado`.
4. Tests del camino feliz y de cada error (ver `testing.md`).
5. Su referencia en este documento, con un ejemplo de petición y de respuesta.

## Endpoints

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

### GET /api/socios/yo

Respuesta `200`:

```json
{ "socio": { "id": "socio-ana", "nombre": "Ana García", "email": "ana.garcia@example.com", "cuotaActiva": true, "rol": "socio", "altaEn": "2026-09-01T10:00" } }
```

### GET /api/pistas y GET /api/pistas/:pistaId

Respuestas `200`, de la lista y de una pista:

```json
{ "pistas": [{ "id": "pista-1", "nombre": "Pista 1", "estado": "operativa" }, …, { "id": "pista-4", "nombre": "Pista 4", "estado": "cerrada" }] }
{ "pista": { "id": "pista-4", "nombre": "Pista 4", "estado": "cerrada" } }
```

Una pista que no existe responde `404 PISTA_NO_ENCONTRADA`.

### GET /api/pistas/:pistaId/disponibilidad?semana=AAAA-MM-DD

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

### POST /api/reservas

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

### GET /api/reservas/mias

Todas las reservas del socio identificado, en cualquier estado y ordenadas por inicio. Respuesta `200`:

```json
{ "reservas": [{ "id": "reserva-ana-1", "socioId": "socio-ana", "pistaId": "pista-1", "inicio": "2026-11-17T18:30", "fin": "2026-11-17T20:00", "estado": "confirmada", "creadaEn": "2026-11-09T12:00" }, …] }
```

### POST /api/gestion/socios

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

### PATCH /api/gestion/pistas/:pistaId

Solo para el gestor. Cuerpo: `{ "estado": "operativa" }` o `{ "estado": "cerrada" }`. Responde `200` con `{ pista }` y se audita como `cambiar_estado_pista` con el estado anterior y el nuevo, también si no cambia. No toca las reservas de la pista.

Errores: `403 SOLO_GESTOR`, `404 PISTA_NO_ENCONTRADA` y `400 DATOS_INVALIDOS` (en `detalles.estado`).
