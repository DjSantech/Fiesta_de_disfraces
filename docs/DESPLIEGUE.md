# Guía de despliegue (paso a paso)

Arquitectura final: **frontend** en Cloudflare Pages, **backend** en Render (free), **base de datos** en MongoDB Atlas (M0), **pagos** con Mercado Pago Colombia y **monitoreo** con UptimeRobot.

Orden recomendado: GitHub → Atlas → Render → Cloudflare → volver a Render a ajustar URLs → Mercado Pago → UptimeRobot.

---

## 1. GitHub

1. Crea un repositorio (puede ser **privado**) y sube el proyecto completo (raíz con `backend/`, `frontend/`, `render.yaml`).
2. Verifica que **ningún `.env`** quede subido: `git status` no debe listar `backend/.env` ni `frontend/.env`.
3. Nota: el bloqueo de Vercel "Hobby no soporta colaboración en repos privados" **no aplica** aquí; Render y Cloudflare Pages funcionan con repos privados en el plan gratis.

## 2. MongoDB Atlas

1. Entra a https://cloud.mongodb.com → **Create** → cluster **M0 (Free)**, región cercana (ej. AWS `us-east-1`).
2. **Database Access** → Add New Database User → usuario y contraseña (usa una contraseña sin caracteres raros como `@ : / #`, o codifícalos en la URI). Rol: *Read and write to any database*.
3. **Network Access** → Add IP Address → `0.0.0.0/0` (Render free no tiene IP fija). La seguridad queda en el usuario/contraseña.
4. **Connect → Drivers** → copia la URI y agrega el nombre de la base:
   `mongodb+srv://USUARIO:CLAVE@cluster0.xxxxx.mongodb.net/fiesta_disfraces?retryWrites=true&w=majority`
5. **Compass**: New Connection → pega la misma URI → Connect. Ahí verás las colecciones cuando el backend arranque.

## 3. Render (backend)

1. https://render.com → entra con GitHub → **New → Blueprint** → elige el repo. Render lee `render.yaml` (rootDir `backend`, `npm ci`, `npm start`, health check `/api/health`).
2. Te pedirá las variables marcadas como secretas. Llénalas:

| Variable | Valor |
|---|---|
| `MONGODB_URI` | La URI de Atlas del paso 2.4 |
| `JWT_SECRET` | 64+ caracteres aleatorios. Genera con: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_URL` | URL de Cloudflare (ej. `https://fiesta-disfraces.pages.dev`). Si aún no la tienes, pon una provisional y cámbiala luego |
| `BACKEND_PUBLIC_URL` | La URL que te da Render (ej. `https://fiesta-disfraces-api.onrender.com`), sin `/` final |
| `ADMIN_USERNAME` | Tu usuario admin |
| `ADMIN_PASSWORD` | Contraseña fuerte (12+ caracteres) |
| `MP_ACCESS_TOKEN` | Access Token de **producción** de Mercado Pago (paso 6) |
| `MP_WEBHOOK_SECRET` | Clave secreta del webhook (paso 6) |

3. Espera el deploy y abre `https://TU-BACKEND.onrender.com/api/health` → debe responder OK.
4. Cada cambio de variables en Render → **Save, rebuild and deploy**.

## 4. Cloudflare Pages (frontend)

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → elige el repo.
2. Configuración:
   - Framework preset: *Vite* (o None)
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - Variable de entorno: `VITE_API_URL` = `https://TU-BACKEND.onrender.com` (sin `/` final)
3. Deploy. `public/_redirects` hace que las rutas del SPA funcionen y `public/_headers` aplica cabeceras de seguridad.
4. **Edita `frontend/public/_headers`**: reemplaza `https://TU-BACKEND.onrender.com` en `connect-src` por tu URL real de Render. Si no, el navegador bloqueará las llamadas a la API.
5. Vuelve a Render y pon en `FRONTEND_URL` la URL final de Cloudflare (o tu dominio propio si lo conectaste en *Custom domains*).

### og:image (vista previa en WhatsApp/redes)
En `frontend/index.html` cambia
`<meta property="og:image" content="/og-image.jpg" />`
por la URL absoluta con el dominio final, ej.
`<meta property="og:image" content="https://fiesta-disfraces.pages.dev/og-image.jpg" />`.
Haz push y prueba el enlace en https://developers.facebook.com/tools/debug/.

## 5. Primer ingreso y usuarios del staff

1. Abre el frontend → login de staff → entra con `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
2. Desde el panel admin crea los usuarios de **puerta** y **barra** (uno por persona, contraseñas distintas).
3. **No ejecutes `seed-demo` en producción**: crea datos falsos en la base real.

## 6. Mercado Pago Colombia

1. https://www.mercadopago.com.co/developers/panel/app → crea una aplicación (Checkout Pro / pagos online).
2. **Credenciales de producción** → copia el *Access Token* (`APP_USR-...`) → `MP_ACCESS_TOKEN` en Render. (Para activar producción, MP pide completar datos del negocio.)
3. **Webhooks** → Configurar notificaciones → modo **Producción**:
   - URL: `https://TU-BACKEND.onrender.com/api/public/payments/mercadopago/webhook`
   - Evento: **Pagos** (`payment`)
   - Guarda y copia la **clave secreta** → `MP_WEBHOOK_SECRET` en Render → redeploy.
4. Prueba: en *Cuentas de prueba* crea un usuario vendedor y uno comprador; usa las credenciales de prueba del vendedor en un entorno de prueba y paga con el comprador y las tarjetas de prueba. Verifica que la boleta pase a pagada (el webhook llegó). Luego vuelve a credenciales de producción y haz una compra real pequeña.
5. Si `MP_ACCESS_TOKEN` queda vacío el backend usa modo simulado: **no lo dejes vacío en producción**.

## 7. UptimeRobot

1. https://uptimerobot.com → Add New Monitor → tipo **HTTP(s)**.
2. URL: `https://TU-BACKEND.onrender.com/api/health`, intervalo **5 minutos**.
3. Agrega tu correo como alerta. Esto además evita que Render free "duerma" el servicio (se duerme tras ~15 min sin tráfico y tarda ~1 min en despertar).

## 8. Checklist antes del evento

- [ ] Probar el **escáner QR en celulares reales** (Android y iPhone) abriendo la URL **HTTPS** (la cámara no funciona en HTTP).
- [ ] Revisar la **señal en la finca**; llevar un **hotspot** / datos de respaldo.
- [ ] **Celulares cargados** y power banks para puerta y barra.
- [ ] Usuarios de puerta/barra creados y probados con login.
- [ ] **Exportar CSV de respaldo** de asistentes/boletas desde el admin la noche anterior y el mismo día antes de abrir.
- [ ] Health check en verde en UptimeRobot el día del evento.
- [ ] **Revelar la ubicación el 31** desde el admin.
- [ ] Hacer una compra real de prueba y anularla/reembolsarla.

## 9. Costos y límites del plan gratis

| Servicio | Costo | Límites relevantes |
|---|---|---|
| Cloudflare Pages | $0 | 500 builds/mes, ancho de banda ilimitado |
| Render free | $0 | 750 h/mes, se duerme tras 15 min sin tráfico (UptimeRobot lo mantiene despierto), 512 MB RAM, arranque lento en frío |
| MongoDB Atlas M0 | $0 | 512 MB de almacenamiento, conexiones limitadas; sin backups automáticos (por eso el CSV) |
| UptimeRobot | $0 | 50 monitores, intervalo mínimo 5 min |
| Mercado Pago | Sin mensualidad | Comisión por transacción según tarifa vigente en Colombia (revisa tu panel) |
| GitHub | $0 | Repos privados ilimitados |

Para un evento de unos cientos de asistentes, el plan gratis alcanza. Si esperas mucho tráfico simultáneo, considera Render Starter (~USD 7/mes) solo durante el mes del evento.
