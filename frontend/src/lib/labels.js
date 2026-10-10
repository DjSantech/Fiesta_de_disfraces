// Etiquetas en español para los enums del contrato (docs/CONTRATO_API.md §0).

export const GENDER_LABEL = {
  mujer: 'Mujer',
  hombre: 'Hombre',
};

export const ORDER_KIND_LABEL = {
  ticket: 'Entrada',
  room: 'Habitación',
};

export const ORDER_PAYMENT_METHOD_LABEL = {
  mercadopago: 'Mercado Pago',
  transferencia: 'Transferencia',
  manual: 'Venta manual',
};

export const MANUAL_METHOD_LABEL = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  breb: 'Bre-B',
  transferencia: 'Transferencia',
  cortesia: 'Cortesía',
};

export const ORDER_STATUS_LABEL = {
  pending_payment: 'Pendiente de pago',
  in_review: 'En revisión',
  paid: 'Pagada',
  rejected: 'Rechazada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
  conflict: 'Conflicto',
};

/** Tono de Badge sugerido por estado de orden */
export const ORDER_STATUS_TONE = {
  pending_payment: 'amber',
  in_review: 'violet',
  paid: 'green',
  rejected: 'red',
  expired: 'neutral',
  cancelled: 'neutral',
  conflict: 'orange',
};

export const TICKET_KIND_LABEL = {
  general: 'General',
  room: 'Habitación',
  cortesia: 'Cortesía',
};

export const PHASE_LABEL = {
  preventa: 'Preventa',
  general: 'Venta general',
};

export const TICKET_STATUS_LABEL = {
  valid: 'Válida',
  used: 'Ya ingresó',
  void: 'Anulada',
};

export const TICKET_STATUS_TONE = {
  valid: 'green',
  used: 'violet',
  void: 'red',
};

export const ROOM_STATUS_LABEL = {
  available: 'Disponible',
  held: 'Apartada',
  booked: 'Reservada',
  blocked: 'No disponible',
};

export const DOOR_CATEGORY_LABEL = {
  mujer: 'Mujer',
  hombre: 'Hombre',
  invitado: 'Invitado',
  habitacion: 'Habitación',
  cortesia: 'Cortesía',
};

export const POS_METHOD_LABEL = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  breb: 'Bre-B',
  tarjeta: 'Tarjeta',
  cortesia: 'Cortesía',
};

export const VEHICLE_LABEL = {
  carro: 'Carro',
  moto: 'Moto',
};

export const PRODUCT_CATEGORY_LABEL = {
  cocteles: 'Cócteles',
  licores: 'Licores',
  cervezas: 'Cervezas',
  gatorade: 'Gatorade',
  electrolit: 'Electrolit',
  agua: 'Agua',
  perfumes: 'Perfumes',
  otros: 'Otros',
};

export const EXPENSE_CATEGORY_LABEL = {
  finca: 'Finca / alquiler',
  sonido_luces: 'Sonido y luces',
  djs: 'DJs',
  bebidas: 'Bebidas / barra',
  decoracion: 'Decoración',
  seguridad: 'Seguridad / logística',
  publicidad: 'Publicidad',
  transporte: 'Transporte',
  otros: 'Otros',
};

export const ROLE_LABEL = {
  admin: 'Administrador',
  puerta: 'Portería',
  barra: 'Barra',
};

/** Convierte un mapa de etiquetas en opciones [{ value, label }] para Select/Segmented */
export function toOptions(labelMap) {
  return Object.entries(labelMap).map(([value, label]) => ({ value, label }));
}
