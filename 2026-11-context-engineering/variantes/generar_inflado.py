"""Genera variantes/inflado/AGENTS.md a partir del mapa y de los documentos del proyecto.

El AGENTS.md inflado lleva exactamente la misma información que el mapa más
docs/ y CONTEXT.md: el mapa entero y, en lugar de la sección que apunta a los
documentos, los documentos pegados dentro, con sus títulos un nivel más abajo.
Así solo cambia qué se carga siempre y qué se lee cuando hace falta.

Uso: python3 -I generar_inflado.py
"""
import re
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
MAPA = LAB / "variantes" / "mapa" / "AGENTS.md"
DESTINO = LAB / "variantes" / "inflado" / "AGENTS.md"
ORDEN = ["CONTEXT.md", "docs/brief.md", "docs/dominio.md", "docs/api.md", "docs/arquitectura.md",
         "docs/testing.md", "docs/convenciones.md", "docs/operaciones.md", "docs/decisiones.md"]
SECCION_PUNTEROS = "## Qué leer antes de cada tipo de tarea"


TITULOS = {"CONTEXT.md": "Contexto", "brief.md": "Brief", "dominio.md": "Dominio", "api.md": "API",
           "arquitectura.md": "Arquitectura", "testing.md": "Testing", "convenciones.md": "Convenciones",
           "operaciones.md": "Operaciones", "decisiones.md": "Decisiones"}


def bajar_titulos(texto: str) -> str:
    return re.sub(r"^(#{1,5}) ", lambda m: "#" + m.group(1) + " ", texto, flags=re.M)


def apuntar_a_secciones(texto: str) -> str:
    """En el inflado no existen docs/ ni CONTEXT.md: las referencias apuntan a su sección."""
    def cambiar(m):
        return f'la sección "{TITULOS[m.group(2)]}" de este fichero'
    nombres = "|".join(re.escape(n) for n in TITULOS)
    texto = re.sub(rf"`(docs/)?({nombres})`", cambiar, texto)
    texto = texto.replace("actualiza `docs/`", "actualiza la documentación de este fichero")
    return re.sub(r"^docs/\s+documentación del proyecto\n", "", texto, flags=re.M)


def main():
    mapa = MAPA.read_text(encoding="utf-8")
    antes, _, despues = mapa.partition(SECCION_PUNTEROS)
    if not _:
        raise SystemExit(f'el mapa no tiene la sección "{SECCION_PUNTEROS}"')
    resto = despues.split("\n## ", 1)
    siguiente = "\n## " + resto[1] if len(resto) > 1 else ""
    bloques = []
    for ruta in ORDEN:
        texto = (LAB / "app" / ruta).read_text(encoding="utf-8").strip()
        bloques.append(bajar_titulos(texto))
    documentacion = "## Documentación del proyecto\n\n" + "\n\n".join(bloques) + "\n"
    inflado = apuntar_a_secciones(antes.rstrip() + "\n\n" + siguiente.strip() + "\n\n" + documentacion)
    DESTINO.write_text(inflado, encoding="utf-8")
    lineas = inflado.count("\n")
    print(f"{DESTINO}: {lineas} líneas, {len(inflado.encode('utf-8'))} bytes")


if __name__ == "__main__":
    main()
