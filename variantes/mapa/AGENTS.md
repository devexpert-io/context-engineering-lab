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

## Qué leer antes de cada tipo de tarea

- Reglas de negocio (reservas, cancelaciones, bloqueos y pistas cerradas): `docs/dominio.md`.
- Endpoints nuevos o cambios en la API: `docs/api.md`, con las convenciones y el orden de las comprobaciones.
- Capas, reloj, tiempo, errores, auditoría y notificaciones: `docs/arquitectura.md`.
- Tests, ayudantes y datos de la semilla: `docs/testing.md`.
- Nombres, códigos de error y estilo: `docs/convenciones.md`.
- Términos del dominio: `CONTEXT.md`.
- Por qué está hecho así: `docs/decisiones.md`. Arranque y problemas frecuentes: `docs/operaciones.md`. Qué es el producto: `docs/brief.md`.

## Reglas para cualquier tarea

- Usa el glosario: franja (nunca turno), socio (nunca usuario) y gestor (nunca admin).
- El dominio y los servicios no llaman a `new Date()` ni a `Date.now()`: usan `reloj.ahora()`.
- Las horas son hora local del club, en cadenas `AAAA-MM-DDTHH:mm` sin zona, y se manejan con los helpers de `src/dominio/tiempo.ts`.
- Los errores se lanzan con `ErrorDominio` y salen como `{ error: { codigo, mensaje, detalles? } }`.
- Toda acción de un gestor se audita y, si afecta a un socio, se le avisa con una notificación.
- La validación se hace siempre en el servidor (`400 DATOS_INVALIDOS`).
- Cada endpoint nuevo lleva tests del camino feliz y de cada error.
- No cambies tests existentes para que pasen: arregla el código.
