// Analítica anónima de visitas. NO se guarda IP, user-agent, referrer completo ni nada identificable:
// solo id aleatorio del navegador, ruta normalizada, fuente (derivada) y tipo de dispositivo (derivado).
import { Visit, Order, VISIT_SOURCES } from '../models/index.js';

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|monitor|uptime/i;
export const DEDUPE_MS = 30_000;
const BOGOTA_OFFSET_MS = 5 * 3600_000; // Bogotá = UTC-5 todo el año

export const bogotaDay = (d = new Date()) => new Date(new Date(d).getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const dayStart = (day) => new Date(Date.parse(`${day}T00:00:00Z`) + BOGOTA_OFFSET_MS); // 00:00 Bogotá en UTC

export const isBot = (ua) => BOT_RE.test(String(ua || ''));
export function deviceFromUa(ua) {
  const s = String(ua || '');
  if (/ipad|tablet|playbook|silk/i.test(s) || (/android/i.test(s) && !/mobile/i.test(s))) return 'tablet';
  if (/mobi|iphone|ipod|android|windows phone/i.test(s)) return 'movil';
  return 'escritorio';
}

/** Ruta pública normalizada, o null si debe ignorarse (staff / inválida). */
export function normalizePath(raw) {
  let p = String(raw || '').split('#')[0].split('?')[0].trim();
  if (!p.startsWith('/')) return null;
  p = p.replace(/\/{2,}/g, '/').replace(/(.)\/+$/, '$1').toLowerCase();
  if (p === '/staff' || p.startsWith('/staff/')) return null;
  if (p === '/orden' || p.startsWith('/orden/')) return '/orden';
  if (p === '/entrada' || p.startsWith('/entrada/')) return '/entrada';
  if (!/^\/[a-z0-9/_\-.]{0,59}$/.test(p)) return null;
  return p;
}

const SRC_ALIASES = {
  instagram: 'instagram', ig: 'instagram', wa: 'whatsapp', whatsapp: 'whatsapp', fb: 'facebook', facebook: 'facebook',
  tiktok: 'tiktok', tt: 'tiktok', google: 'google',
};
const HOSTS = [
  [/(^|\.)instagram\.com$/, 'instagram'], [/(^|\.)(wa\.me|whatsapp\.com)$/, 'whatsapp'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'], [/(^|\.)tiktok\.com$/, 'tiktok'], [/(^|\.)google\.[a-z.]+$/, 'google'],
];

/** utm explícito > hostname del referrer > 'directo' (sin referrer) | 'otro'. El referrer se descarta. */
export function deriveSource({ utm, referrer, ownHosts = [] }) {
  const u = SRC_ALIASES[String(utm || '').trim().toLowerCase()];
  if (u) return u;
  if (!referrer) return 'directo';
  let host;
  try { host = new URL(referrer).hostname.toLowerCase(); } catch { return 'otro'; }
  if (ownHosts.includes(host)) return 'directo'; // navegación interna
  for (const [re, name] of HOSTS) if (re.test(host)) return name;
  return 'otro';
}

/** Fábrica del registrador (el anti-spam en memoria vive por app/instancia). */
export function createTracker(ctx) {
  const recent = new Map(); // `${vid} ${path}` -> ms del último registro
  const ownHosts = (ctx.config.frontendOrigins || []).map((o) => { try { return new URL(o).hostname; } catch { return null; } }).filter(Boolean);
  return async function track({ vid, path, referrer, utm }, userAgent) {
    if (isBot(userAgent)) return false;
    const p = normalizePath(path);
    if (!p) return false;
    const now = Date.now();
    const key = `${vid} ${p}`;
    if (now - (recent.get(key) || 0) < DEDUPE_MS) return false;
    recent.set(key, now);
    if (recent.size > 5000) for (const [k, t] of recent) if (now - t >= DEDUPE_MS) recent.delete(k);
    const at = new Date(now);
    await Visit.create({
      at, day: bogotaDay(at), vid, path: p,
      source: deriveSource({ utm, referrer, ownHosts }), device: deviceFromUa(userAgent),
    });
    return true;
  };
}

// ---------- Estadísticas (admin) ----------
const round1 = (n) => Math.round(n * 10) / 10;

export async function visitStats(days = 14) {
  const today = bogotaDay();
  const startDay = addDays(today, -(days - 1));
  const startAt = dayStart(startDay);
  const inRange = { day: { $gte: startDay } };
  const nowMs = Date.now();

  const [perDay, totals, byPage, bySource, byDevice, buyers, v5, v30, orders, paid] = await Promise.all([
    Visit.aggregate([
      { $match: inRange },
      { $group: { _id: { day: '$day', vid: '$vid' }, n: { $sum: 1 } } },
      { $group: { _id: '$_id.day', visitors: { $sum: 1 }, pageviews: { $sum: '$n' } } },
    ]),
    Visit.aggregate([
      { $match: inRange },
      { $group: { _id: '$vid', n: { $sum: 1 }, days: { $addToSet: '$day' } } },
      { $group: { _id: null, visitors: { $sum: 1 }, pageviews: { $sum: '$n' }, returning: { $sum: { $cond: [{ $gt: [{ $size: '$days' }, 1] }, 1, 0] } } } },
    ]),
    Visit.aggregate([
      { $match: inRange },
      { $group: { _id: { path: '$path', vid: '$vid' }, n: { $sum: 1 } } },
      { $group: { _id: '$_id.path', visitors: { $sum: 1 }, pageviews: { $sum: '$n' } } },
      { $sort: { pageviews: -1, visitors: -1, _id: 1 } },
      { $limit: 8 },
    ]),
    // Cada visitante se atribuye a la fuente de su primera visita del rango (así la suma = visitantes únicos).
    Visit.aggregate([
      { $match: inRange }, { $sort: { at: 1 } },
      { $group: { _id: '$vid', source: { $first: '$source' } } },
      { $group: { _id: '$source', visitors: { $sum: 1 } } },
      { $sort: { visitors: -1 } },
    ]),
    Visit.aggregate([
      { $match: inRange }, { $sort: { at: 1 } },
      { $group: { _id: '$vid', device: { $first: '$device' } } },
      { $group: { _id: '$device', visitors: { $sum: 1 } } },
      { $sort: { visitors: -1 } },
    ]),
    Visit.aggregate([{ $match: { ...inRange, path: '/comprar' } }, { $group: { _id: '$vid' } }, { $count: 'n' }]),
    Visit.distinct('vid', { at: { $gte: new Date(nowMs - 5 * 60_000) } }),
    Visit.distinct('vid', { at: { $gte: new Date(nowMs - 30 * 60_000) } }),
    Order.countDocuments({ createdAt: { $gte: startAt }, status: { $ne: 'cancelled' } }),
    Order.countDocuments({ createdAt: { $gte: startAt }, status: 'paid' }),
  ]);

  const dayMap = new Map(perDay.map((d) => [d._id, d]));
  const byDay = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(startDay, i);
    const d = dayMap.get(day);
    byDay.push({ day, visitors: d?.visitors || 0, pageviews: d?.pageviews || 0 });
  }
  const t = totals[0] || { visitors: 0, pageviews: 0, returning: 0 };
  const todayRow = byDay[byDay.length - 1];
  return {
    now: { visitors5m: v5.length, visitors30m: v30.length },
    today: { visitors: todayRow.visitors, pageviews: todayRow.pageviews },
    range: { days, visitors: t.visitors, pageviews: t.pageviews, returning: t.returning },
    byDay,
    byPage: byPage.map((r) => ({ path: r._id, visitors: r.visitors, pageviews: r.pageviews })),
    bySource: bySource.map((r) => ({ source: VISIT_SOURCES.includes(r._id) ? r._id : 'otro', visitors: r.visitors })),
    byDevice: byDevice.map((r) => ({ device: r._id, visitors: r.visitors })),
    funnel: {
      visitors: t.visitors, visitedBuy: buyers[0]?.n || 0, orders, paid,
      conversionPercent: t.visitors ? round1((orders / t.visitors) * 100) : 0,
    },
  };
}
