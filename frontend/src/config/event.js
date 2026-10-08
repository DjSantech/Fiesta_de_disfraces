// Contenido estático del evento. Lo dinámico (precios, fechas, cuentas, habitaciones)
// viene de GET /api/public/config para que el admin lo cambie sin redeploy.
// Todo lo que está aquí es texto editable: cámbialo sin miedo (respeta la forma de los objetos).

export const EVENT = {
  name: 'Fiesta de Disfraces',
  presenter: 'DJ Santech presenta',
  city: 'Pereira',
  venue: 'Finca en Pereira',
  venueNote: 'La ubicación se envía el 31',
  dateLabel: 'Sábado 31 de octubre',
  shortDate: '31·10',
  year: 2026,
  tagline: 'La noche más terrorífica del año',
  music: 'Música toda la noche con diferentes DJs',
  description:
    'Ven disfrazado y vive la noche más terrorífica del año: finca, buena música, luces y el mejor ambiente.',
};

// Patrocinadores: cuando lleguen los logos, ponlos en frontend/public/sponsors/ y llena `logo`
// con la ruta pública, ej. logo: '/sponsors/powermix.png' (ver public/sponsors/LEEME.txt).
export const SPONSORS = [
  { name: 'Powermix Luces y Sonido', url: 'https://powermixlucesysonido.com', logo: null },
  { name: 'CEO en Fragancia', url: 'https://ceoenfragancia.com', logo: null },
  { name: 'Vapitos Princys', url: 'https://vapitosprincys.com', logo: null },
  { name: 'Panes y Pan', url: 'https://panesypan.com', logo: null },
];

/**
 * Respaldo con la forma exacta de GET /api/public/config (CONTRATO_API.md §1) y los valores oficiales.
 * La web pública se pinta con esto mientras el backend (Render) despierta, y se actualiza cuando llega.
 * `phase` y `prices.current` se recalculan en el navegador con la fecha real.
 */
export const FALLBACK_CONFIG = {
  event: {
    startsAt: '2026-11-01T02:00:00.000Z', // sábado 31 de octubre, 9:00 p. m. (Colombia)
    presaleEndsAt: '2026-10-25T04:59:59.000Z', // sábado 24 de octubre, 11:59 p. m. (Colombia)
    phase: 'preventa',
    salesOpen: true,
    soldOut: false,
  },
  prices: {
    preventa: { mujer: 20000, hombre: 30000 },
    puerta: { mujer: 25000, hombre: 40000 },
    current: { mujer: 20000, hombre: 30000 },
  },
  guestDiscountPercent: 25,
  parking: { carro: 10000, moto: 5000, casco: 5000 },
  rooms: [
    { number: 1, name: 'Habitación 1', capacity: 4, price: 250000, privateBathroom: false, status: 'available' },
    { number: 2, name: 'Habitación 2', capacity: 4, price: 250000, privateBathroom: false, status: 'available' },
    { number: 3, name: 'Habitación 3', capacity: 7, price: 500000, privateBathroom: true, status: 'available' },
  ],
  paymentAccounts: [
    { label: 'Nequi', number: '3135995612', holder: '' },
    { label: 'Daviplata', number: '3135995612', holder: '' },
  ],
  transferInstructions:
    'Transfiere el valor exacto y sube el pantallazo del comprobante. Te confirmamos en pocas horas.',
  contact: { whatsapp: '573135995612', instagram: '', adminName: 'DJ Santech' },
  mercadoPago: { enabled: true, mock: false },
  counter: null,
};

// ───────────────────────── Textos de la web pública ─────────────────────────

export const INTRO = {
  presenter: 'DJ Santech presenta',
  titleLines: ['Fiesta de', 'Disfraces'],
  date: '31·10',
  place: 'Pereira',
  tagline: 'La noche más terrorífica del año',
};

/** Pilares de "La noche". `icon` es la clave de un icono de lucide (ver components/public/home/NightSection.jsx). */
export const PILLARS = [
  {
    icon: 'finca',
    title: 'Finca',
    text: 'Una finca en Pereira para nosotros solos. La ubicación exacta te llega el 31, directo en tu entrada.',
  },
  {
    icon: 'djs',
    title: 'DJs toda la noche',
    text: 'Diferentes DJs se turnan la cabina para que la pista no se apague hasta el final.',
  },
  {
    icon: 'luces',
    title: 'Luces',
    text: 'Luces y sonido de club: cuando cae la noche, la finca se transforma.',
  },
  {
    icon: 'ambiente',
    title: 'Ambiente',
    text: 'Disfraces, buena gente y la mejor energía. Ven disfrazado: la noche se vive distinto.',
  },
];

export const GUEST_NOTE =
  '¿Estás en la lista de invitados? Tu descuento se aplica solo al comprar con tu cédula, celular o Instagram.';

export const ROOMS_COPY = {
  includes: 'Incluyen la entrada · se alquilan por grupo completo, no por cama',
  help: '¿Quieres ajustar tu grupo o tienes dudas? Escríbele al admin DJ Santech',
  whatsappText: 'Hola DJ Santech, tengo una pregunta sobre las habitaciones de la Fiesta de Disfraces.',
};

/**
 * Zonas del mapa de la finca (components/public/FincaMap.jsx).
 * Las habitaciones 1, 2 y 3 toman capacidad, precio y estado en vivo de la API; aquí solo va su texto.
 */
export const MAP_ZONES = {
  entrada: {
    name: 'Entrada',
    description: 'Aquí empieza la noche. Ten listo tu QR y tu cédula: seguridad escanea tu entrada y la compara con tu documento.',
  },
  parqueadero: {
    name: 'Parqueadero',
    description: 'Justo al entrar. Se paga al llegar, en la portería.',
  },
  salon: {
    name: 'Salón',
    description: 'La pista principal: DJs toda la noche, luces y sonido de club.',
  },
  jacuzzi: {
    name: 'Piscina pequeña',
    description: 'Junto a la piscina grande, para bajarle al ritmo un rato entre set y set.',
  },
  piscina: {
    name: 'Piscina',
    description: 'La piscina de la finca, el punto más fotogénico de la noche. Disfrútala con responsabilidad.',
  },
  casa: {
    name: 'La casa',
    description: 'Aquí están las habitaciones en alquiler, la sala, la cocina y los baños.',
  },
  room1: {
    name: 'Habitación 1',
    description: 'Habitación para 4 personas, dentro de la casa. Incluye la entrada de todo el grupo.',
  },
  room2: {
    name: 'Habitación 2',
    description: 'Habitación para 4 personas, dentro de la casa. Incluye la entrada de todo el grupo.',
  },
  room3: {
    name: 'Habitación 3',
    description: 'La grande: para 7 personas y con baño privado al lado. Incluye la entrada de todo el grupo.',
  },
  bano3: {
    name: 'Baño privado',
    description: 'Baño privado de la Habitación 3, solo para ese grupo.',
  },
  noDisponible: {
    name: 'No disponible',
    description: 'Esta habitación no se alquila para la fiesta.',
  },
  bano: {
    name: 'Baño',
    description: 'Baño de la casa.',
  },
  sala: {
    name: 'Sala',
    description: 'Zona común de la casa para descansar un rato.',
  },
  cocina: {
    name: 'Cocina',
    description: 'La cocina de la casa.',
  },
};

export const PARKING_NOTE = 'Se paga al llegar, en la portería.';

/** Info importante (texto oficial + detalle práctico). `icon`: hidratacion | edad | admision */
export const IMPORTANT_INFO = [
  { icon: 'hidratacion', title: 'Hidratación', text: 'En la finca se venderá hidratación.' },
  { icon: 'edad', title: 'Solo mayores de edad', text: 'Lleva tu cédula: en la puerta la comparamos con tu entrada.' },
  { icon: 'admision', title: 'Derecho de admisión', text: 'Nos reservamos el derecho de admisión.' },
];

/** Política de devoluciones: texto oficial (ARQUITECTURA §6). No cambiar sin el organizador. */
export const REFUND_POLICY = [
  'Si la fiesta se cancela antes del evento por fuerza mayor (por ejemplo, cancelación de la finca o medidas de las autoridades), se devuelve el 100% del dinero.',
  'Una vez en la finca, si ocurre algún imprevisto o caso de fuerza mayor durante el evento, no se hacen devoluciones.',
  'Al comprar tu entrada o habitación aceptas esta política.',
];

/** Preguntas frecuentes. `link` es opcional: { to, label } (ruta interna). */
export const FAQ = [
  {
    q: '¿Cómo recibo mi entrada?',
    a: 'Apenas se confirme tu pago, tu entrada aparece en pantalla con un QR único y queda guardada en tu enlace personal. Con Mercado Pago la confirmación es automática; con transferencia la revisamos a mano en pocas horas. Descárgala o guarda el enlace.',
  },
  {
    q: 'Perdí mi QR, ¿qué hago?',
    a: 'Tranqui: lo recuperas con tu cédula y el celular que usaste al comprar.',
    link: { to: '/recuperar', label: 'Recuperar mi entrada' },
  },
  {
    q: '¿Qué medios de pago hay?',
    a: 'Mercado Pago (tarjeta, PSE y más), con confirmación automática. O transferencia por Nequi o Daviplata al 313 599 5612: subes el pantallazo del comprobante y te confirmamos.',
  },
  {
    q: '¿Cuándo llega la ubicación?',
    a: 'El 31 de octubre, en tu entrada: abre el enlace de tu entrada y verás la ubicación de la finca con un botón para abrirla en Google Maps.',
  },
  {
    q: '¿Tengo que ir disfrazado?',
    a: 'Es lo recomendado: es una fiesta de disfraces y la noche se vive mucho mejor así.',
  },
  {
    q: '¿Pueden entrar menores de edad?',
    a: 'No. Es un evento solo para mayores de edad y en la puerta te pedimos tu documento. Nos reservamos el derecho de admisión.',
  },
];

export const CELEBRATION = {
  headline: 'OFICIALMENTE ADQUIRISTE TU ENTRADA A LA MEJOR FIESTA DE DISFRACES DE PEREIRA',
  note: 'Guarda este QR: es tu entrada única. Seguridad lo escaneará en la puerta.',
};

export const LEGAL = {
  terms: 'Soy mayor de edad y acepto la política de devoluciones',
  data: 'Autorizo el tratamiento de mis datos personales (Ley 1581 de 2012)',
  dataDetail:
    'Usamos tus datos solo para gestionar tu compra, validar tu ingreso a la fiesta y contactarte si hace falta. No los vendemos ni los compartimos con terceros.',
};

// Cinta que corre bajo el hero. La fase (preventa / venta general) se agrega sola al inicio.
export const MARQUEE = [
  'Finca en Pereira',
  'DJs toda la noche',
  'Ven disfrazado',
  'Solo mayores de edad',
  '31·10',
];
