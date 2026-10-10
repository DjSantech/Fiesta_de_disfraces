# Fiesta de Disfraces · Pereira · 31 de octubre

Web pública (intro, info, mapa, compra con QR único) + panel admin + portería con escáner QR + punto de venta de barra.

- Arquitectura y reglas: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- Contrato de la API: [docs/CONTRATO_API.md](docs/CONTRATO_API.md)
- Subir a producción: [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)

## Correr en local

```bash
npm run install:all     # solo la primera vez
npm run dev             # levanta MongoDB local + API (4000) + web (5173)
npm run seed:demo       # (otra terminal, opcional) usuarios puerta/barra, productos e invitados de ejemplo
```

- Web: http://localhost:5173 · Staff: http://localhost:5173/staff/login
- Usuarios locales: `admin / fiesta2026`, `puerta / puerta2026`, `barra / barra2026` (estos dos tras el seed)
- Compass: `mongodb://127.0.0.1:27017` → base `fiesta_disfraces`
- Sin credenciales de Mercado Pago, el pago con tarjeta se **simula** (pantalla "modo de prueba").
- Probar el escáner desde el celular (misma WiFi): `npm --prefix frontend run dev:lan` y abre la URL `https://<tu-ip>:5173` (acepta el certificado).
- Tests del backend: `npm test`

## Qué personalizar

| Qué | Dónde |
|---|---|
| Logos y QR de Bre-B/Nequi | `frontend/public/pagos/logo-breb.png`, `logo-nequi.png`, `qr-pago.png` |
| Logos de patrocinadores | `frontend/public/sponsors/` + `logo` en `frontend/src/config/event.js` |
| Textos, mapa, FAQ | `frontend/src/config/event.js` |
| Precios, fechas, aforo, cuentas, descuento, ubicación | Panel admin → Ajustes |
| Lista de invitados | Panel admin → Invitados → "Pegar lista" |
