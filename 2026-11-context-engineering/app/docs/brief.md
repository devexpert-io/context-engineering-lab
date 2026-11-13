# Brief

## Problema

El club gestiona las reservas con un grupo de WhatsApp y una hoja de cálculo compartida. Hay dobles reservas, pistas vacías por cancelaciones que nadie ve y el gestor dedica unas 5 horas a la semana a cuadrar huecos y avisar a socios.

## Usuarios

- **Socios** (unos 300). Reservan sobre todo desde el móvil, a menudo con prisa.
- **Gestores** (una o dos personas del club). Trabajan desde el ordenador de la recepción.

## Objetivos

- Un socio reserva una franja libre en menos de un minuto.
- Cero dobles reservas.
- Una cancelación libera la franja al instante, a la vista de todos.
- El gestor deja de usar la hoja de cálculo y de avisar a mano.

## Qué hace el sistema

Una API HTTP que usará la web responsive del club:

- El socio consulta la disponibilidad semanal de cada pista, reserva franjas y ve sus reservas.
- El socio cancela con al menos 24 horas de antelación. Con menos, solo puede cancelar el gestor.
- El gestor da de alta socios, abre y cierra pistas y las bloquea por mantenimiento.
- El club avisa al socio cuando hace algo que le afecta, como darle de alta o cancelarle una reserva.

## Fuera de alcance

- Pagos online. La cuota se sigue cobrando como hasta ahora y el sistema solo sabe si está activa.
- Torneos, ligas y clases.
- App nativa. El club tendrá una web responsive.
- Lista de espera para franjas ocupadas. Se valorará después del piloto.

## Piloto

Dos semanas con 30 socios y las pistas 1, 2 y 3. La Pista 4 sigue cerrada por obras. Para llegar antes al piloto se aceptan tres simplificaciones (ver `decisiones.md`):

- Los datos viven en memoria y se cargan de la semilla al arrancar.
- El socio se identifica con la cabecera `x-socio-id` en lugar de con un enlace mágico por email.
- Las notificaciones quedan en una bandeja en memoria. Todavía no se envían emails.

El piloto sale bien si no hay ninguna doble reserva y al menos el 80 % de sus reservas se hacen por la web.
