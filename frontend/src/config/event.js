// Contenido estático del evento. Lo dinámico (precios, fechas, cuentas, habitaciones)
// viene de GET /api/public/config para que el admin lo cambie sin redeploy.
// Todo lo que está aquí es texto editable: cámbialo sin miedo (respeta la forma de los objetos).

export const EVENT = {
  name: 'Fiesta de Disfraces',
  presenter: 'DJ Santech presenta',
  city: 'Pereira',
  venue: 'Finca en Pereira',
  venueNote: 'La ubicación exacta se envía el 31',
  dateLabel: 'Sábado 31 de octubre',
  shortDate: '31·10',
  year: 2026,
  tagline: 'La noche más terrorífica del año',
  music: 'Música toda la noche con 3 DJs diferentes',
  description:
    'Ven disfrazado y vive la noche más terrorífica del año: finca, buena música, luces y el mejor ambiente.',
};

// Grupo de WhatsApp de la fiesta (enlace de invitación). Cámbialo aquí si el grupo cambia.
export const WHATSAPP_GROUP = {
  url: 'https://chat.whatsapp.com/C8mWDRiquy367nJTrAweSc',
  label: 'Únete al grupo de WhatsApp',
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
    soldOut: false, // siempre false: el aforo es una meta, no un límite
    goalReached: false,
  },
  prices: {
    preventa: { mujer: 20000, hombre: 30000 },
    puerta: { mujer: 25000, hombre: 40000 },
    current: { mujer: 20000, hombre: 30000 },
  },
  guest: { presaleDiscount: 5000, generalDiscount: 0 },
  parking: { carro: 10000, moto: 5000, casco: 5000 },
  rooms: [
    { number: 1, name: 'Habitación 1', beds: '1 cama doble + 1 sencilla', minPeople: 3, capacity: 5, presalePrice: 250000, price: 300000, currentPrice: 250000, privateBathroom: false, status: 'booked', reserved: true },
    { number: 2, name: 'Habitación 2', beds: 'Camarote de cama sencilla y dos camas king', minPeople: 4, capacity: 6, presalePrice: 350000, price: 420000, currentPrice: 350000, privateBathroom: false, status: 'available' },
    { number: 3, name: 'Habitación 3', beds: 'Camarote de cama sencilla y cama king + 2 colchonetas adicionales', minPeople: 6, capacity: 8, presalePrice: 500000, price: 600000, currentPrice: 500000, privateBathroom: false, status: 'available' },
    { number: 4, name: 'Habitación 4', beds: 'Camarote de cama sencilla + 2 camas sencillas', minPeople: 6, capacity: 8, presalePrice: 500000, price: 600000, currentPrice: 500000, privateBathroom: true, status: 'available' },
  ],
  paymentAccounts: [
    { label: 'Bre-B (llave)', number: '3135995612', holder: '' },
    { label: 'Nequi', number: '3135995612', holder: '' },
  ],
  transferInstructions:
    'Transfiere el valor exacto y sube el pantallazo del comprobante. Te confirmamos en pocas horas.',
  contact: { whatsapp: '573135995612', instagram: '', adminName: 'DJ Santech' },
  mercadoPago: { enabled: true, mock: false },
  jumpscare: true,
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
    title: '3 DJs diferentes',
    text: 'Fiesta crossover: de todo un poco, hasta que el cuerpo aguante.',
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
  '¿Estás en la lista de invitados? Tu precio de amigo cercano se aplica solo al comprar con tu cédula, celular o Instagram.';

export const ROOMS_COPY = {
  includes: 'Incluyen la entrada · se alquilan por grupo completo, no por cama',
  help: '¿Quieres más personas en la habitación o ajustar el precio? Escríbele directamente al admin DJ Santech',
  whatsappText: 'Hola DJ Santech, tengo una pregunta sobre las habitaciones de la Fiesta de Disfraces.',
  whatsappTextFor: (name) => `Hola DJ Santech, quiero más personas en la ${name} o ajustar el precio. ¿Me ayudas?`,
};

/** Fotos por número de habitación (public/habitaciones). */
export const ROOM_PHOTOS = {
  1: [], // sin foto: vendida fuera de la web, solo aparece en el mapa como ocupada
  2: [{ src: '/habitaciones/hab-2.jpg', alt: 'Habitación 2: camarote de cama sencilla y dos camas king' }],
  3: [{ src: '/habitaciones/hab-3.jpg', alt: 'Habitación 3: camarote de cama sencilla y cama king, con colchonetas adicionales' }],
  4: [
    { src: '/habitaciones/hab-4.jpg', alt: 'Habitación 4: camarote de cama sencilla y dos camas sencillas' },
    { src: '/habitaciones/hab-4-bano.jpg', alt: 'Baño privado de la habitación 4', label: 'Baño privado' },
  ],
};

/** Qué incluye tu habitación (íconos lucide en components/public/rooms.jsx). */
export const ROOM_PERKS_TITLE = 'Ventajas de tu habitación';
export const ROOM_PERKS_KICKER = 'Esto es lo que ganas al reservar';

/** Ventajas de reservar habitación. `icon`: ticket | bed | parking | lock | gift | bath. `highlight` la resalta. */
export const ROOM_PERKS = {
  all: [
    { icon: 'ticket', title: 'La entrada viene incluida', text: 'Para todo tu grupo, sin pagar nada más por entrar.' },
    { icon: 'bed', title: 'Dónde dormir y guardar tus cosas', text: 'Descansa si quieres y deja tus cosas seguras mientras disfrutas.' },
    { icon: 'parking', title: 'No pagas parqueadero', text: 'El parqueadero va por cuenta de la habitación.' },
    { icon: 'lock', title: 'Privacidad', text: 'Un espacio solo para tu grupo.' },
    {
      icon: 'gift',
      title: 'Cortesía de la casa',
      text: 'Un cóctel o shot de cortesía por persona, o un vape para todo el grupo.',
      highlight: true,
      badge: 'Cortesía',
    },
  ],
  big: [
    {
      icon: 'bath',
      title: 'Baño privado',
      text: 'Dentro de la habitación, solo para tu grupo.',
      highlight: true,
      badge: 'Solo la habitación 4',
    },
  ],
};

/**
 * Zonas del mapa de la finca (components/public/FincaMap.jsx), según el boceto del organizador.
 * Las habitaciones 1 a 4 toman camas, personas, precio y estado en vivo de la API; aquí solo va su texto.
 * `zonaVerde` y `vista` son anotaciones del paisaje (no son botones).
 */
export const MAP_ZONES = {
  barraCocteles: {
    name: 'Barra de cócteles',
    description: 'Barra de cócteles de la fiesta.',
  },
  dj: {
    name: 'DJ',
    description: 'La cabina: tres DJs diferentes durante la noche.',
  },
  salonJuegos: {
    name: 'Salón de juegos',
    description: 'Salón de juegos de la finca.',
  },
  jacuzzi: {
    name: 'Jacuzzi',
    description: 'El jacuzzi de la finca, junto al salón de juegos. Disfrútalo con responsabilidad.',
  },
  piscina: {
    name: 'Piscina',
    description: 'La piscina de la finca. Disfrútala con responsabilidad.',
  },
  parqueadero: {
    name: 'Parqueadero',
    description: 'Se paga al llegar, en la portería. Cupos limitados: llega temprano.',
  },
  casa: {
    name: 'La casa',
    description: 'Aquí están las habitaciones en alquiler, la sala, el comedor con cocina y los baños.',
  },
  room1: {
    name: 'Habitación 1',
    description: 'Dentro de la casa. Ya está ocupada.',
  },
  room2: {
    name: 'Habitación 2',
    description: 'Dentro de la casa. Incluye la entrada de todo el grupo.',
  },
  room3: {
    name: 'Habitación 3',
    description: 'Dentro de la casa. Incluye la entrada de todo el grupo.',
  },
  room4: {
    name: 'Habitación 4',
    description: 'Dentro de la casa, con baño privado. Incluye la entrada de todo el grupo.',
  },
  bano: {
    name: 'Baño',
    description: 'Baño de la casa.',
  },
  bano2: {
    name: 'Baño',
    description: 'Baño de la casa.',
  },
  sala: {
    name: 'Sala',
    description: 'Zona común de la casa para descansar un rato.',
  },
  comedorCocina: {
    name: 'Comedor y cocina',
    description: 'El comedor con cocina de la casa.',
  },
  zonaVerde: {
    name: 'Zona verde',
    description: 'Zona verde de la finca.',
  },
  vista: {
    name: 'Vista a toda Pereira',
    description: 'Desde la finca se ve toda Pereira.',
  },
};

export const PARKING_NOTE = 'Se paga al llegar, en la portería. Los parqueaderos son limitados: por favor llega temprano.';

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
    a: 'Mercado Pago (tarjeta, PSE y más), con confirmación automática. O transferencia por Bre-B (llave 313 599 5612) o Nequi al mismo número: subes el pantallazo del comprobante y te confirmamos.',
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
  '3 DJs diferentes',
  'Ven disfrazado',
  'Solo mayores de edad',
  '31·10',
];
