// Lo que cada puerta le cuenta al agente sobre el sistema. La ayuda de la CLI, las descripciones
// de las tools del servidor MCP y las skills usan estas mismas frases, para que la comparación
// mida la puerta y no lo bien o mal que esté explicada cada una.
export const TEXTOS = {
  sistema:
    "Sistema de reservas del club de pádel. Las fechas van como AAAA-MM-DD, en la hora local del club. " +
    "Cada franja dura 90 minutos y empieza a las 09:00, 10:30, 12:00, 13:30, 15:00, 16:30, 18:00, 19:30 o 21:00. " +
    "Los importes van en céntimos de euro.",
  listarPistas:
    "Lista las pistas del club con su tipo, si son cubiertas, su estado (operativa o cerrada) y su precio por franja en horario valle y punta.",
  cambiarEstadoPista: "Cierra o reabre una pista, por obras o mantenimiento.",
  disponibilidad:
    "Muestra las franjas de un día con su estado (libre, reservada o cerrada) y su precio, de todas las pistas o de una sola.",
  buscarSocios:
    "Busca socios por nombre, email o id. Devuelve su id, que hace falta para reservar, y si tienen la cuota al día.",
  listarReservas:
    "Lista reservas ordenadas por inicio, con filtros por día o rango de fechas, socio, pista y estado. " +
    "La respuesta va paginada: como máximo 100 reservas por página (50 por defecto), con el total y el número de páginas.",
  obtenerReserva: "Devuelve una reserva por su id.",
  crearReserva:
    "Crea una reserva para un socio en una pista y una franja. El socio necesita la cuota al día y puede tener como máximo 3 reservas futuras. " +
    "Devuelve la reserva con su importe.",
  cancelarReserva:
    "Cancela una reserva. Es gratis hasta 24 horas antes del inicio. Después devuelve FUERA_DE_PLAZO y solo se puede cancelar con forzar, " +
    "que cobra una penalización del 100 % del importe: úsalo solo si el socio ha aceptado expresamente la penalización.",
} as const;

export const CAMPOS = {
  fecha: "Día, con el formato AAAA-MM-DD",
  desde: "Primer día del rango, AAAA-MM-DD",
  hasta: "Último día del rango, AAAA-MM-DD",
  pista: "Id de la pista, por ejemplo pista-1",
  socio: "Id del socio, por ejemplo socio-012",
  estadoReserva: "confirmada, cancelada o no_presentada",
  estadoPista: "operativa o cerrada",
  limite: "Reservas por página, de 1 a 100 (50 por defecto)",
  pagina: "Número de página, desde 1",
  inicio: "Inicio de la franja, con el formato AAAA-MM-DDTHH:MM",
  notas: "Notas para recepción",
  reserva: "Id de la reserva, por ejemplo R-0123",
  forzar: "Cancela fuera de plazo con la penalización del 100 %",
  motivo: "Motivo de la cancelación",
  texto: "Nombre, email o id, completo o en parte",
} as const;
