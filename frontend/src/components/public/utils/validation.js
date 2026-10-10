// Validación en el navegador con los mismos criterios del backend (ARQUITECTURA §7.3).
// Las claves de error son las mismas rutas que usa el backend en details.fields ('buyer.cedula', ...).

export function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

/** Cédula: sin espacios, puntos ni guiones, en mayúsculas. */
export function normalizeCedula(value) {
  return String(value || '').replace(/[\s.\-]/g, '').toUpperCase();
}
export const isValidCedula = (value) => /^[A-Z0-9]{5,15}$/.test(normalizeCedula(value));

/** Celular: solo dígitos, sin el prefijo 57. */
export function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('57')) digits = digits.slice(2);
  return digits;
}
export const isValidPhone = (value) => /^3\d{9}$/.test(normalizePhone(value));

/** Instagram: minúsculas y sin @. Acepta que peguen el enlace del perfil. */
export function normalizeInstagram(value) {
  let s = String(value || '').trim();
  const fromUrl = s.match(/instagram\.com\/([^/?#\s]+)/i);
  if (fromUrl) s = fromUrl[1];
  return s.replace(/^@+/, '').replace(/\s+/g, '').toLowerCase();
}
export const isValidInstagram = (value) => /^[a-z0-9._]{1,30}$/.test(normalizeInstagram(value));

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());

/** "3001234567" → "300 123 4567" (solo para mostrar mientras escriben). */
export function prettyPhone(value) {
  const d = String(value || '').replace(/\D/g, '');
  if (d.length !== 10) return value;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export function validateBuyer(buyer) {
  const errors = {};
  const name = normalizeName(buyer.name);
  if (!name) errors['buyer.name'] = 'Escribe tu nombre completo.';
  else if (name.length < 3) errors['buyer.name'] = 'Tu nombre debe tener al menos 3 letras.';
  else if (name.length > 80) errors['buyer.name'] = 'Máximo 80 caracteres.';

  if (!String(buyer.cedula || '').trim()) errors['buyer.cedula'] = 'Escribe tu número de cédula.';
  else if (!isValidCedula(buyer.cedula)) errors['buyer.cedula'] = 'Revisa tu cédula: entre 5 y 15 números (o letras si es pasaporte).';

  if (!String(buyer.phone || '').trim()) errors['buyer.phone'] = 'Escribe tu celular.';
  else if (!isValidPhone(buyer.phone)) errors['buyer.phone'] = 'Debe ser un celular colombiano de 10 dígitos que empiece por 3.';

  if (String(buyer.instagram || '').trim() && !isValidInstagram(buyer.instagram)) errors['buyer.instagram'] = 'Solo letras, números, puntos y guion bajo (máximo 30).';

  return errors;
}

export function validateCompanions(companions, buyerCedula) {
  const errors = {};
  const own = normalizeCedula(buyerCedula);
  companions.forEach((c, i) => {
    const name = normalizeName(c.name);
    if (!name && !normalizeCedula(c.cedula)) return; // fila vacía: se descarta al continuar
    if (name.length < 2) errors[`companions.${i}.name`] = 'Escribe el nombre (mínimo 2 letras) o quita este acompañante.';
    else if (name.length > 80) errors[`companions.${i}.name`] = 'Máximo 80 caracteres.';
    const ced = normalizeCedula(c.cedula);
    if (ced) {
      if (!isValidCedula(ced)) errors[`companions.${i}.cedula`] = 'Cédula inválida (o déjala vacía).';
      else if (own && ced === own) errors[`companions.${i}.cedula`] = 'Esa es tu cédula; aquí va la del acompañante.';
    }
  });
  return errors;
}

/** Cuerpo de POST /api/public/orders con los valores ya normalizados. */
export function buildOrderPayload({ kind, gender, roomNumber, buyer, companions, paymentMethod }) {
  return {
    kind,
    gender: kind === 'ticket' ? gender : null,
    roomNumber: kind === 'room' ? roomNumber : null,
    buyer: {
      name: normalizeName(buyer.name),
      cedula: normalizeCedula(buyer.cedula),
      phone: normalizePhone(buyer.phone),
      instagram: normalizeInstagram(buyer.instagram),
    },
    companions:
      kind === 'room'
        ? companions
            .filter((c) => normalizeName(c.name))
            .map((c) => {
              const ced = normalizeCedula(c.cedula);
              return ced ? { name: normalizeName(c.name), cedula: ced } : { name: normalizeName(c.name) };
            })
        : [],
    paymentMethod,
    acceptTerms: true,
    acceptData: true,
  };
}
