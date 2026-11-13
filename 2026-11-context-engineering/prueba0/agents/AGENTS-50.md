# Instrucciones para agentes

Proyecto de reservas de pistas de pádel.
- Reservas no importa nada de la capa http: la dependencia va siempre hacia el dominio.
- Los errores de reservas usan el formato común con `codigo` y `mensaje`.
- Antes de tocar reservas, ejecuta `npm run test -- reservas` y comprueba que pasa.
- Los textos visibles de reservas usan el glosario: franja, socio y gestor.
- En reservas no se llama a `new Date()`: se usa el reloj inyectado.
- Cada endpoint nuevo de reservas necesita un test del camino feliz y otro por cada error.
- Cada endpoint nuevo de reservas necesita un test del camino feliz y otro por cada error.
- Las funciones de reservas se nombran en español y en camelCase.
- Los textos visibles de reservas usan el glosario: franja, socio y gestor.
- Los errores de reservas usan el formato común con `codigo` y `mensaje`.
- Las migraciones de datos de reservas se prueban primero con la semilla completa.
- Los textos visibles de reservas usan el glosario: franja, socio y gestor.
- Las notificaciones que salen de reservas usan una plantilla registrada.
- No añadas dependencias nuevas en reservas sin apuntarlo en docs/decisiones.md.
- Los importes de reservas se guardan en céntimos, como enteros.
- Las consultas de reservas devuelven como máximo 100 elementos por página.
- En reservas, las fechas se guardan en hora local del club y se comparan con los helpers de tiempo.
- Antes de tocar reservas, ejecuta `npm run test -- reservas` y comprueba que pasa.
- No añadas dependencias nuevas en reservas sin apuntarlo en docs/decisiones.md.
- Las validaciones de reservas se hacen en el servidor, aunque la interfaz también las haga.
- Cada endpoint nuevo de reservas necesita un test del camino feliz y otro por cada error.
- En reservas, toda acción de un gestor queda registrada en la auditoría.
## Módulo de pistas
- Antes de dar por resuelto un fallo de pistas, revisa sus logs con `npm run logs -- pistas`.
- Antes de tocar pistas, ejecuta `npm run test -- pistas` y comprueba que pasa.
- Las notificaciones que salen de pistas usan una plantilla registrada.
- Las validaciones de pistas se hacen en el servidor, aunque la interfaz también las haga.
- Si pistas tarda más de 200 ms en responder en local, abre una tarea de rendimiento.
- Pistas no importa nada de la capa http: la dependencia va siempre hacia el dominio.
- Si pistas tarda más de 200 ms en responder en local, abre una tarea de rendimiento.
- Las notificaciones que salen de pistas usan una plantilla registrada.
- Las consultas de pistas devuelven como máximo 100 elementos por página.
- Cada endpoint nuevo de pistas necesita un test del camino feliz y otro por cada error.
- Si un cambio en pistas rompe un test existente, se arregla el código, no el test.
- Los importes de pistas se guardan en céntimos, como enteros.
- En pistas no se llama a `new Date()`: se usa el reloj inyectado.
- Antes de tocar pistas, ejecuta `npm run test -- pistas` y comprueba que pasa.
- Si cambias la forma de una respuesta de pistas, actualiza los ejemplos de docs/api.md.
- Si pistas tarda más de 200 ms en responder en local, abre una tarea de rendimiento.
- Las consultas de pistas devuelven como máximo 100 elementos por página.
- Los identificadores de pistas son cadenas legibles con prefijo, como `pis-0001`.
- En pistas no se llama a `new Date()`: se usa el reloj inyectado.
- Las funciones de pistas se nombran en español y en camelCase.
- Las validaciones de pistas se hacen en el servidor, aunque la interfaz también las haga.
- Los identificadores de pistas son cadenas legibles con prefijo, como `pis-0001`.
- Los errores de pistas usan el formato común con `codigo` y `mensaje`.
Marca de control: KW_CSAYZ
