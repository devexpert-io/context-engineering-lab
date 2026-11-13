# Convenciones

## Nombres

- El dominio se escribe en español: tipos, funciones, variables, mensajes de error y nombres de tests (`diasDeLaSemana`, `reservar`, `ErrorDominio`). Se usan los términos de `CONTEXT.md` y nunca los descartados.
- Los identificadores van sin tildes ni eñes (`anio`, `senal`, `diasDeLaSemana`). Los textos para personas, como mensajes y nombres de tests, sí las llevan.
- camelCase para funciones y variables, PascalCase para tipos e interfaces y mayúsculas con guiones bajos para las constantes de módulo (`MAXIMO_RESERVAS_FUTURAS`).
- Las funciones que construyen algo se llaman `crearX`: `crearServicioReservas`, `crearRelojFijo`.
- Ficheros en minúsculas y en español: `disponibilidad.ts`, `gestion-pistas.test.ts`.

## Códigos y datos

- Los códigos de error van en español y en mayúsculas con guiones bajos (`FRANJA_NO_DISPONIBLE`). Todos están en el tipo `CodigoError` de `src/dominio/errores.ts`, y uno nuevo se añade ahí y en la tabla de `api.md`.
- Las acciones de auditoría y las plantillas de notificación van en snake_case: `alta_socio`, `bienvenida`.
- Los campos JSON van en camelCase, igual que en los tipos (`cuotaActiva`, `pistaId`), y los estados, en minúsculas (`confirmada`, `no_presentada`, `operativa`).

## TypeScript

- Node ejecuta los `.ts` quitando los tipos, así que solo vale sintaxis que se pueda borrar: nada de `enum`, `namespace` ni parameter properties (`constructor(private reloj: Reloj)`). Para conjuntos de valores se usan uniones de literales o `as const`.
- Los imports relativos llevan la extensión `.ts`. Lo que solo es un tipo se importa con `import type` o con `type` dentro de las llaves. Si no, Node busca en ejecución algo que no existe.
- Sin `export default`: todo se exporta con nombre.
- Modo `strict`. `any` solo en los tests, para el JSON de las respuestas.
- Fábricas que devuelven objetos en lugar de clases. La única clase es `ErrorDominio`.

## Estilo

- Dos espacios, comillas dobles, punto y coma y coma final en listas de varias líneas.
- Líneas de 100 columnas como máximo, salvo nombres de tests largos.
- Funciones pequeñas con nombres que digan qué hacen. Comentarios solo para explicar lo que el código no cuenta, como el porqué de algo poco evidente.
- Ni código comentado, ni `console.log` de depuración, ni TODOs. Lo que queda pendiente se apunta en la documentación.

## Commits

- Pequeños, con un solo propósito y con `npm run check` en verde.
- Mensaje en español y en minúscula, con el área delante: `reservas: las canceladas no cuentan para el límite`.
- Si el cambio toca una regla, la API o la forma de probar, el mismo commit actualiza `docs/`.
