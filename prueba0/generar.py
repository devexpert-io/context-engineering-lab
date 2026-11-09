"""Genera AGENTS.md sintéticos de N líneas con marcas de control cada 50 líneas.

Uso: python3 generar.py <líneas> <salida>
Cada 50 líneas hay una marca de control con un código aleatorio (KW_ y cuatro
caracteres), y la última línea lleva otra. Como los códigos no siguen ninguna
secuencia, un modelo no puede deducir los que no ha visto: si una marca no
aparece en su respuesta ni en su contexto, el fichero se cortó antes.
Escribe también <salida>.marcas.json con la línea de cada marca.
"""
import json
import random
import string
import sys

PLANTILLAS = [
    "- Antes de tocar {mod}, ejecuta `npm run test -- {mod}` y comprueba que pasa.",
    "- En {mod}, las fechas se guardan en hora local del club y se comparan con los helpers de tiempo.",
    "- No añadas dependencias nuevas en {mod} sin apuntarlo en docs/decisiones.md.",
    "- Los errores de {mod} usan el formato común con `codigo` y `mensaje`.",
    "- Las funciones de {mod} se nombran en español y en camelCase.",
    "- Si cambias la forma de una respuesta de {mod}, actualiza los ejemplos de docs/api.md.",
    "- Las validaciones de {mod} se hacen en el servidor, aunque la interfaz también las haga.",
    "- Cada endpoint nuevo de {mod} necesita un test del camino feliz y otro por cada error.",
    "- En {mod} no se llama a `new Date()`: se usa el reloj inyectado.",
    "- Los mensajes de error de {mod} se escriben para el socio, sin jerga técnica.",
    "- Los identificadores de {mod} son cadenas legibles con prefijo, como `{pref}-0001`.",
    "- No mezcles en un mismo commit cambios de {mod} y de otro módulo.",
    "- Cuando {mod} necesite datos de prueba, se añaden a la semilla y no al test.",
    "- Las consultas de {mod} devuelven como máximo 100 elementos por página.",
    "- Si un cambio en {mod} rompe un test existente, se arregla el código, no el test.",
    "- Cualquier regla de negocio nueva de {mod} se documenta en docs/dominio.md.",
    "- En {mod}, toda acción de un gestor queda registrada en la auditoría.",
    "- Las notificaciones que salen de {mod} usan una plantilla registrada.",
    "- Los importes de {mod} se guardan en céntimos, como enteros.",
    "- Antes de dar por resuelto un fallo de {mod}, revisa sus logs con `npm run logs -- {mod}`.",
    "- {Mod} no importa nada de la capa http: la dependencia va siempre hacia el dominio.",
    "- Las migraciones de datos de {mod} se prueban primero con la semilla completa.",
    "- Si {mod} tarda más de 200 ms en responder en local, abre una tarea de rendimiento.",
    "- Los textos visibles de {mod} usan el glosario: franja, socio y gestor.",
]
MODULOS = ["reservas", "pistas", "socios", "pagos", "torneos", "clases", "notificaciones",
           "auditoría", "informes", "horarios", "tarifas", "inventario", "ligas", "escuela",
           "mantenimiento", "facturación"]


def codigo(n: int) -> str:
    r = random.Random(n * 7919 + 13)
    return "KW_" + "".join(r.choice(string.ascii_uppercase + string.digits) for _ in range(4))


def generar(lineas: int) -> tuple[str, dict]:
    rnd = random.Random(42)
    marcas = {}
    salida = ["# Instrucciones para agentes", "", "Proyecto de reservas de pistas de pádel."]
    modulo = MODULOS[0]
    while len(salida) < lineas - 1:
        n = len(salida) + 1
        if n % 50 == 0:
            marcas[n] = codigo(n)
            salida.append(f"Marca de control: {marcas[n]}")
        elif n % 25 == 1:
            modulo = MODULOS[(n // 25) % len(MODULOS)]
            salida.append(f"## Módulo de {modulo}")
        else:
            p = rnd.choice(PLANTILLAS)
            salida.append(p.format(mod=modulo, Mod=modulo.capitalize(), pref=modulo[:3]))
    marcas[lineas] = codigo(lineas) + "Z"
    salida.append(f"Marca de control: {marcas[lineas]}")
    return "\n".join(salida[:lineas]) + "\n", marcas


if __name__ == "__main__":
    n, destino = int(sys.argv[1]), sys.argv[2]
    texto, marcas = generar(n)
    with open(destino, "w", encoding="utf-8") as f:
        f.write(texto)
    acumulado, posiciones = 0, {}
    for i, linea in enumerate(texto.splitlines(keepends=True), start=1):
        if i in marcas:
            posiciones[marcas[i]] = {"linea": i, "byte": acumulado}
        acumulado += len(linea.encode("utf-8"))
    with open(destino + ".marcas.json", "w", encoding="utf-8") as f:
        json.dump(posiciones, f, indent=1)
    print(f"{destino}: {n} líneas, {len(texto.encode('utf-8'))} bytes")
