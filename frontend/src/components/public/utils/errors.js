// Errores del contrato (CONTRATO_API.md §0) → mensajes humanos para la web pública.

const MESSAGES = {
  ALREADY_HAS_TICKET: {
    title: 'Esta cédula ya tiene entrada',
    message:
      'Ya hay una entrada o una compra en revisión con esta cédula. Si es tuya, recupérala con tu cédula y tu celular.',
    action: { to: '/recuperar', label: 'Recuperar mi entrada' },
  },
  SOLD_OUT: {
    title: 'Entradas agotadas',
    message: 'Se llenó el aforo. Escríbele a DJ Santech por si se libera algún cupo.',
  },
  ROOM_UNAVAILABLE: {
    title: 'Esa habitación ya no está libre',
    message: 'Alguien la acaba de apartar o reservar. Elige otra habitación o escríbele al admin.',
  },
  SALES_CLOSED: {
    title: 'Ventas en línea cerradas',
    message: 'Las ventas por la web están cerradas por ahora. Aún puedes comprar en la puerta el día de la fiesta.',
  },
  RATE_LIMITED: {
    title: 'Vas muy rápido',
    message: 'Hicimos demasiados intentos seguidos. Espera un minuto y vuelve a intentar.',
  },
  NETWORK_ERROR: {
    title: 'Sin conexión con el servidor',
    message:
      'No pudimos conectar. Revisa tu internet e intenta de nuevo; si acabas de entrar, el servidor puede tardar unos segundos en despertar.',
  },
  VALIDATION_ERROR: {
    title: 'Revisa tus datos',
    message: 'Hay datos por corregir. Te los marcamos en rojo.',
  },
  PAYMENT_PROVIDER_ERROR: {
    title: 'Mercado Pago no respondió',
    message: 'Intenta de nuevo en un momento o paga por transferencia Bre-B / Nequi.',
  },
  INVALID_STATE: {
    title: 'Esta compra cambió de estado',
    message: 'Recarga la página para ver cómo va tu compra.',
  },
  NOT_FOUND: {
    title: 'No encontramos esto',
    message: 'El enlace no existe o está incompleto. Revisa que lo hayas copiado completo.',
  },
  FILE_TOO_LARGE: {
    title: 'La imagen pesa mucho',
    message: 'El comprobante debe pesar menos de 5 MB. Sube un pantallazo en vez de una foto.',
  },
  UNSUPPORTED_FILE: {
    title: 'Formato no soportado',
    message: 'Sube el comprobante como imagen JPG, PNG o WEBP (un pantallazo funciona perfecto).',
  },
  INTERNAL: {
    title: 'Algo salió mal',
    message: 'Ocurrió un error inesperado de nuestro lado. Intenta de nuevo en un momento.',
  },
};

/** Devuelve { code, title, message, action? } listo para mostrar. */
export function describeError(err) {
  const code = err?.code || 'INTERNAL';
  const known = MESSAGES[code];
  if (known) return { code, ...known };
  return {
    code,
    title: 'Algo salió mal',
    message: err?.message || MESSAGES.INTERNAL.message,
  };
}

export function isRetryable(err) {
  return ['NETWORK_ERROR', 'RATE_LIMITED', 'INTERNAL', 'PAYMENT_PROVIDER_ERROR'].includes(err?.code) || err?.status >= 500;
}
