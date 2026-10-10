// Consulta pública "¿estoy en la lista de invitados?". Nunca devuelve datos personales.
import { Guest } from '../models/index.js';
import { collapseSpaces, normalizeCedula, normalizePhone, normalizeInstagram, INSTAGRAM_RE } from '../lib/util.js';
import { getSettings, phaseAt } from './core.js';

const fold = (s) => collapseSpaces(String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
const cap = (w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '');
const EMPTY = { found: false, ambiguous: false, kind: null, discountPercent: null, phase: null, presaleDiscount: 0, generalDiscount: 0, redeemed: false, firstName: null };

export async function guestCheck(query) {
  const q = collapseSpaces(query).replace(/^@\s+/, '@'); // "@ usuario" -> "@usuario"
  const settings = await getSettings();
  let matches = [];
  let ambiguous = false;
  const ig = normalizeInstagram(q);
  const digits = q.replace(/[\s.-]/g, '');
  if (/^\+?\d+$/.test(digits) || /^\d[\d\s.+-]*$/.test(q)) {
    const ced = normalizeCedula(digits);
    const ph = normalizePhone(digits);
    const or = [{ cedula: ced }, { phone: ph }];
    if (INSTAGRAM_RE.test(ig)) or.push({ instagram: ig }); // usuarios de Instagram que son solo números
    matches = await Guest.find({ $or: or }).sort({ createdAt: 1 }).limit(5).lean();
  } else if (!q.includes(' ') && INSTAGRAM_RE.test(ig) && (!/^\d+$/.test(ig) || q.startsWith('@'))) {
    matches = await Guest.find({ instagram: ig }).sort({ createdAt: 1 }).limit(5).lean();
  } else {
    const words = fold(q).split(' ').filter(Boolean);
    if (words.length >= 2 && fold(q).length >= 5) {
      const all = await Guest.find().select('name discountPercent redeemed').lean();
      matches = all.filter((g) => {
        const gw = new Set(fold(g.name).split(' '));
        return words.every((w) => gw.has(w));
      });
      if (matches.length > 1) { ambiguous = true; matches = []; }
    }
  }
  const g = matches[0];
  if (!g) return { ...EMPTY, ambiguous };
  const own = g.discountPercent ?? null;
  return {
    found: true, ambiguous: false, kind: own === 100 ? 'cortesia' : 'descuento', discountPercent: own !== null && own < 100 ? own : null,
    phase: phaseAt(settings), presaleDiscount: settings.guestPresaleDiscount, generalDiscount: settings.guestGeneralDiscount,
    redeemed: !!g.redeemed, firstName: cap(collapseSpaces(g.name).split(' ')[0]) || null,
  };
}
