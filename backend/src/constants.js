// Enums y constantes del negocio. Fuente: docs/CONTRATO_API.md y docs/ARQUITECTURA.md §6–§7.

export const GENDERS = ['mujer', 'hombre'];
export const ORDER_KINDS = ['ticket', 'room'];
export const ORDER_PAYMENT_METHODS = ['mercadopago', 'transferencia', 'manual'];
export const PUBLIC_PAYMENT_METHODS = ['mercadopago', 'transferencia'];
export const MANUAL_METHODS = ['efectivo', 'nequi', 'daviplata', 'transferencia', 'cortesia'];
export const ORDER_STATUSES = ['pending_payment', 'in_review', 'paid', 'rejected', 'expired', 'cancelled', 'conflict'];
export const TICKET_KINDS = ['general', 'room', 'cortesia'];
export const PHASES = ['preventa', 'general'];
export const TICKET_STATUSES = ['valid', 'used', 'void'];
export const ROOM_STATUSES = ['available', 'held', 'booked', 'blocked'];
export const DOOR_CATEGORIES = ['mujer', 'hombre', 'invitado', 'habitacion', 'cortesia'];
export const DOOR_SALE_CATEGORIES = ['mujer', 'hombre', 'invitado'];
export const POS_METHODS = ['efectivo', 'nequi', 'daviplata', 'tarjeta', 'cortesia'];
export const VEHICLE_TYPES = ['carro', 'moto'];
export const PRODUCT_CATEGORIES = ['cocteles', 'licores', 'cervezas', 'gatorade', 'electrolit', 'agua', 'perfumes', 'otros'];
export const EXPENSE_CATEGORIES = [
  'finca', 'sonido_luces', 'djs', 'bebidas', 'decoracion', 'seguridad', 'publicidad', 'transporte', 'otros',
];
export const ROLES = ['admin', 'puerta', 'barra'];

// Tiempos de vida de las órdenes pendientes (§7.7).
export const ROOM_HOLD_MINUTES = 60;
export const TICKET_ORDER_EXPIRY_HOURS = 48;

// Job periódico: expira órdenes, libera habitaciones y concilia pagos.
export const JOB_INTERVAL_MS = 60_000;
// Cada cuánto se vuelve a consultar en Mercado Pago una orden pendiente (respaldo del webhook).
export const MP_RECONCILE_EVERY_MS = 5 * 60_000;

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export const SETTINGS_ID = 'main';

// Valores por defecto (ARQUITECTURA §6, supuestos confirmables con el organizador).
export const DEFAULT_SETTINGS = Object.freeze({
  eventStartsAt: new Date('2026-10-31T21:00:00-05:00'),
  presaleEndsAt: new Date('2026-10-24T23:59:59-05:00'),
  salesOpen: true,
  capacity: 100,
  prices: {
    preventa: { mujer: 20000, hombre: 30000 },
    puerta: { mujer: 25000, hombre: 40000 },
  },
  guestDiscountPercent: 25,
  parking: { carro: 10000, moto: 5000, casco: 5000 },
  paymentAccounts: [
    { label: 'Nequi', number: '3135995612', holder: '' },
    { label: 'Daviplata', number: '3135995612', holder: '' },
  ],
  transferInstructions:
    'Transfiere el valor exacto y sube el pantallazo del comprobante. Te confirmamos en pocas horas.',
  contact: { whatsapp: '573135995612', instagram: '', adminName: 'DJ Santech' },
  location: { revealed: false, name: '', mapsUrl: '', notes: '' },
  publicCounter: false,
});

export const DEFAULT_ROOMS = Object.freeze([
  { number: 1, name: 'Habitación 1', capacity: 4, price: 250000, privateBathroom: false },
  { number: 2, name: 'Habitación 2', capacity: 4, price: 250000, privateBathroom: false },
  { number: 3, name: 'Habitación 3', capacity: 7, price: 500000, privateBathroom: true },
]);
