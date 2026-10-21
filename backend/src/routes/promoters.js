// Promotores (venden boletas con su link): registro, login y su panel. /api/promoters/*
import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { Promoter } from '../models/index.js';
import { AppError, isDuplicateKey } from '../lib/util.js';
import { validate, z, text, phone } from '../middleware/validate.js';
import { BCRYPT_ROUNDS } from '../services/bootstrap.js';
import { createPromoter, signPromoterToken, requirePromoter, promoterStats, promoterOut } from '../services/promoters.js';

const password = z.string({ error: 'Escribe una contraseña.' }).min(6, 'La contraseña debe tener al menos 6 caracteres.').max(100, 'Máximo 100 caracteres.');

// Hash de relleno para comparar en tiempo constante cuando el celular no existe.
let dummyHash;
const getDummy = () => (dummyHash ??= bcrypt.hash(randomBytes(16).toString('hex'), BCRYPT_ROUNDS));

const phoneTaken = () => new AppError(409, 'PHONE_TAKEN', 'Ese celular ya está registrado como promotor. Inicia sesión.', { fields: { phone: 'Ese celular ya está registrado.' } });

export function promotersRouter(ctx, limits) {
  const r = express.Router();
  const session = async (p) => {
    const updated = await Promoter.findByIdAndUpdate(p._id, { $set: { lastLoginAt: new Date() } }, { returnDocument: 'after' }).lean();
    return { token: signPromoterToken(ctx.config, updated), promoter: promoterOut(updated) };
  };

  r.post('/register', limits.promoterRegister, validate({
    body: z.object({ name: text(3, 80), phone, password }),
  }), async (req, res) => {
    const { name, phone: p, password: pw } = req.valid.body;
    if (await Promoter.exists({ phone: p })) throw phoneTaken();
    let created;
    try {
      created = await createPromoter({ name, phone: p, passwordHash: await bcrypt.hash(pw, BCRYPT_ROUNDS) });
    } catch (err) {
      if (isDuplicateKey(err, 'phone')) throw phoneTaken();
      throw err;
    }
    res.status(201).json(await session(created));
  });

  r.post('/login', limits.promoterLogin, validate({
    body: z.object({ phone: z.string().max(40), password: z.string().min(1, 'Escribe tu contraseña.').max(200) }),
  }), async (req, res) => {
    const digits = String(req.valid.body.phone).replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, '');
    const p = await Promoter.findOne({ phone: digits }).select('+passwordHash').lean();
    const ok = await bcrypt.compare(req.valid.body.password, p?.passwordHash || (await getDummy()));
    if (!p || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Celular o contraseña incorrectos.');
    if (!p.active) throw new AppError(403, 'PROMOTER_INACTIVE', 'Tu cuenta de promotor está desactivada. Escríbele al admin.');
    res.json(await session(p));
  });

  r.get('/me', requirePromoter(ctx), async (req, res) => {
    res.json({ promoter: promoterOut(req.promoter), stats: await promoterStats(req.promoter) });
  });

  return r;
}
