# Fiesta de Disfraces Pereira — Arquitectura y reglas

Documento maestro del proyecto. Todo agente o persona que toque el código lo lee primero.
El contrato exacto de la API está en [CONTRATO_API.md](CONTRATO_API.md): es la fuente de verdad entre frontend y backend.

## 1. Qué es

Web para promocionar y vender la fiesta de disfraces del **sábado 31 de octubre de 2026** en una finca en Pereira, más las herramientas internas para operar la noche:

| Módulo | Quién lo usa | Para qué |
|---|---|---|
| Web pública | Asistentes (llegan desde Instagram, en el celular) | Intro, info, mapa de la finca, precios, habitaciones, patrocinadores, compra de entrada, ver su QR |
| Admin | DJ Santech (organizador) | Ver compras y personas registradas, aprobar transferencias, lista de invitados, gastos, ajustes, usuarios, finanzas |
| Portería | Quien recibe gente en la entrada / seguridad | Escanear QR únicos, vender en puerta, registrar vehículos y cascos, ver el aforo |
| Barra | Quien vende en la barra | Punto de venta de cócteles, licores, Gatorade, agua, Electrolit, perfumes; CRUD de productos; cuentas |

## 2. Stack

- `frontend/` → React 19 + Vite + Tailwind CSS v4 + React Router. JavaScript (no TypeScript), ESM. Producción: **Cloudflare Pages**.
- `backend/` → Node + Express 5 + Mongoose + Zod. JavaScript ESM. Producción: **Render** (Web Service). **UptimeRobot** hace ping a `GET /api/health` cada 5 min para que no se duerma.
- Base de datos → **MongoDB**. Local: `mongod` embebido con datos persistentes (mongodb-memory-server) en `mongodb://127.0.0.1:27017/fiesta_disfraces`, al que te conectas con **Compass**. Producción: **MongoDB Atlas** (también conectable con Compass).
- Pagos:
  - **Mercado Pago Checkout Pro** (tarjeta, PSE, etc.): confirmación automática (al volver del checkout + webhook).
  - **Transferencia Nequi / Daviplata** (3135995612 + QR): el comprador sube el pantallazo del comprobante y el admin lo aprueba. No hay API pública de Nequi/Daviplata para verificar solo, así que esto es manual.
  - **Modo simulado**: si no hay `MP_ACCESS_TOKEN` y `NODE_ENV !== 'production'`, Mercado Pago se simula para probar todo el flujo en local.

## 3. Estructura

```
FIESTA_DISFRACES/
├─ package.json            scripts raíz (npm run dev levanta db + api + web)
├─ docs/                   ARQUITECTURA.md, CONTRATO_API.md, mapa-boceto.png
├─ backend/
│  ├─ src/
│  │  ├─ server.js         arranque (conecta Mongo con reintentos, datos base, escucha PORT)
│  │  ├─ app.js            express: middlewares + rutas (exportado para tests)
│  │  ├─ config.js         lectura/validación de variables de entorno
│  │  ├─ models/           Mongoose
│  │  ├─ routes/           public, auth, admin/*, door, bar
│  │  ├─ services/         pricing, orders, tickets, mercadopago, stats, ...
│  │  └─ middleware/       auth (JWT + roles), validate (zod), errors, rate limits
│  ├─ scripts/dev-db.js    MongoDB local persistente (puerto 27017)
│  ├─ scripts/seed-demo.js datos de ejemplo (productos, usuarios puerta/barra, invitados)
│  └─ test/                node --test + supertest + mongodb-memory-server
└─ frontend/
   ├─ public/              _redirects (SPA en Cloudflare), pagos/ (QR de Nequi/Daviplata), sponsors/
   └─ src/
      ├─ App.jsx           rutas (ya definidas, no cambiar sin avisar)
      ├─ index.css         Tailwind v4 + tokens de diseño + efectos
      ├─ config/event.js   textos estáticos del evento (descripción, políticas, patrocinadores, mapa)
      ├─ lib/              api.js, auth.jsx, format.js, labels.js (compartidos)
      ├─ components/ui/    primitivas compartidas (Button, Field, Modal, Toast, ...)
      ├─ components/public/  componentes de la web pública
      ├─ components/staff/   StaffLayout, RequireRole (compartidos del staff)
      └─ pages/
         ├─ public/        Home, Buy, PaymentResult, MockCheckout, OrderStatus, Ticket, Recover, NotFound
         └─ staff/         Login, StaffHome, admin/*, door/*, bar/*
```

## 4. Local

| Servicio | URL |
|---|---|
| Web (Vite) | http://localhost:5173 (proxy `/api` → backend) |
| API | http://localhost:4000 |
| MongoDB local | mongodb://127.0.0.1:27017 (base `fiesta_disfraces`) |

- En desarrollo el frontend llama rutas relativas `/api/...` y Vite las reenvía al backend (sirve también para probar desde el celular en la misma red con `npm run dev:lan`, que usa HTTPS para que la cámara funcione).
- En producción `VITE_API_URL` apunta al backend de Render y el backend permite CORS solo a `FRONTEND_URL`.
- Los datos de Mongo local se guardan fuera de OneDrive (`%USERPROFILE%\.fiesta-disfraces\mongo-data`) para evitar bloqueos de sincronización.

## 5. Convenciones

- **Idioma:** textos de UI y mensajes de error en español de Colombia, tuteando ("Ven disfrazado", "escríbele"). Identificadores de código en inglés. Comentarios breves en español.
- **Dinero:** enteros en pesos colombianos (COP), sin decimales. En UI: `$20.000` (usar `formatCOP`).
- **Fechas:** ISO UTC en la API. En UI siempre en `America/Bogota` (usar `lib/format.js`).
- **IDs:** la API devuelve `id` (string), nunca `_id` ni `__v`.
- **Errores API:** `{ "error": { "code": "CODIGO", "message": "Mensaje listo para mostrar", "details": {...}? } }`.
- **Sin secretos en git:** `.env` está en `.gitignore`; solo se versiona `.env.example`.

## 6. Información oficial del evento (texto fuente)

```
📅 Sábado 31 de octubre
📍 Finca en Pereira (la ubicación se envía el 31)
🎧 Música toda la noche con Diferentes Djs

Ven disfrazado y vive la noche más terrorífica del año: finca, buena música, luces y el mejor ambiente.

🎟️ PREVENTA (hasta el 24)          Mujeres: $20.000   Hombres: $30.000
🎟️ VENTA (en puerta)               Mujeres: $25.000   Hombres: $40.000

🛏️ HABITACIONES (incluyen la entrada) — se alquilan por grupo completo, no por cama:
* Habitación 1 (1 cama doble + 1 sencilla, de 3 a 5 personas): preventa $250.000 · después $300.000
* Habitación 2 (2 camas king, de 4 a 6 personas): preventa $350.000 · después $420.000
* Habitación grande (1 cama doble + 2 sencillas, hasta 7 personas, baño privado): preventa $500.000 · después $600.000
Si quieres ajustar tu grupo o tienes dudas sobre las habitaciones, escríbele al privado al admin DJ Santech.

🚗 PARQUEADERO   Carro: $10.000   Moto: $5.000   Guardado de casco: $5.000

💧 En la finca se venderá hidratación.
⚠️ Solo mayores de edad.
❌ Nos reservamos el derecho de admisión.

📋 POLÍTICA DE DEVOLUCIONES
* Si la fiesta se cancela antes del evento por fuerza mayor (por ejemplo, cancelación de la finca o medidas de las autoridades), se devuelve el 100% del dinero.
* Una vez en la finca, si ocurre algún imprevisto o caso de fuerza mayor durante el evento, no se hacen devoluciones.
* Al comprar tu entrada o habitación aceptas esta política.
```

Patrocinadores (por ahora espacio reservado para el logo, con nombre y enlace): powermixlucesysonido.com, ceoenfragancia.com, vapitosprincys.com, panesypan.com.

Pagos por transferencia: Nequi y Daviplata al **3135995612** + código QR (imagen en `frontend/public/pagos/`).

### Supuestos (configurables, confirmar con el organizador)

- Hora de inicio: 9:00 p. m. (`eventStartsAt` = 2026-10-31T21:00:00-05:00).
- Preventa hasta el sábado 24 de octubre a las 11:59 p. m. (`presaleEndsAt` = 2026-10-24T23:59:59-05:00). Después, la venta en línea sigue con precios de puerta ("venta general").
- Descuento lista de invitados: 25% (redondeado a múltiplos de $500).
- Habitaciones (precio por habitación completa, incluye la entrada de todo el grupo; preventa hasta el 24 oct, luego precio normal): 1 = 1 cama doble + 1 sencilla, 3 a 5 personas, $250.000 / $300.000; 2 = 2 camas king, 4 a 6 personas, $350.000 / $420.000; 3 = grande, 1 cama doble + 2 sencillas, 5 a 7 personas, baño privado, $500.000 / $600.000. Capacidad máxima total = suma real de las habitaciones (5 + 6 + 7 = 18).
- Aforo general: 100 personas (las personas de habitaciones van aparte).
- El círculo pequeño junto a la piscina del boceto se rotula "Piscina pequeña".
- Nombre visible: "Fiesta de Disfraces" con "DJ Santech presenta". Contacto por WhatsApp al 573135995612.

## 7. Reglas de negocio (backend las impone; frontends las reflejan)

1. **Fase y precio.** `fase = 'preventa'` si ahora ≤ `presaleEndsAt`, si no `'general'`. Entrada en línea: preventa → `prices.preventa[genero]`; general → `prices.puerta[genero]`. Puerta usa siempre `prices.puerta`.
2. **Lista de invitados.** Si cédula, celular o Instagram (normalizados) coinciden con un invitado no redimido: descuento = `guest.discountPercent ?? settings.guestDiscountPercent`. `total = redondear_a_500(base × (1 − %/100))`. Solo aplica a entradas (no habitaciones). Se marca redimido cuando la orden queda pagada. En puerta: categoría "invitado" usa el precio de puerta del género con ese descuento.
3. **Normalización.** Cédula: quitar espacios, puntos y guiones, mayúsculas, `^[A-Z0-9]{5,15}$`. Celular: dígitos; quitar prefijo 57; debe quedar en 10 dígitos que empiezan por 3. Instagram: minúsculas, sin `@`, `^[a-z0-9._]{1,30}$`. Placa: mayúsculas sin espacios ni guiones.
4. **Una entrada por cédula.** No se crea orden si ya hay un ticket `valid`/`used` con esa cédula o una orden `in_review` con esa cédula (error `ALREADY_HAS_TICKET`). Nunca se devuelve el token de otra orden en ese error. Si hay una orden `pending_payment` previa de esa cédula, se cancela y se crea la nueva.
5. **Aforo.** `soldOut` cuando (tickets `valid`/`used` de tipo `general`+`cortesia`) + (órdenes `ticket` en `in_review`) ≥ `capacity`. Las habitaciones tienen su propio cupo (suma de la capacidad de las habitaciones, hoy 18).
6. **Habitaciones.** Se compran completas. El precio depende de la fase como las entradas: `preventa` → `presalePrice`; `general` → `price` (el `base` del Breakdown es ese precio). Cada habitación tiene `beds`, `minPeople` (informativo, no bloquea) y `capacity` (máximo; companions ≤ capacity − 1). En bootstrap, las habitaciones sin `presalePrice` (legacy) se migran a los valores por defecto sin tocar su estado de apartado/reserva. Al crear la orden se "aparta" la habitación 60 min (`holdExpiresAt`). Si suben comprobante, queda apartada hasta que el admin decida. Al pagar → `booked`. Al rechazar/expirar → libre. Estados: `available` · `held` (apartada, pago en curso) · `booked` · `blocked` (bloqueada por admin). Una orden de habitación pagada genera **tantos tickets como capacidad** (máximo de personas: 5, 6 o 7): el primero a nombre del comprador, luego los acompañantes que dio, y el resto como "Acompañante N · Hab. X" (el admin puede renombrarlos).
7. **Expiración.** Órdenes `pending_payment`: de habitación 60 min; de entrada 48 h. Si un pago de Mercado Pago llega después de expirar/cancelar, igual se honra (`paid`), salvo que la habitación ya la tenga otra orden → estado `conflict` (el admin resuelve).
8. **Pago confirmado** (`paid`) → se generan los tickets (idempotente: nunca duplicar).
9. **Ticket único.** `token` aleatorio de 24 caracteres (base64url, 18 bytes) + `code` legible `FD-XXXX-XXXX` (Crockford base32, sin I/L/O/U). El **QR codifica la URL** `https://<frontend>/entrada/<token>`. En puerta se acepta el contenido del QR o el código tecleado.
10. **Ingreso de un solo uso.** El check-in marca el ticket `used` de forma atómica; un segundo intento responde "YA INGRESÓ" con hora y quién lo registró. Portería ve nombre + últimos 4 dígitos de la cédula para comparar con el documento físico.
11. **Puerta.** Venta en puerta: nombre + (cédula o celular) + categoría `mujer`/`hombre`/`invitado` (si invitado, también género) + método de pago. Vehículo opcional (carro/moto + placa) y casco opcional (+ ficha). Cobro: entrada + parqueadero + casco. Método `cortesia` → todo en $0. Los que entran con QR pagan solo parqueadero/casco si aplica.
12. **Barra.** Precios desde la base de datos (el cliente solo manda ids y cantidades). Stock opcional por producto: se descuenta, puede quedar negativo y se avisa. Venta `cortesia` → total $0 y se guarda el valor regalado. Ventas anulables (devuelven stock).
13. **Gastos a librar.** El admin registra gastos (pagados o pendientes). El dashboard muestra ingresos totales vs. gastos y el porcentaje de gastos "librados" (cubiertos).

## 8. Roles y acceso

| Rol | Ve | Usuario local de prueba |
|---|---|---|
| `admin` | Todo (admin + portería + barra) | `admin` / `fiesta2026` (de `backend/.env`) |
| `puerta` | Portería | `puerta` / `puerta2026` (seed demo) |
| `barra` | Barra | `barra` / `barra2026` (seed demo) |

Login con usuario/contraseña → JWT (12 h) en `localStorage` (`fd_staff_token`) y header `Authorization: Bearer`. No cookies (frontend y backend quedan en dominios distintos).

## 9. Sistema de diseño

**Concepto:** terror elegante + flyer de club nocturno. Para universitarios: cinematográfico, sobrio, cero infantil. Piensa en póster de cine de terror de autor, neón rojo en la niebla, luces de club.

**Prohibido:** calabazas o fantasmas caricaturescos, fuentes tipo Creepster/Comic, colores pastel, clipart, emojis como decoración de títulos (usar iconos lucide).

**Tipografía** (Google Fonts, ya cargadas en `index.html`):
- `font-display` → **Anton**: titulares en MAYÚSCULAS, grandes, condensados. Overlines con `tracking-[0.3em]` en tamaños chicos.
- `font-serif` → **Cormorant Garamond** itálica: acentos emocionales ("la noche más *terrorífica* del año").
- `font-sans` → **Inter**: texto y UI.

**Colores** (tokens Tailwind v4 en `src/index.css`, usar como `bg-ink`, `text-bone`, `border-blood/40`, etc.):

| Token | Hex | Uso |
|---|---|---|
| `ink` | #07070a | fondo principal |
| `night` | #0d0d12 | secciones alternas |
| `crypt` | #15151c | tarjetas |
| `tomb` | #1e1e27 | inputs, hover de tarjetas |
| `ash` | #2b2b36 | bordes fuertes |
| `bone` | #f2ede4 | texto principal |
| `fog` | #a3a0ad | texto secundario |
| `smoke` | #6e6b78 | texto terciario, placeholders |
| `blood` | #e11d2e | acento principal, CTA |
| `blood-dark` | #9f1020 | estados activos |
| `blood-light` | #ff4d5e | hover, foco |
| `ember` | #ff7a1a | acento cálido (Halloween), destacados |
| `ultra` | #8b5cf6 | luces de club, detalles |
| `toxic` | #22e584 | éxito / QR válido |
| `gold` | #f5c04a | advertencias, VIP |

**Efectos disponibles** (clases en `index.css`): `grain-overlay` (grano de película fijo), `vignette`, `fog-layer`, `text-glow`, `text-glow-ember`, `animate-flicker`, `animate-fog`, `animate-float`, `glass`, `noise-border`. Respetar `prefers-reduced-motion` (ya hay regla global).

**Web pública:** mobile-first (390 px de referencia), CTA principal en `blood` con brillo, mucho aire, secciones con títulos enormes, efectos atmosféricos sutiles, rendimiento alto (sin imágenes pesadas: SVG/CSS).

**Paneles de staff:** mismos tokens pero pragmáticos: sin grano ni niebla, alto contraste, objetivos táctiles ≥ 48 px, legibles de noche y con una mano. Portería: resultados de escaneo a pantalla completa (verde = válido, rojo = usado/inválido), visibles a distancia.

**Componentes compartidos** (`src/components/ui`, importar desde `components/ui`): `Button`, `Field`/`Input`/`Select`/`Textarea`/`Checkbox`, `Segmented`, `Switch`, `Tabs`, `Modal`, `Badge`, `Card`, `Stat`, `Spinner`/`PageSpinner`, `EmptyState`, `ToastProvider`/`useToast`. Iconos: `lucide-react`.

**Utilidades compartidas** (`src/lib`): `api.js` (`api`, `staffApi`, `ApiError`, `downloadFile`, `fetchBlobUrl`, `fieldError`), `auth.jsx` (`useAuth`, `ROLE_HOME`), `format.js` (`formatCOP`, `formatDateTime`, `formatTime`, `maskPhone`, `whatsappLink`, …), `labels.js` (etiquetas de todos los enums), `useFetch.js` (carga de datos con refresco).

## 10. Propiedad de archivos (trabajo en paralelo)

| Dueño | Puede editar | No toca |
|---|---|---|
| Agente Backend | `backend/**` | `frontend/**` |
| Agente Web pública | `frontend/src/pages/public/**`, `frontend/src/components/public/**`, `frontend/src/config/event.js`, `frontend/public/**`, `frontend/scripts/og/**`, `frontend/index.html` (solo `<head>`: title/meta/OG) | lo demás |
| Agente Admin | `frontend/src/pages/staff/admin/**`, `frontend/src/components/staff/admin/**` | lo demás |
| Agente Operaciones | `frontend/src/pages/staff/door/**`, `frontend/src/pages/staff/bar/**`, `frontend/src/components/staff/door/**`, `frontend/src/components/staff/bar/**` | lo demás |
| Orquestador / QA | compartidos: `App.jsx`, `main.jsx`, `index.css`, `lib/**`, `components/ui/**`, `components/staff/*.jsx`, `pages/staff/Login.jsx`, `pages/staff/StaffHome.jsx`, `package.json` | — |

Si un agente necesita cambiar un archivo compartido o agregar una dependencia, no lo hace: lo crea dentro de su carpeta o lo reporta en su informe final.
