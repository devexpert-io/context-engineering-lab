---
name: club-padel
description: Opera el sistema de reservas del club de pádel con la CLI padel (pistas, disponibilidad, socios, reservas y cancelaciones). Úsala siempre que haya que consultar o cambiar algo en el sistema del club.
---

# Club de pádel con la CLI `padel`

Sistema de reservas del club de pádel. Las fechas van como AAAA-MM-DD, en la hora local del club. Cada franja dura 90 minutos y empieza a las 09:00, 10:30, 12:00, 13:30, 15:00, 16:30, 18:00, 19:30 o 21:00. Los importes van en céntimos de euro.

La CLI `padel` está en el PATH. Todos los comandos escriben JSON. Los errores salen por stderr con código de salida 1.

## Comandos

- `padel pistas listar`: Lista las pistas del club con su tipo, si son cubiertas, su estado (operativa o cerrada) y su precio por franja en horario valle y punta.
- `padel pistas estado <pista> <estado>`: Cierra o reabre una pista, por obras o mantenimiento. El estado es operativa o cerrada.
- `padel disponibilidad --fecha <fecha> [--pista <pista>]`: Muestra las franjas de un día con su estado (libre, reservada o cerrada) y su precio, de todas las pistas o de una sola.
- `padel socios buscar <texto>`: Busca socios por nombre, email o id. Devuelve su id, que hace falta para reservar, y si tienen la cuota al día.
- `padel reservas listar [--fecha <fecha> | --desde <fecha> --hasta <fecha>] [--socio <socio>] [--pista <pista>] [--estado <estado>] [--limite <n>] [--pagina <n>]`: Lista reservas ordenadas por inicio, con filtros por día o rango de fechas, socio, pista y estado. La respuesta va paginada: como máximo 100 reservas por página (50 por defecto), con el total y el número de páginas. El estado es confirmada, cancelada o no_presentada.
- `padel reservas ver <reserva>`: Devuelve una reserva por su id.
- `padel reservas crear --socio <socio> --pista <pista> --inicio <inicio> [--notas <texto>]`: Crea una reserva para un socio en una pista y una franja. El socio necesita la cuota al día y puede tener como máximo 3 reservas futuras. Devuelve la reserva con su importe. El inicio va como AAAA-MM-DDTHH:MM.
- `padel reservas cancelar <reserva> [--forzar] [--motivo <texto>]`: Cancela una reserva. Es gratis hasta 24 horas antes del inicio. Después devuelve FUERA_DE_PLAZO y solo se puede cancelar con forzar, que cobra una penalización del 100 % del importe: úsalo solo si el socio ha aceptado expresamente la penalización.

## Flujos habituales

- **Reservar:** busca al socio para tener su id, consulta la disponibilidad del día y crea la reserva.
- **Cancelar:** localiza la reserva del socio y cancélala. Si devuelve FUERA_DE_PLAZO, no fuerces sin que el socio haya aceptado la penalización.
- **Informes:** lista las reservas del periodo página a página hasta tener todas.
