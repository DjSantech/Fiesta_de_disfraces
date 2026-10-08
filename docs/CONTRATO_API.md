# Contrato de la API — Fiesta de Disfraces Pereira

Fuente de verdad entre `frontend/` y `backend/`. Si algo no está aquí, no existe. Si hace falta cambiarlo, lo cambia el orquestador.

## 0. Generalidades

- Base: `/api`. En local el frontend llama rutas relativas (`/api/...`, Vite hace proxy a `http://localhost:4000`). En producción `VITE_API_URL` + ruta.
- JSON en ambos sentidos (excepto subida de comprobante: `multipart/form-data`; y descargas CSV/imagen).
- Auth de staff: header `Authorization: Bearer <jwt>`. Rutas `/api/admin/*` → rol `admin`. `/api/door/*` → `puerta` o `admin`. `/api/bar/*` → `barra` o `admin`.
- Dinero: enteros COP. Fechas: strings ISO 8601 UTC. IDs: `id` string.
- Listas paginadas: query `page` (desde 1, defecto 1), `limit` (defecto 50, máx 200). Respuesta `{ "items": [...], "total": 123, "page": 1, "limit": 50 }`.
- Búsqueda `q`: sin distinguir mayúsculas, sobre nombre, cédula, celular, Instagram, código de ticket o placa según el recurso (regex escapado).

### Errores

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Revisa los datos marcados.", "details": { "fields": { "buyer.cedula": "Cédula inválida" } } } }
```

| HTTP | code | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query inválido. `details.fields` = mapa `ruta.del.campo` → mensaje en español |
| 401 | `UNAUTHORIZED` | Falta token, token vencido o credenciales malas (`INVALID_CREDENTIALS` en login) |
| 403 | `FORBIDDEN` | Rol sin permiso |
| 403 | `SALES_CLOSED` | Ventas en línea cerradas |
| 404 | `NOT_FOUND` | Recurso no existe (o token inválido) |
| 409 | `ALREADY_HAS_TICKET` | Esa cédula ya tiene entrada o una compra en revisión |
| 409 | `SOLD_OUT` | Aforo completo |
| 409 | `ROOM_UNAVAILABLE` | Habitación apartada, reservada o bloqueada |
| 409 | `INVALID_STATE` | Transición no permitida (ej. aprobar una orden ya pagada) |
| 409 | `TICKET_ALREADY_USED` | Check-in de un ticket ya usado. `details: { checkedInAt, checkedInByName }` |
| 409 | `TICKET_VOID` | Ticket anulado |
| 409 | `USERNAME_TAKEN` | Usuario de staff repetido |
| 413 | `FILE_TOO_LARGE` | Comprobante > 5 MB |
| 415 | `UNSUPPORTED_FILE` | Comprobante que no es jpg/png/webp |
| 429 | `RATE_LIMITED` | Demasiadas solicitudes |
| 502 | `PAYMENT_PROVIDER_ERROR` | Falla hablando con Mercado Pago |
| 500 | `INTERNAL` | Error inesperado (mensaje genérico, sin stack) |

### Enums

| Nombre | Valores |
|---|---|
| `gender` | `mujer`, `hombre` |
| `orderKind` | `ticket`, `room` |
| `orderPaymentMethod` | `mercadopago`, `transferencia`, `manual` |
| `manualMethod` | `efectivo`, `nequi`, `daviplata`, `transferencia`, `cortesia` |
| `orderStatus` | `pending_payment`, `in_review`, `paid`, `rejected`, `expired`, `cancelled`, `conflict` |
| `ticketKind` | `general`, `room`, `cortesia` |
| `phase` | `preventa`, `general` |
| `ticketStatus` | `valid`, `used`, `void` |
| `roomStatus` | `available`, `held`, `booked`, `blocked` |
| `doorCategory` | `mujer`, `hombre`, `invitado`, `habitacion`, `cortesia` |
| `posMethod` (puerta y barra) | `efectivo`, `nequi`, `daviplata`, `tarjeta`, `cortesia` |
| `vehicleType` | `carro`, `moto` |
| `productCategory` | `cocteles`, `licores`, `cervezas`, `gatorade`, `electrolit`, `agua`, `perfumes`, `otros` |
| `expenseCategory` | `finca`, `sonido_luces`, `djs`, `bebidas`, `decoracion`, `seguridad`, `publicidad`, `transporte`, `otros` |
| `role` | `admin`, `puerta`, `barra` |

Etiquetas en español para todos los enums: `frontend/src/lib/labels.js`.

### Objetos compartidos

**Breakdown** (desglose de precio)
```json
{ "phase": "preventa", "base": 30000, "isGuest": true, "discountPercent": 25, "discount": 7500, "total": 22500 }
```
En habitaciones: `base` = precio de la habitación, `isGuest: false`, `discountPercent: 0`, `discount: 0`.

**TicketPublic**
```json
{
  "token": "Qm9vZ2V5bWFuLXRva2VuLTEyMw",
  "code": "FD-7KQ2-M9X4",
  "holderName": "Laura Gómez",
  "kind": "general",
  "gender": "mujer",
  "phase": "preventa",
  "isGuest": false,
  "roomNumber": null,
  "status": "valid",
  "checkedInAt": null
}
```
`gender` y `phase` pueden ser `null` (acompañantes de habitación, cortesías). `roomNumber` solo en `kind: "room"`.

**OrderPublic**
```json
{
  "token": "b3JkZXItdG9rZW4tZXhhbXBsZQ",
  "kind": "ticket",
  "status": "pending_payment",
  "paymentMethod": "transferencia",
  "amount": 20000,
  "breakdown": { "phase": "preventa", "base": 20000, "isGuest": false, "discountPercent": 0, "discount": 0, "total": 20000 },
  "gender": "mujer",
  "room": null,
  "buyer": { "name": "Laura Gómez", "instagram": "lauragomez", "phoneMasked": "300•••4567" },
  "companionsCount": 0,
  "holdExpiresAt": null,
  "receiptUploaded": false,
  "transferReference": null,
  "mpStatus": null,
  "rejectReason": null,
  "createdAt": "2026-10-08T18:00:00.000Z",
  "paidAt": null,
  "tickets": []
}
```
- `room` en órdenes de habitación: `{ "number": 3, "name": "Habitación 3", "capacity": 7, "minPeople": 5, "beds": "1 cama doble + 2 sencillas", "privateBathroom": true }`.
- `mpStatus`: último estado de Mercado Pago visto (`approved`, `rejected`, `in_process`, `pending`, `cancelled`) o `null`.
- `tickets`: solo con `status: "paid"` (array de TicketPublic); vacío en otro caso.

---

## 1. Públicas (sin auth)

### `GET /api/health`
`200 { "ok": true, "db": "up", "time": "..." }` (si Mongo cae: `503 { "ok": false, "db": "down" }`). Para UptimeRobot. También `GET /` responde texto plano.

### `GET /api/public/config`
```json
{
  "event": {
    "startsAt": "2026-11-01T02:00:00.000Z",
    "presaleEndsAt": "2026-10-25T04:59:59.000Z",
    "phase": "preventa",
    "salesOpen": true,
    "soldOut": false
  },
  "prices": {
    "preventa": { "mujer": 20000, "hombre": 30000 },
    "puerta": { "mujer": 25000, "hombre": 40000 },
    "current": { "mujer": 20000, "hombre": 30000 }
  },
  "guestDiscountPercent": 25,
  "parking": { "carro": 10000, "moto": 5000, "casco": 5000 },
  "rooms": [
    { "number": 1, "name": "Habitación 1", "capacity": 5, "minPeople": 3, "price": 300000, "presalePrice": 250000, "currentPrice": 250000, "beds": "1 cama doble + 1 sencilla", "privateBathroom": false, "status": "available" },
    { "number": 2, "name": "Habitación 2", "capacity": 6, "minPeople": 4, "price": 420000, "presalePrice": 350000, "currentPrice": 350000, "beds": "2 camas king", "privateBathroom": false, "status": "available" },
    { "number": 3, "name": "Habitación 3", "capacity": 7, "minPeople": 5, "price": 600000, "presalePrice": 500000, "currentPrice": 500000, "beds": "1 cama doble + 2 sencillas", "privateBathroom": true, "status": "booked" }
  ],
  "paymentAccounts": [
    { "label": "Nequi", "number": "3135995612", "holder": "" },
    { "label": "Daviplata", "number": "3135995612", "holder": "" }
  ],
  "transferInstructions": "Transfiere el valor exacto y sube el pantallazo del comprobante. Te confirmamos en pocas horas.",
  "contact": { "whatsapp": "573135995612", "instagram": "", "adminName": "DJ Santech" },
  "mercadoPago": { "enabled": true, "mock": true },
  "counter": null
}
```
- `counter`: `null` salvo que el admin active `publicCounter` → `{ "capacity": 100, "sold": 37, "remaining": 63 }`.
- `mercadoPago.enabled`: hay credenciales o está en modo simulado. `mock`: modo simulado activo.

### `POST /api/public/quote`
Calcula el precio antes de comprar (muestra el descuento de invitado). Rate limit 30/min/IP.
```json
{ "kind": "ticket", "gender": "hombre", "cedula": "1088123456", "phone": "3001234567", "instagram": "@juan" }
{ "kind": "room", "roomNumber": 3 }
```
`200 { "breakdown": Breakdown, "available": true, "reason": null }`. Para habitaciones el `base` es `presalePrice` en fase `preventa` y `price` en `general`.
Si no se puede comprar: `available: false` y `reason` ∈ `SOLD_OUT`, `ROOM_UNAVAILABLE`, `SALES_CLOSED` (igual devuelve breakdown).

### `POST /api/public/orders`
Crea la compra. Rate limit 10/min/IP.
```json
{
  "kind": "ticket",
  "gender": "mujer",
  "roomNumber": null,
  "buyer": { "name": "Laura Gómez", "cedula": "1088123456", "phone": "3001234567", "instagram": "@lauragomez", "email": "" },
  "companions": [],
  "paymentMethod": "transferencia",
  "acceptTerms": true,
  "acceptData": true
}
```
Validación: `name` 3–80; `cedula`, `phone`, `instagram` obligatorios (ver normalización en ARQUITECTURA §7.3); `email` opcional (si viene, válido); `gender` obligatorio si `kind=ticket`; `roomNumber` obligatorio si `kind=room`; `companions` solo en habitación, máx. `capacity − 1`, cada uno `{ name (2–80), cedula? }`; `acceptTerms` y `acceptData` deben ser `true` (mayor de edad + política de devoluciones; tratamiento de datos Ley 1581 de 2012).

`201`
```json
{ "order": OrderPublic, "checkoutUrl": "https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=..." }
```
`checkoutUrl` solo si `paymentMethod = "mercadopago"` (en modo simulado: `http://localhost:5173/pago/simulado?orden=<token>`). En transferencia es `null`.

Errores: `VALIDATION_ERROR`, `SALES_CLOSED`, `SOLD_OUT`, `ROOM_UNAVAILABLE`, `ALREADY_HAS_TICKET`, `PAYMENT_PROVIDER_ERROR`.

### `GET /api/public/orders/:token`
`200 { "order": OrderPublic }` · `404` si no existe.

### `POST /api/public/orders/:token/pay`
Reintentar o cambiar el método de una orden `pending_payment` (también `expired` si es de entrada y aún hay cupo).
```json
{ "paymentMethod": "mercadopago" }
```
`200 { "order": OrderPublic, "checkoutUrl": "..." | null }` · `409 INVALID_STATE` si no está pendiente.

### `POST /api/public/orders/:token/receipt`
`multipart/form-data`: `file` (jpg/png/webp, ≤ 5 MB — el frontend lo comprime antes) + `reference` opcional (≤ 60, número de transacción). Solo órdenes `transferencia` en `pending_payment` o `in_review` (se puede reemplazar). Pasa a `in_review`. Rate limit 10/10min/IP.
`200 { "order": OrderPublic }`

### `POST /api/public/orders/:token/verify-mp`
Lo llama la página de retorno de Mercado Pago. Body `{ "paymentId": "123456789" }` (opcional: si no viene, el backend busca pagos por `external_reference`). El backend consulta a Mercado Pago y, si está aprobado y el monto/moneda cuadran, marca la orden pagada.
`200 { "order": OrderPublic }`

### `POST /api/public/orders/:token/mock-pay`
Solo en modo simulado (si no, `404`). Body `{ "outcome": "approved" | "rejected" }`. Simula el resultado de Mercado Pago.
`200 { "order": OrderPublic }`

### `POST /api/public/payments/mercadopago/webhook`
Notificaciones de Mercado Pago (`type=payment`, `data.id`). Valida firma `x-signature` si hay `MP_WEBHOOK_SECRET`. Siempre vuelve a consultar el pago en Mercado Pago antes de confirmar. Responde `200` rápido.

### `GET /api/public/tickets/:token`
```json
{
  "ticket": TicketPublic,
  "order": { "kind": "room", "buyerName": "Juan Pérez" },
  "event": { "startsAt": "2026-11-01T02:00:00.000Z" },
  "location": null
}
```
`location` = `{ "name": "Finca La Esperanza", "mapsUrl": "https://maps.app.goo.gl/...", "notes": "Entrada por la vía a Cerritos" }` solo si el admin activó `location.revealed` y el ticket está `valid` o `used`. `404` si el token no existe.

### `POST /api/public/recover`
Recuperar entradas. Rate limit 5/15min/IP.
```json
{ "cedula": "1088123456", "phone": "3001234567" }
```
`200 { "orders": [ { "token": "...", "kind": "ticket", "status": "paid", "createdAt": "..." } ] }` — solo órdenes donde coinciden **ambos** (cédula y celular) y estado ∈ `paid`, `in_review`, `pending_payment`. Lista vacía si nada coincide (misma forma de respuesta).

### `POST /api/public/guest-check`
Consulta si alguien está en la lista de invitados. Rate limit 8/min y 40/hora por IP (`429 RATE_LIMITED`).
```json
{ "query": "@juan.perez" }
```
`query`: 2–80 caracteres. Detección: una palabra con/sin `@` (regex de Instagram, no solo dígitos) → coincidencia exacta por Instagram; solo dígitos (se limpian espacios/puntos/guiones y prefijo 57) → exacta por cédula o celular; otro caso es un nombre (mín. 2 palabras y 5 caracteres; todas las palabras escritas deben ser palabras del nombre del invitado, sin tildes ni mayúsculas).

`200` siempre con la misma forma: `{ "found": true, "ambiguous": false, "kind": "cortesia"|"descuento"|null, "discountPercent": 30, "redeemed": false, "firstName": "Juan" }`. `kind="cortesia"` si el porcentaje efectivo es 100 (`guest.discountPercent ?? guestDiscountPercent`). Si varios invitados coinciden por nombre: `found:false, ambiguous:true`. Sin coincidencia: `found:false`, resto `null`/`false`. Nunca devuelve cédula, celular, Instagram ni apellidos. `400 VALIDATION_ERROR` si `query` es inválido.

---

## 2. Auth de staff

### `POST /api/auth/login`
`{ "username": "admin", "password": "..." }` → `200 { "token": "<jwt>", "user": User }` · `401 INVALID_CREDENTIALS`. Rate limit 10/15min/IP.

### `GET /api/auth/me`
`200 { "user": User }`

**User**: `{ "id", "username", "name", "role", "active", "createdAt", "lastLoginAt" }`

---

## 3. Admin (`role = admin`)

### `GET /api/admin/dashboard`
```json
{
  "tickets": {
    "sold": 37, "capacity": 100,
    "byGender": { "mujer": 20, "hombre": 15 },
    "byPhase": { "preventa": 30, "general": 5 },
    "guests": 2, "courtesy": 2,
    "pendingReview": 3, "pendingPayment": 5
  },
  "rooms": { "booked": 1, "held": 1, "total": 3, "people": 7, "peopleCapacity": 18 },
  "door": { "inside": 0, "roomsInside": 0, "entries": 0, "doorSales": 0 },
  "income": {
    "tickets": 820000, "rooms": 500000,
    "byMethod": { "mercadopago": 600000, "transferencia": 620000, "manual": 100000 },
    "door": { "entries": 0, "parking": 0, "helmets": 0, "total": 0 },
    "bar": 0,
    "total": 1320000
  },
  "expenses": { "total": 2500000, "paid": 1500000, "pending": 1000000 },
  "balance": { "net": -1180000, "coveredPercent": 52.8 },
  "alerts": { "pendingReview": 3, "conflicts": 0 }
}
```
- `tickets.sold` = tickets `valid`+`used` de tipo `general` y `cortesia` (no cuenta habitaciones).
- `income.*` solo cuenta órdenes `paid`, entradas de puerta no anuladas y ventas de barra no anuladas (cortesías valen $0).
- `balance.net = income.total − expenses.total`; `coveredPercent = min(100, income.total / expenses.total × 100)` (100 si no hay gastos), 1 decimal.

### Órdenes (personas registradas)

**OrderAdmin**
```json
{
  "id": "...", "token": "...", "kind": "ticket", "status": "in_review",
  "paymentMethod": "transferencia", "manualMethod": null,
  "amount": 20000, "breakdown": Breakdown,
  "gender": "mujer", "room": null,
  "buyer": { "name": "Laura Gómez", "cedula": "1088123456", "phone": "3001234567", "instagram": "lauragomez", "email": "" },
  "companions": [ { "name": "Ana", "cedula": null } ],
  "guest": null,
  "transfer": { "hasReceipt": true, "reference": "M123456", "uploadedAt": "..." },
  "mp": null,
  "holdExpiresAt": null,
  "rejectReason": null,
  "notes": "",
  "reviewedBy": null, "reviewedAt": null,
  "tickets": [ TicketPublic ],
  "createdAt": "...", "updatedAt": "...", "paidAt": null
}
```
`guest`: `{ "id", "name" }` si se aplicó descuento de lista. `transfer`: `null` si no es transferencia. `mp`: `{ "preferenceId", "paymentId", "status", "statusDetail" }` o `null`. `reviewedBy`: `{ "id", "name" }`.

| Método | Ruta | Body / Query | Respuesta |
|---|---|---|---|
| GET | `/api/admin/orders` | `status`, `kind`, `method`, `q`, `page`, `limit` (orden: más recientes primero) | lista paginada de OrderAdmin |
| GET | `/api/admin/orders/:id` | — | `{ "order": OrderAdmin }` |
| GET | `/api/admin/orders/:id/receipt` | — | imagen binaria (Content-Type original). El frontend la pide con auth y crea un blob URL |
| POST | `/api/admin/orders/:id/approve` | `{ "notes"?: string }` | `{ "order" }` — desde `pending_payment`, `in_review` o `conflict`; genera tickets |
| POST | `/api/admin/orders/:id/reject` | `{ "reason": string (3–200) }` | `{ "order" }` — desde `pending_payment` o `in_review`; libera habitación |
| POST | `/api/admin/orders/manual` | ver abajo | `201 { "order" }` ya pagada con tickets |

`POST /api/admin/orders/manual` (venta directa: alguien pagó en efectivo o por DM, o cortesía):
```json
{
  "kind": "ticket", "gender": "hombre", "roomNumber": null,
  "buyer": { "name": "Carlos Ruiz", "cedula": "1088000111", "phone": "3109998877", "instagram": "", "email": "" },
  "companions": [],
  "amount": 30000,
  "manualMethod": "efectivo",
  "notes": "Pagó en la U"
}
```
`instagram` opcional aquí. `amount` entero ≥ 0 (si se omite: precio actual). `manualMethod: "cortesia"` → `amount` 0 y tickets `kind: "cortesia"` (si `kind = ticket`). Respeta una-entrada-por-cédula y disponibilidad de habitación (`ROOM_UNAVAILABLE`), pero no `SOLD_OUT` (el admin decide).

### Tickets

**TicketAdmin** = TicketPublic + `{ "id", "holderCedula", "order": { "id", "token", "kind", "buyer": { "name", "phone", "instagram" } }, "checkedInBy": { "id", "name" } | null, "voidReason": null, "createdAt" }`

| Método | Ruta | Body / Query | Respuesta |
|---|---|---|---|
| GET | `/api/admin/tickets` | `status`, `kind`, `q`, `page`, `limit` | lista paginada de TicketAdmin |
| PATCH | `/api/admin/tickets/:id` | `{ "holderName"?, "holderCedula"? }` | `{ "ticket" }` (renombrar acompañantes, cambiar titular) |
| POST | `/api/admin/tickets/:id/void` | `{ "reason": string }` | `{ "ticket" }` |
| POST | `/api/admin/tickets/:id/restore` | — | `{ "ticket" }` — `void` → `valid`; `used` → `valid` y anula la entrada de puerta asociada (deshacer check-in) |

### Lista de invitados

**Guest**: `{ "id", "name", "cedula": null|string, "phone": null|string, "instagram": null|string, "discountPercent": null|number, "note": "", "redeemed": false, "redeemedOrderId": null, "createdAt" }`

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/admin/guests` | query `q` | `{ "items": [Guest] }` (todos, sin paginar) |
| POST | `/api/admin/guests` | `{ name, cedula?, phone?, instagram?, discountPercent? (0–100 o null), note? }` — al menos uno de cédula/celular/Instagram | `201 { "guest" }` |
| POST | `/api/admin/guests/bulk` | `{ "text": "Ana Ruiz, 1088111222, 3001112233, @anaruiz\n..." }` — una persona por línea: `nombre, cédula, celular, instagram` (separador `,` `;` o tab; campos vacíos permitidos) | `{ "created": 10, "skipped": 2, "errors": [ { "line": 3, "message": "..." } ] }` (skipped = duplicados) |
| PUT | `/api/admin/guests/:id` | mismos campos que POST | `{ "guest" }` |
| DELETE | `/api/admin/guests/:id` | — | `204` |

### Gastos a librar

**Expense**: `{ "id", "concept", "category", "amount", "paid": false, "paidAt": null, "dueDate": null, "responsible": "", "notes": "", "createdAt", "updatedAt" }`

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/admin/expenses` | — | `{ "items": [Expense], "totals": { "total", "paid", "pending", "byCategory": { "finca": 0, ... } } }` |
| POST | `/api/admin/expenses` | `{ concept (2–120), category, amount (entero ≥ 0), paid?, dueDate? (ISO), responsible? (≤ 60), notes? (≤ 500) }` | `201 { "expense" }` |
| PUT | `/api/admin/expenses/:id` | mismos campos (parcial) | `{ "expense" }` (`paidAt` se pone/quita solo al cambiar `paid`) |
| DELETE | `/api/admin/expenses/:id` | — | `204` |

### Habitaciones

**RoomAdmin**: `{ "number", "name", "capacity" (máx.), "minPeople", "price" (normal), "presalePrice", "beds", "privateBathroom", "blocked", "status", "order": null | { "id", "token", "status", "buyerName", "buyerPhone", "holdExpiresAt" } }`

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/admin/rooms` | — | `{ "items": [RoomAdmin] }` |
| PUT | `/api/admin/rooms/:number` | `{ name?, capacity? (1–20), minPeople? (≤ capacity), price?, presalePrice?, beds?, privateBathroom?, blocked? }` | `{ "room": RoomAdmin }` |

### Ajustes

**Settings**
```json
{
  "eventStartsAt": "2026-11-01T02:00:00.000Z",
  "presaleEndsAt": "2026-10-25T04:59:59.000Z",
  "salesOpen": true,
  "capacity": 100,
  "prices": { "preventa": { "mujer": 20000, "hombre": 30000 }, "puerta": { "mujer": 25000, "hombre": 40000 } },
  "guestDiscountPercent": 25,
  "parking": { "carro": 10000, "moto": 5000, "casco": 5000 },
  "paymentAccounts": [ { "label": "Nequi", "number": "3135995612", "holder": "" } ],
  "transferInstructions": "...",
  "contact": { "whatsapp": "573135995612", "instagram": "", "adminName": "DJ Santech" },
  "location": { "revealed": false, "name": "", "mapsUrl": "", "notes": "" },
  "publicCounter": false,
  "updatedAt": "..."
}
```
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/admin/settings` | — | `{ "settings": Settings }` |
| PUT | `/api/admin/settings` | parcial (merge profundo de los campos de arriba; `paymentAccounts` reemplaza el array completo, máx. 6; `mapsUrl` debe ser `https://`) | `{ "settings": Settings }` |

### Usuarios de staff

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/admin/users` | — | `{ "items": [User] }` |
| POST | `/api/admin/users` | `{ username (3–30, [a-z0-9._-]), name (2–60), password (≥ 8), role }` | `201 { "user" }` · `409 USERNAME_TAKEN` |
| PUT | `/api/admin/users/:id` | `{ name?, role?, password?, active? }` | `{ "user" }` (no puede quitarse a sí mismo el rol admin ni desactivarse) |
| DELETE | `/api/admin/users/:id` | — | `204` (no puede borrarse a sí mismo) |

### Exportar CSV

`GET /api/admin/export/:dataset.csv` con `dataset` ∈ `orders`, `tickets`, `door`, `bar`, `expenses`. Responde `text/csv; charset=utf-8` con BOM (para que Excel muestre tildes), separador `;`, encabezados en español.

---

## 4. Portería (`role = puerta | admin`)

**TicketDoor**
```json
{
  "id": "...", "code": "FD-7KQ2-M9X4", "holderName": "Laura Gómez", "cedulaLast4": "3456",
  "gender": "mujer", "kind": "general", "phase": "preventa", "isGuest": false, "roomNumber": null,
  "buyerName": "Laura Gómez", "status": "valid", "checkedInAt": null, "checkedInByName": null
}
```

**DoorEntry**
```json
{
  "id": "...",
  "source": "ticket",
  "ticket": { "id": "...", "code": "FD-7KQ2-M9X4", "kind": "general", "roomNumber": null },
  "name": "Laura Gómez", "cedula": "1088123456", "phone": null,
  "category": "mujer", "gender": "mujer", "guestListMatch": false,
  "paymentMethod": "efectivo",
  "entryAmount": 0,
  "vehicle": { "type": "moto", "plate": "ABC12D" }, "parkingAmount": 5000,
  "helmet": { "stored": true, "tag": "12", "returned": false, "returnedAt": null }, "helmetAmount": 5000,
  "totalAmount": 10000,
  "notes": "",
  "createdBy": { "id": "...", "name": "Puerta 1" },
  "createdAt": "...",
  "voided": false, "voidReason": null
}
```
`source` ∈ `ticket` (entró con QR) | `door_sale` (pagó en puerta). `ticket` es `null` en ventas de puerta. `vehicle` y `helmet` pueden ser `null`.
Categoría en entradas con QR: habitación → `habitacion`; cortesía → `cortesia`; invitado → `invitado`; si no, el género.

| Método | Ruta | Body / Query | Respuesta |
|---|---|---|---|
| GET | `/api/door/config` | — | `{ "prices": { "mujer": 25000, "hombre": 40000 }, "guestDiscountPercent": 25, "parking": { "carro", "moto", "casco" }, "capacity": 100, "roomsCapacity": 18 }` |
| GET | `/api/door/stats` | — | ver abajo |
| POST | `/api/door/scan` | `{ "value": "<texto del QR o código tecleado>" }` | `{ "result": "valid"\|"used"\|"void"\|"not_found", "ticket": TicketDoor\|null, "entry": DoorEntry\|null }` — no consume; `entry` = la entrada que lo usó (si `used`) |
| POST | `/api/door/checkin` | `{ "ticketId", "vehicle"?: { type, plate }, "helmet"?: { "stored": true, "tag"? }, "paymentMethod"?: posMethod (para parqueadero/casco; defecto `efectivo`), "notes"? }` | `201 { "entry": DoorEntry, "ticket": TicketDoor }` · `409 TICKET_ALREADY_USED` / `TICKET_VOID` |
| POST | `/api/door/sale` | ver abajo | `201 { "entry": DoorEntry }` |
| GET | `/api/door/lookup` | `q` (≥ 3 caracteres): cédula, celular, nombre, código o placa | `{ "tickets": [TicketDoor], "guests": [ { "id", "name", "cedulaLast4", "discountPercent" } ], "entries": [DoorEntry] }` (máx. 10 de cada uno) |
| GET | `/api/door/entries` | `q`, `vehicle` (`carro`\|`moto`\|`any`), `helmet` (`stored`), `includeVoided` (`1`), `page`, `limit` | lista paginada de DoorEntry (más recientes primero) |
| PATCH | `/api/door/entries/:id` | `{ "vehicle"?: {type, plate}\|null, "helmet"?: { stored, tag?, returned? }\|null, "notes"? }` | `{ "entry" }` (recalcula parqueadero/casco y total) |
| POST | `/api/door/entries/:id/void` | `{ "reason": string }` | `{ "entry" }` (si venía de ticket, el ticket vuelve a `valid`) |

`POST /api/door/sale`
```json
{
  "name": "Pedro Gil",
  "cedula": "1088999888",
  "phone": "",
  "category": "invitado",
  "gender": "hombre",
  "paymentMethod": "nequi",
  "vehicle": { "type": "carro", "plate": "XYZ123" },
  "helmet": null,
  "notes": ""
}
```
- `name` obligatorio; al menos `cedula` o `phone`. `gender` obligatorio si `category = invitado` (en mujer/hombre se infiere).
- El backend calcula: `entryAmount` = `prices.puerta[gender]` (invitado: con descuento de la lista si la persona está, si no con `guestDiscountPercent`), `parkingAmount` = `parking[vehicle.type]`, `helmetAmount` = `parking.casco` si `helmet.stored`. `paymentMethod = cortesia` → todo 0. `guestListMatch` = la persona está en la lista.
- Si la cédula tiene un ticket `valid`, responde `409 ALREADY_HAS_TICKET` con `details: { ticketId }` para que portería haga el check-in en vez de cobrar.

`GET /api/door/stats`
```json
{
  "inside": 47, "capacity": 100,
  "roomsInside": 9, "roomsCapacity": 18,
  "byCategory": { "mujer": 20, "hombre": 22, "invitado": 3, "cortesia": 2, "habitacion": 9 },
  "tickets": { "sold": 80, "checkedIn": 40, "pending": 40 },
  "vehicles": { "carro": 10, "moto": 6 },
  "helmets": { "stored": 5, "returned": 1 },
  "money": {
    "entries": 450000, "parking": 130000, "helmets": 25000, "total": 605000,
    "byMethod": { "efectivo": 400000, "nequi": 205000, "daviplata": 0, "tarjeta": 0, "cortesia": 0 }
  }
}
```
`inside` = entradas no anuladas excepto `habitacion`; `roomsInside` = las de `habitacion`. `tickets.sold` incluye habitaciones.

---

## 5. Barra (`role = barra | admin`)

**Product**: `{ "id", "name", "category", "price", "cost": null|number, "stock": null|number, "active": true, "sortOrder": 0, "soldQty": 12 }` (`stock: null` = sin control de inventario).

**Sale**
```json
{
  "id": "...", "number": 42,
  "items": [ { "productId": "...", "name": "Gatorade", "category": "gatorade", "price": 6000, "qty": 2, "subtotal": 12000 } ],
  "total": 12000, "courtesyValue": 0,
  "paymentMethod": "efectivo", "note": "",
  "createdBy": { "id", "name" }, "createdAt": "...",
  "voided": false, "voidedAt": null, "voidReason": null
}
```
`number` es consecutivo. Si `paymentMethod = cortesia`: `total = 0` y `courtesyValue` = lo que habría costado.

| Método | Ruta | Body / Query | Respuesta |
|---|---|---|---|
| GET | `/api/bar/products` | `all=1` incluye inactivos | `{ "items": [Product] }` ordenados por `sortOrder`, luego nombre |
| POST | `/api/bar/products` | `{ name (2–60), category, price (entero ≥ 0), cost?, stock?, active?, sortOrder? }` | `201 { "product" }` |
| PUT | `/api/bar/products/:id` | parcial | `{ "product" }` |
| DELETE | `/api/bar/products/:id` | — | `204` (borrado lógico: deja de aparecer, sus ventas se conservan) |
| POST | `/api/bar/sales` | `{ "items": [ { "productId", "qty" (1–50) } ] (1–30 ítems), "paymentMethod": posMethod, "note"? }` | `201 { "sale": Sale, "warnings": [ "Ron Viejo de Caldas quedó sin stock" ] }` |
| GET | `/api/bar/sales` | `page`, `limit`, `includeVoided` (`1`) | lista paginada de Sale (más recientes primero) |
| POST | `/api/bar/sales/:id/void` | `{ "reason": string }` | `{ "sale" }` (devuelve stock) |
| GET | `/api/bar/summary` | — | ver abajo |

`GET /api/bar/summary`
```json
{
  "total": 1250000, "count": 140,
  "byMethod": { "efectivo": 800000, "nequi": 300000, "daviplata": 50000, "tarjeta": 100000 },
  "byProduct": [ { "productId": "...", "name": "Gatorade", "category": "gatorade", "qty": 40, "revenue": 240000, "cost": 120000, "profit": 120000 } ],
  "byCategory": [ { "category": "gatorade", "qty": 40, "revenue": 240000 } ],
  "courtesy": { "count": 5, "value": 60000 }
}
```
`cost`/`profit` usan `product.cost` (si es `null`, `cost: null` y `profit: null`). Excluye anuladas.
