# Contexto

Vocabulario del club. El código, la API, los tests y la documentación usan estos términos y no otros.

## Glosario

### Socio

Persona dada de alta en el club. Puede reservar si tiene la cuota activa. Tiene un id (`socio-ana`) y un email que no comparte con ningún otro socio.

### Gestor

Persona del club que da de alta socios, abre y cierra pistas, bloquea pistas y cancela reservas de otros. En el sistema es un socio con el rol `gestor`, así que también puede reservar como cualquier otro.

### Pista

Pista de pádel del club (Pista 1 a Pista 4). Está `operativa` o `cerrada`. En una pista cerrada no se puede reservar ninguna franja.

### Franja

Bloque de 90 minutos en una pista y un día concretos. Es la unidad de reserva. El club abre de 08:00 a 23:00 y las franjas empiezan a las 08:00, 09:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00 y 21:30. Una franja se identifica por su pista y su hora de inicio, y no se guarda: sale del horario.

### Reserva

Franja asignada a un socio. Tiene uno de estos estados:

- `confirmada`: la franja es del socio.
- `cancelada`: la franja vuelve a estar libre. La reserva se conserva como histórico.
- `no_presentada` (no presentada): el socio no vino a jugar. La marca el gestor cuando la franja ya ha pasado.

### Bloqueo

Periodo en el que el gestor deja una pista fuera de uso (mantenimiento, una avería, un evento del club). Tiene inicio, fin y motivo. Las franjas bloqueadas no se pueden reservar.

### Cuota

Pago periódico del socio al club. El sistema solo sabe si está activa o no. Sin cuota activa no se reserva.

### Semana

De lunes a domingo, en hora local del club. La disponibilidad se consulta por semanas.

## Términos descartados

| No usar | Usar | Motivo |
|---|---|---|
| turno | franja | "Turno" se confundía con los turnos del personal del club. |
| usuario | socio | Solo los socios entran en el sistema. "Usuario" no dice si paga cuota ni qué puede hacer. |
| admin, administrador | gestor | Es el nombre del puesto en el club. "Admin" sugiere un perfil técnico con todos los permisos. |
