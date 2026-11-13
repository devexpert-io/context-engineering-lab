# Operaciones

## Requisitos y arranque

Hace falta Node 26 o posterior, que ejecuta TypeScript sin compilar. `npm install` solo instala `typescript` y `@types/node`, necesarios para comprobar tipos pero no para arrancar.

```sh
npm start                                # http://localhost:3000
PORT=8080 npm start                      # en otro puerto
RELOJ_FIJO=2026-11-16T10:00 npm start    # con la hora congelada, como en los tests
```

Al arrancar se carga la semilla de `src/infra/semilla.ts`. Los datos viven en memoria: al reiniciar se pierde todo lo creado (reservas, altas y cambios de estado de las pistas) y se vuelve a la semilla.

## Variables de entorno

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP. Si no es un puerto válido, el proceso termina con un error. |
| `RELOJ_FIJO` | sin definir | Hora local fija con el formato `AAAA-MM-DDTHH:mm`. Sin ella se usa la hora real de Madrid. |

## Logs

Cada petición deja una línea en la salida estándar con el método, la ruta, el estado, la duración y el id del socio:

```
POST /api/reservas 201 3ms socio=socio-irene
```

Los errores inesperados (`500 ERROR_INTERNO`) escriben la traza completa en la salida de errores. Las notificaciones no aparecen en el log: se quedan en la bandeja en memoria.

## Parada

`Ctrl+C` o `SIGTERM` cierran el servidor: deja de aceptar conexiones y termina las peticiones en curso.

## Problemas frecuentes

- **`EADDRINUSE` al arrancar.** El puerto está ocupado, casi siempre por otra instancia de la API. Párala o usa otro `PORT`.
- **Todo responde `401 NO_AUTENTICADO`.** Falta la cabecera `x-socio-id` o el id no existe. Los ids de la semilla están en `testing.md`, y un socio dado de alta desaparece al reiniciar.
- **Las reservas de la semilla salen en el pasado o en una semana que no es la actual.** La semilla está pensada para el lunes 16 de noviembre de 2026. Arranca con `RELOJ_FIJO=2026-11-16T10:00`.
- **`ERR_UNKNOWN_FILE_EXTENSION` o errores de sintaxis en los `.ts`.** La versión de Node no ejecuta TypeScript. Comprueba `node --version`.
- **`does not provide an export named …` al arrancar.** Un tipo se importa sin `import type` (ver `convenciones.md`). `npm run typecheck` lo detecta.
- **`413 CUERPO_DEMASIADO_GRANDE`.** El cuerpo pasa de 64 KB. Ninguna petición legítima se acerca a ese tamaño.
