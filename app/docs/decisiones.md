# Decisiones

Registro de decisiones de producto y arquitectura. Las nuevas se añaden al final, con fecha y motivo. Una decisión no se reescribe: si cambia, se añade otra que la sustituye.

## D-01 · 2026-09-29 · Node sin framework

**Decisión:** `node:http` con un router propio, sin Express ni Fastify.
**Motivo:** la API tiene pocos endpoints y reglas sencillas. Un framework trae dependencias y convenciones que no necesitamos y que cualquiera que llegue al proyecto tendría que aprender. El router propio cubre rutas con parámetros, 404 y 405 en unas 70 líneas.

## D-02 · 2026-09-29 · TypeScript sin compilar

**Decisión:** Node 26 ejecuta los `.ts` quitando los tipos y `tsc --noEmit` solo comprueba tipos.
**Motivo:** sin paso de compilación no hay una carpeta `dist` que se quede desfasada ni configuración de build. El precio es usar solo sintaxis que se pueda borrar e importar con la extensión `.ts`.

## D-03 · 2026-10-02 · Datos en memoria durante el piloto

**Decisión:** repositorio en memoria cargado desde la semilla al arrancar. Sin base de datos hasta después del piloto.
**Motivo:** en un piloto de dos semanas con 30 socios hay que validar las reglas y el flujo, no la persistencia. El repositorio está detrás de la interfaz `Repositorio`, así que cambiarlo por PostgreSQL no toca los servicios. Como es síncrono, tampoco hay carreras entre comprobar una franja y reservarla. Con base de datos, eso tendrá que garantizarlo un índice único.

## D-04 · 2026-10-02 · Hora local del club, sin zonas horarias

**Decisión:** fechas como cadenas ISO sin zona, en hora de Madrid (`"2026-11-20T18:30"`).
**Motivo:** el club está en un solo sitio y socios y gestores piensan en hora local. Con instantes UTC cada comparación obligaría a convertir, y los errores de una hora en los cambios de horario serían fáciles. El club abre de 08:00 a 23:00, así que el cambio de hora, que es de madrugada, nunca cae dentro de una franja. Se acepta que un plazo de 24 horas que cruce un cambio de hora dure 23 o 25 horas reales.

## D-05 · 2026-10-06 · Cabecera x-socio-id en lugar de enlace mágico

**Decisión:** durante el piloto el socio se identifica con la cabecera `x-socio-id`. El enlace mágico por email queda para después.
**Motivo:** el proveedor de email está sin decidir y el piloto se hace con 30 socios conocidos, desde la red del club. La identificación está aislada en `src/http/autenticacion.ts`, así que cambiarla no afecta a rutas ni servicios. No es segura: la API no puede abrirse a internet así.

## D-06 · 2026-10-06 · Franjas fijas de 90 minutos

**Decisión:** franjas de 90 minutos con el mismo horario todos los días, de 08:00 a 23:00.
**Motivo:** es lo que ya hacía el club en la hoja de cálculo y lo que dura un partido normal. Un horario configurable por día o por pista complica la disponibilidad y la validación, y nadie lo ha pedido. Si llega, el punto de partida es `HORARIO` en `src/dominio/tiempo.ts`.

## D-07 · 2026-10-08 · Máximo 2 reservas confirmadas futuras

**Decisión:** un socio no puede tener más de 2 reservas confirmadas que no hayan empezado.
**Motivo:** de 18:30 a 23:00 hay más socios que pistas. Con el límite, nadie acapara la semana y las horas buenas se reparten mejor. Las reservas canceladas, las no presentadas y la que se está jugando no cuentan.

## D-08 · 2026-10-08 · Gestor y no admin

**Decisión:** el rol se llama gestor en el código, la API y la documentación. Es un socio con `rol: "gestor"`, no un tipo de cuenta aparte.
**Motivo:** es el nombre del puesto en el club y lo que entiende todo el mundo allí. "Admin" sugiere permisos técnicos sin límite, y el gestor solo tiene operaciones concretas bajo `/api/gestion`.

## D-09 · 2026-10-14 · Un único tipo de error con código y estado HTTP

**Decisión:** todos los errores esperados son `ErrorDominio`, con código en español, mensaje, estado HTTP y detalles, y solo `respuestaDeError` los convierte en JSON.
**Motivo:** el cliente decide por el código, no por el mensaje. Con el estado HTTP en el propio error no hace falta una tabla de traducción aparte que se desincronice. El dominio sabe así algo de HTTP, pero solo un número.

## D-10 · 2026-10-20 · Reloj inyectado

**Decisión:** la hora actual llega siempre de `reloj.ahora()`. Dominio y servicios no usan `Date`.
**Motivo:** casi todas las reglas dependen de la hora: franja pasada, reservas futuras, plazo de cancelación. Con un reloj fijo, los tests son deterministas y prueban los límites exactos sin esperar.
