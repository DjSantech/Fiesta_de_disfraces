// MongoDB local PERSISTENTE para desarrollo (mongodb-memory-server con dbPath fijo fuera de OneDrive).
// Uso: npm run db   ·   Ctrl+C para cerrar (los datos se conservan).
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { MongoMemoryServer } from 'mongodb-memory-server';

const port = Number(process.env.MONGO_DEV_PORT || 27017);
const dbPath = process.env.MONGO_DEV_DBPATH || path.join(os.homedir(), '.fiesta-disfraces', 'mongo-data');
const version = process.env.MONGOMS_VERSION || '8.2.6';

function portFree(p) {
  return new Promise((resolve) => {
    const s = net.createServer().once('error', () => resolve(false)).once('listening', () => s.close(() => resolve(true)));
    s.listen(p, '127.0.0.1');
  });
}

if (!(await portFree(port))) {
  console.error(`\n✖ El puerto ${port} ya está en uso.\n  ¿Ya tienes "npm run db" abierto en otra terminal o un servicio de MongoDB instalado?\n  Ciérralo o usa otro puerto: MONGO_DEV_PORT=27018 (y ajusta MONGODB_URI).\n`);
  process.exit(1);
}
await mkdir(dbPath, { recursive: true });

let mongod;
try {
  mongod = await MongoMemoryServer.create({
    instance: { port, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger', portGeneration: false },
    binary: { version },
  });
} catch (err) {
  console.error(`\n✖ No se pudo iniciar MongoDB: ${err.message}\n  Si dice "lock", otro mongod usa ${dbPath}.\n`);
  process.exit(1);
}

console.log(`\nMongoDB local listo (v${version}, datos en ${dbPath})`);
console.log(`  URI de la API: mongodb://127.0.0.1:${port}/fiesta_disfraces`);
console.log(`  Compass:       mongodb://127.0.0.1:${port}`);
console.log('  Ctrl+C para cerrar (los datos se conservan).\n');

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  // doCleanup:false → NUNCA borra el dbPath.
  await mongod.stop({ doCleanup: false, force: false }).catch(() => {});
  console.log('MongoDB cerrado. Datos conservados.');
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('SIGBREAK', stop);
