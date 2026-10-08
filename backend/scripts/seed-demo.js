// Datos de ejemplo para desarrollo (idempotente). Uso: npm run seed:demo
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { loadConfig } from '../src/config.js';
import { createLogger } from '../src/lib/util.js';
import { User, Product, Guest, Expense } from '../src/models/index.js';
import { ensureBaseData, BCRYPT_ROUNDS } from '../src/services/bootstrap.js';

if (process.env.NODE_ENV === 'production') {
  console.error('✖ seed-demo no se corre en producción.');
  process.exit(1);
}
const config = loadConfig();
const logger = createLogger();
await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
await ensureBaseData(config, logger);

const users = [
  { username: 'puerta', name: 'Portería', role: 'puerta', password: 'puerta2026' },
  { username: 'barra', name: 'Barra', role: 'barra', password: 'barra2026' },
];
for (const u of users) {
  if (await User.exists({ username: u.username })) continue;
  await User.create({ username: u.username, name: u.name, role: u.role, passwordHash: await bcrypt.hash(u.password, BCRYPT_ROUNDS) });
  logger.info(`Usuario ${u.username} creado`);
}

// [nombre, categoría, precio, costo, stock, orden]
const products = [
  ['Cóctel Sangre de Vampiro', 'cocteles', 18000, 7000, null, 1],
  ['Mojito', 'cocteles', 18000, 6500, null, 2],
  ['Margarita', 'cocteles', 20000, 7500, null, 3],
  ['Gin tonic', 'cocteles', 22000, 9000, null, 4],
  ['Shot de aguardiente Cristal', 'licores', 5000, 1800, null, 10],
  ['Media de aguardiente Cristal', 'licores', 50000, 32000, 20, 11],
  ['Botella de aguardiente Cristal', 'licores', 95000, 60000, 10, 12],
  ['Shot de ron', 'licores', 6000, 2200, null, 13],
  ['Media de Ron Viejo de Caldas', 'licores', 55000, 35000, 10, 14],
  ['Cerveza Águila', 'cervezas', 6000, 3000, 96, 20],
  ['Cerveza Club Colombia', 'cervezas', 7000, 3600, 72, 21],
  ['Corona', 'cervezas', 10000, 5500, 24, 22],
  ['Gatorade', 'gatorade', 6000, 3500, 48, 30],
  ['Electrolit', 'electrolit', 9000, 6000, 24, 40],
  ['Agua', 'agua', 3000, 1200, 60, 50],
  ['Perfume CEO en Fragancia dama 30 ml', 'perfumes', 35000, 18000, 6, 60],
  ['Perfume CEO en Fragancia caballero 30 ml', 'perfumes', 35000, 18000, 6, 61],
  ['Red Bull', 'otros', 10000, 6000, 24, 70],
];
for (const [name, category, price, cost, stock, sortOrder] of products) {
  await Product.updateOne({ name, deleted: false }, { $setOnInsert: { name, category, price, cost, stock, sortOrder, active: true } }, { upsert: true });
}

const guests = [
  { name: 'Valentina Ríos', cedula: '1088300111', phone: '3104445566', instagram: 'valen.rios', discountPercent: null, note: '(ejemplo)' },
  { name: 'Camilo Restrepo', cedula: '1093222333', phone: '3157778899', instagram: 'camilo.restrepo', discountPercent: 50, note: '(ejemplo) Amigo del DJ' },
  { name: 'Sara Montoya', cedula: null, phone: null, instagram: 'saramontoya_', discountPercent: null, note: '(ejemplo)' },
];
for (const g of guests) {
  await Guest.updateOne({ name: g.name, note: g.note }, { $setOnInsert: g }, { upsert: true });
}

const expenses = [
  { concept: 'Alquiler de la finca', category: 'finca', amount: 1500000, paid: true, paidAt: new Date(), notes: '(ejemplo)' },
  { concept: 'Sonido y luces Powermix', category: 'sonido_luces', amount: 800000, paid: false, paidAt: null, notes: '(ejemplo)' },
];
for (const x of expenses) {
  await Expense.updateOne({ concept: x.concept, notes: '(ejemplo)' }, { $setOnInsert: x }, { upsert: true });
}

logger.info('Datos de ejemplo listos (puerta/puerta2026, barra/barra2026).');
await mongoose.disconnect();
