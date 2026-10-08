// Login de staff y sesión actual: /api/auth/*
import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { User } from '../models/index.js';
import { AppError } from '../lib/util.js';
import { validate, z } from '../middleware/validate.js';
import { signToken, requireAuth } from '../middleware/http.js';
import { userOut } from '../services/serializers.js';
import { BCRYPT_ROUNDS } from '../services/bootstrap.js';

// Hash de relleno para comparar en tiempo constante cuando el usuario no existe.
let dummyHash;
const getDummy = () => (dummyHash ??= bcrypt.hash(randomBytes(16).toString('hex'), BCRYPT_ROUNDS));

export function authRouter(ctx, limits) {
  const r = express.Router();
  r.post('/login', limits.login, validate({
    body: z.object({ username: z.string().trim().toLowerCase().min(1).max(60), password: z.string().min(1).max(200) }),
  }), async (req, res) => {
    const { username, password } = req.valid.body;
    const user = await User.findOne({ username }).select('+passwordHash').lean();
    const ok = await bcrypt.compare(password, user?.passwordHash || (await getDummy()));
    if (!user || !ok || !user.active) throw new AppError(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
    const updated = await User.findByIdAndUpdate(user._id, { $set: { lastLoginAt: new Date() } }, { returnDocument: 'after' }).lean();
    res.json({ token: signToken(ctx.config, updated), user: userOut(updated) });
  });
  r.get('/me', requireAuth(ctx), (req, res) => res.json({ user: userOut(req.user.doc) }));
  return r;
}
