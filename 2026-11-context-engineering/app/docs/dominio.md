# Dominio

Reglas del club para socios, pistas, franjas, reservas y bloqueos. Los términos están definidos en `CONTEXT.md`. Todas las horas son hora local del club, sin zona horaria.

## Entidades

| Entidad | Campos | Notas |
|---|---|---|
| Socio | `id`, `nombre`, `email`, `cuotaActiva`, `rol` (`socio` o `gestor`), `altaEn` | El email es único y se guarda en minúsculas. |
| Pista | `id`, `nombre`, `estado` (`operativa` o `cerrada`) | |
| Reserva | `id`, `socioId`, `pistaId`, `inicio`, `fin`, `estado`, `creadaEn` | `fin` es siempre `inicio` más 90 minutos. |
| Franja | `inicio`, `fin` | No se guarda: sale del horario. |
| Bloqueo | `id`, `pistaId`, `inicio`, `fin`, `motivo` | Pendiente de implementar. |

## Horario y franjas

El club abre todos los días de 08:00 a 23:00. Las franjas duran 90 minutos y empiezan a las 08:00, 09:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00 y 21:30, así que la última termina a las 23:00. Una franja **ha empezado** desde el minuto de su inicio: a las 18:30 en punto, la franja de las 18:30 ya ha empezado.

## Disponibilidad

La disponibilidad de una pista se consulta por semanas, de lunes a domingo. Cada franja sale con el primer estado que encaje:

1. `cerrada` si la pista está cerrada.
2. `reservada` si tiene una reserva confirmada.
3. `libre` en cualquier otro caso.

Una reserva cancelada o no presentada no ocupa su franja. La disponibilidad no distingue las franjas pasadas: una franja libre que ya ha empezado sale `libre`, aunque ya no se pueda reservar.

## Reglas de reserva

Un socio reserva una franja indicando la pista y la hora de inicio. Las comprobaciones se hacen en este orden y la primera que falla decide la respuesta:

1. `pistaId` e `inicio` son obligatorios, `inicio` tiene el formato `AAAA-MM-DDTHH:mm` y es el inicio de una franja del horario → `400 DATOS_INVALIDOS`.
2. La pista existe → `404 PISTA_NO_ENCONTRADA`.
3. El socio tiene la cuota activa → `409 CUOTA_INACTIVA`.
4. La franja no ha empezado → `409 FRANJA_PASADA`.
5. La franja está libre: la pista está operativa y nadie tiene una reserva confirmada en ella → `409 FRANJA_NO_DISPONIBLE`.
6. El socio tiene menos de 2 reservas confirmadas futuras → `409 LIMITE_DE_RESERVAS`. Solo cuentan las confirmadas que no han empezado. Las canceladas, las no presentadas y la que se está jugando no cuentan.

La reserva se crea `confirmada`. No hay límite de antelación: se puede reservar en cualquier semana futura.

## Ciclo de vida de una reserva

```
confirmada ──(el socio, con 24 h o más de antelación)───▶ cancelada
confirmada ──(el gestor, antes del inicio)──────────────▶ cancelada
confirmada ──(el gestor, cuando la franja ya ha pasado)─▶ no_presentada
```

Una reserva cancelada o no presentada no vuelve a `confirmada`: si el socio quiere esa franja, la reserva otra vez. Hoy la API solo crea reservas. La cancelación se describe más abajo y marcar una reserva como no presentada todavía no tiene endpoint.

## Pistas cerradas

El gestor cierra o abre una pista en cualquier momento. Cerrar una pista no toca sus reservas: siguen confirmadas y el socio las sigue viendo, pero la disponibilidad muestra todas las franjas de la pista como cerradas. Para dejar una pista sin uso durante un periodo concreto, liberando sus reservas con aviso a los socios, está el bloqueo.

## Política de cancelación

> Pendiente de implementar. Todavía no hay endpoint de cancelación.

El socio puede cancelar su propia reserva confirmada con 24 horas o más de antelación respecto al inicio. Con menos de 24 horas ya no puede (`409 FUERA_DE_PLAZO`) y solo el gestor puede cancelarla, hasta el inicio de la franja. Las 24 horas se cuentan en hora local del club.

Endpoint: `DELETE /api/reservas/:id`. Comprobaciones, en este orden:

1. La reserva existe → `404 RESERVA_NO_ENCONTRADA`.
2. La reserva es de quien cancela, o quien cancela es gestor → `403 NO_ES_TU_RESERVA`.
3. La reserva no está ya cancelada → `409 RESERVA_YA_CANCELADA`.
4. La franja no ha empezado, cancele quien cancele → `409 FRANJA_EMPEZADA`.
5. Si cancela el socio, faltan 24 horas o más para el inicio → `409 FUERA_DE_PLAZO`.

Al cancelar, la franja queda libre al instante. Si cancela el gestor, se audita (`cancelar_reserva`) y se avisa al socio con la plantilla `reserva_cancelada_por_el_club`. Respuesta: `200` con `{ reserva }` en estado `cancelada` y con `canceladaPor`, que vale `"socio"` o `"gestor"`.

## Bloqueos

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
