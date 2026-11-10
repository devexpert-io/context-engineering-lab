---
name: club-padel
description: Opera el sistema de reservas del club de pádel con su API HTTP (pistas, disponibilidad, socios, reservas y cancelaciones). Úsala siempre que haya que consultar o cambiar algo en el sistema del club.
---

# Club de pádel con la API HTTP

Sistema de reservas del club de pádel. Las fechas van como AAAA-MM-DD, en la hora local del club. Cada franja dura 90 minutos y empieza a las 09:00, 10:30, 12:00, 13:30, 15:00, 16:30, 18:00, 19:30 o 21:00. Los importes van en céntimos de euro.

La API está en `{{CLUB_API}}` y se usa con `curl`. Responde siempre JSON. Los errores llevan un código HTTP 4xx y el cuerpo `{"error":{"codigo":"…","mensaje":"…"}}`.

## Endpoints

- `curl -s {{CLUB_API}}/api/pistas`: Lista las pistas del club con su tipo, si son cubiertas, su estado (operativa o cerrada) y su precio por franja en horario valle y punta.
- `curl -s -X PATCH {{CLUB_API}}/api/pistas/<pista> -H 'content-type: application/json' -d '{"estado":"cerrada"}'`: Cierra o reabre una pista, por obras o mantenimiento. El estado es operativa o cerrada.
- `curl -s '{{CLUB_API}}/api/disponibilidad?fecha=<fecha>&pista=<pista>'`: Muestra las franjas de un día con su estado (libre, reservada o cerrada) y su precio, de todas las pistas o de una sola. `pista` es opcional.
- `curl -s '{{CLUB_API}}/api/socios?texto=<texto>'`: Busca socios por nombre, email o id. Devuelve su id, que hace falta para reservar, y si tienen la cuota al día.
- `curl -s '{{CLUB_API}}/api/reservas?fecha=<fecha>'`: Lista reservas ordenadas por inicio, con filtros por día o rango de fechas, socio, pista y estado. La respuesta va paginada: como máximo 100 reservas por página (50 por defecto), con el total y el número de páginas. Parámetros, todos opcionales: `fecha`, o `desde` y `hasta`, `socio`, `pista`, `estado` (confirmada, cancelada o no_presentada), `limite` y `pagina`.
- `curl -s {{CLUB_API}}/api/reservas/<reserva>`: Devuelve una reserva por su id.
- `curl -s -X POST {{CLUB_API}}/api/reservas -H 'content-type: application/json' -d '{"socioId":"<socio>","pistaId":"<pista>","inicio":"<inicio>","notas":"<texto>"}'`: Crea una reserva para un socio en una pista y una franja. El socio necesita la cuota al día y puede tener como máximo 3 reservas futuras. Devuelve la reserva con su importe. El inicio va como AAAA-MM-DDTHH:MM y `notas` es opcional.
- `curl -s -X POST {{CLUB_API}}/api/reservas/<reserva>/cancelar -H 'content-type: application/json' -d '{"forzar":false,"motivo":"<texto>"}'`: Cancela una reserva. Es gratis hasta 24 horas antes del inicio. Después devuelve FUERA_DE_PLAZO y solo se puede cancelar con forzar, que cobra una penalización del 100 % del importe: úsalo solo si el socio ha aceptado expresamente la penalización. `forzar` y `motivo` son opcionales.

## Flujos habituales

- **Reservar:** busca al socio para tener su id, consulta la disponibilidad del día y crea la reserva.
- **Cancelar:** localiza la reserva del socio y cancélala. Si devuelve FUERA_DE_PLAZO, no fuerces sin que el socio haya aceptado la penalización.
- **Informes:** lista las reservas del periodo página a página hasta tener todas.
