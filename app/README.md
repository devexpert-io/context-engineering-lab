# Reservas de pádel

API del club para reservar pistas de pádel en franjas de 90 minutos: los socios consultan la disponibilidad semanal y reservan, y el gestor da de alta socios y abre o cierra pistas. Funciona con Node 26 y TypeScript sin compilar, sin frameworks y con los datos en memoria.

```sh
npm install      # instala typescript y @types/node, solo para comprobar tipos
npm start        # arranca en http://localhost:3000 (el puerto se cambia con PORT)
npm run check    # comprueba tipos y pasa los tests
```

Todas las rutas piden la cabecera `x-socio-id` con el id de un socio de la semilla:

```sh
curl -H "x-socio-id: socio-ana" http://localhost:3000/api/pistas
```
