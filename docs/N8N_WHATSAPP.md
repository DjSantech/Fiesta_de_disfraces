# Aviso por WhatsApp cuando una compra queda EN REVISIÓN (n8n)

Guía para principiantes. Resultado: cuando alguien sube el comprobante de su transferencia, te llega a tu WhatsApp un mensaje como:

```
🎭 *Pago en revisión*
👤 Laura Gómez
🎟️ Entrada mujer
💰 $20.000 · fase preventa
👉 Revisar: https://fiestadedisfraces.pages.dev/staff/admin/compras?estado=in_review
```

## 1. Qué hace el flujo

```
Comprador sube comprobante
        |
        v
Backend (Render)  --POST JSON + x-fd-secret-->  n8n Webhook
                                                   |-> Responder rápido (200)
                                                   '-> IF fase == preventa
                                                          '-> Armar mensaje -> CallMeBot -> tu WhatsApp
```

El backend "dispara y olvida": si n8n está caído o tarda (más de 5 s), la compra del cliente sigue funcionando; solo se pierde el aviso (queda una advertencia en los logs de Render, sin datos personales). Avisa solo la **primera vez** que la orden pasa de `pending_payment` a `in_review`; si el comprador reemplaza el comprobante no se repite el aviso (decisión simple, sin evento extra). Detalle del payload: `docs/CONTRATO_API.md`, sección "Notificaciones salientes".

## 2. Conceptos básicos de n8n

- **Workflow**: el flujo completo (una cadena de pasos).
- **Nodo**: un paso (recibir webhook, decidir, enviar mensaje...).
- **Trigger**: el nodo que inicia el flujo; aquí, el Webhook.
- **Credencial**: dato secreto guardado aparte (clave, contraseña) y reutilizable; no queda escrito en el flujo.
- **Ejecución**: cada vez que el flujo corre. Se ven en la pestaña *Executions*.
- **Test URL vs Production URL**: el webhook tiene dos direcciones. La *Test URL* solo funciona mientras tienes *Listen for test event* activo y muestra los datos en pantalla. La *Production URL* solo funciona cuando el workflow está **publicado/activado** y es la que va en Render; sus ejecuciones se ven en *Executions*.
- **Activar (publicar)**: en versiones recientes el botón se llama *Publish*; en las anteriores, interruptor *Active*. Sin esto la URL de producción responde 404.

## 3. Dónde correr n8n (recomendación)

- **n8n Cloud (recomendado)**: te registras en https://n8n.io y obtienes una URL pública https (`https://TU-NOMBRE.app.n8n.cloud`). Hay prueba gratuita sin tarjeta (según su página de precios: 1.000 ejecuciones; la duración, normalmente 14 días, confírmala al registrarte). Después, el plan Starter cuesta unos 20 EUR/mes (2.500 ejecuciones). Para un evento de un mes alcanza.
- **En tu PC (gratis)**: `npx n8n` (necesita Node) o Docker (`docker run -it --rm -p 5678:5678 docker.n8n.io/n8nio/n8n`), y abres http://localhost:5678. **Problema**: el backend vive en Render (Internet) y `localhost` solo existe en tu PC, así que Render no puede llamarlo. Necesitarías un túnel (ngrok, Cloudflare Tunnel) y tu PC encendida todo el tiempo.

**Elegimos n8n Cloud** porque el backend está en Internet y necesita una URL pública https estable, sin dejar tu PC prendida. (Si la prueba termina y no quieres pagar: usa la ruta local solo para probar, o un VPS barato con Docker.)

## 4. Cómo enviar el WhatsApp (comparación honesta)

| Opción | Pros | Contras |
|---|---|---|
| **CallMeBot** (elegida) | Gratis, se activa en 2 minutos, ideal para avisarte a ti mismo | No oficial: puede dejar de funcionar o cambiar; solo texto; solo a tu propio número; sin garantías |
| **WhatsApp Business Cloud API (Meta)** | Oficial y estable | Requiere cuenta Meta Business, número dedicado y verificación; fuera de la ventana de 24 h solo se pueden enviar **plantillas aprobadas**; más trámite |
| **Twilio WhatsApp** | Fácil de probar con el *sandbox* | El sandbox exige "unirte" con un código y esa sesión dura **72 h** (hay que renovarla); en producción tiene costo y aprobación de plantillas |
| **Telegram / correo desde n8n** | Muy estable y gratis (nodos nativos *Telegram* y *Send Email*) | No es WhatsApp |

**Recomendación para avisarte a ti mismo: CallMeBot.** Es lo más simple. Si un día falla, cambia el último nodo por Telegram (crea un bot con @BotFather) o correo; el resto del flujo no cambia. Verifica los datos vigentes de cada proveedor en su web: cambian seguido.

## 5. Activar CallMeBot (una vez)

1. Guarda en tus contactos el número **+34 644 95 73 56** (nómbralo "CallMeBot").
2. Desde tu WhatsApp envíale: `I allow callmebot to send me messages`.
3. Te responde con una **apikey** (si no llega en 2 minutos, reintenta tras 24 h). Guárdala; es secreta.

(Fuente: https://www.callmebot.com/blog/free-api-whatsapp-messages/ . Es "solo para uso personal".)

## 6. Importar el flujo ya hecho (atajo)

1. En n8n: **Workflows → Create workflow → menú ⋯ → Import from file** y elige `docs/n8n/flujo-pago-en-revision.json`.
2. Crea las credenciales (sección 7, pasos 2 y 7) y asígnalas en los nodos *Webhook* y *Enviar WhatsApp*.
3. En el nodo *Armar mensaje* cambia `REEMPLAZA_CON_TU_TELEFONO` por tu número con indicativo (ej. `+57300...`). Escríbelo solo dentro de n8n, nunca en archivos del repo.
4. Continúa en la sección 8.

## 7. Crear el flujo desde cero

1. **Workflows → Create workflow.** Nómbralo "Fiesta - Pago en revisión".
2. **Credencial del secreto.** Genera un secreto aleatorio en PowerShell:
   ```powershell
   -join ((48..57)+(97..122) | Get-Random -Count 40 | % {[char]$_})
   ```
   Guárdalo (lo usarás también en Render). En n8n: *Credentials → Create → Header Auth*; **Name** = `x-fd-secret`, **Value** = el secreto. Nómbrala "Fiesta x-fd-secret".
3. **Nodo 1 · Webhook** (trigger): *HTTP Method* POST; *Path* `fiesta-pago-en-revision`; *Authentication* = Header Auth con la credencial anterior; *Respond* = Using 'Respond to Webhook' Node.
4. **Nodo 2 · Respond to Webhook** (conéctalo al Webhook): *Respond With* JSON, cuerpo `{"ok": true}`. Así Render recibe respuesta de inmediato.
5. **Nodo 3 · IF** (también conectado al Webhook): condición *String* `{{ $json.body.phase }}` *is equal to* `preventa`; sigue por *true*. **Para avisar de todas las fases**: borra este nodo y conecta el Webhook directamente al nodo 4.
6. **Nodo 4 · Code** (JavaScript): pega el código de *Armar mensaje* del JSON importable (arma el monto con `toLocaleString('es-CO')` → `$20.000`). Pon tu teléfono en la constante `TELEFONO`.
7. **Nodo 5 · HTTP Request**: *Method* GET; *URL* `https://api.callmebot.com/whatsapp.php`; *Authentication* = Generic Credential Type → **Query Auth**, credencial nueva con **Name** `apikey` y **Value** tu apikey de CallMeBot; activa *Send Query Parameters* con `phone` = `{{ $json.telefono }}` y `text` = `{{ $json.texto }}` (n8n codifica el texto solo).
8. Guarda (Ctrl+S).

## 8. Probar

1. Abre el nodo Webhook, pestaña *Test URL*, clic en **Listen for test event**. Copia la *Test URL*.
2. Envía una petición de prueba (cambia `URL` y `SECRETO`):

   **PowerShell**
   ```powershell
   $body = '{"event":"order.in_review","orderId":"abc123","kind":"ticket","gender":"mujer","roomNumber":null,"roomName":null,"phase":"preventa","amount":20000,"paymentMethod":"transferencia","buyerName":"Laura Gómez","hasInstagram":true,"isGuest":false,"createdAt":"2026-10-10T15:00:00.000Z","adminUrl":"https://fiestadedisfraces.pages.dev/staff/admin/compras?estado=in_review"}'
   Invoke-RestMethod -Method Post -Uri "URL" -ContentType "application/json; charset=utf-8" -Headers @{ "x-fd-secret" = "SECRETO" } -Body ([Text.Encoding]::UTF8.GetBytes($body))
   ```
   **Git Bash**
   ```bash
   curl -X POST "URL" -H "Content-Type: application/json" -H "x-fd-secret: SECRETO" \
     -d '{"event":"order.in_review","orderId":"abc123","kind":"ticket","gender":"mujer","roomNumber":null,"roomName":null,"phase":"preventa","amount":20000,"paymentMethod":"transferencia","buyerName":"Laura Gómez","hasInstagram":true,"isGuest":false,"createdAt":"2026-10-10T15:00:00.000Z","adminUrl":"https://fiestadedisfraces.pages.dev/staff/admin/compras?estado=in_review"}'
   ```
3. Debe llegar el WhatsApp y verás los datos en el editor. Con un encabezado incorrecto n8n responde 403.
4. **Publica/activa** el workflow. Ahora usa la *Production URL* (la ruta es `/webhook/...`, no `/webhook-test/...`). Repite el envío con ella: no verás datos en el editor; míralos en la pestaña **Executions**.

## 9. Conectar con Render

1. Render → servicio `fiesta-disfraces-api` → *Environment*: `N8N_WEBHOOK_URL` = la **Production URL** (https); `N8N_WEBHOOK_SECRET` = el mismo secreto de n8n.
2. **Save, rebuild and deploy** (el backend lee las variables solo al arrancar).
3. Prueba real: en la web compra una entrada por transferencia, sube un comprobante (cualquier imagen PNG/JPG) y espera el WhatsApp. Luego rechaza esa compra en el admin para no dejar basura. Si Render estaba dormido, la primera petición tarda ~50 s, pero el aviso sale igual.

## 10. Problemas comunes

- **404 al llamar el webhook**: usaste la Test URL sin estar escuchando, o el workflow no está publicado/activado. En Render va la Production URL.
- **403 / "Authorization data is wrong"**: el secreto en Render no coincide con la credencial de n8n (revisa espacios) o el nombre del encabezado no es exactamente `x-fd-secret`.
- **No llega nada y n8n no muestra ejecución**: revisa los logs de Render (busca "Aviso n8n"); `N8N_WEBHOOK_URL` vacía o inválida (al arrancar hay una advertencia), o no redeployaste.
- **Hay ejecución en n8n pero no WhatsApp**: apikey o teléfono mal (formato `+57...`), o CallMeBot sin activar; abre la ejecución y mira la salida del nodo HTTP Request.
- **Solo avisa de preventa**: es el nodo IF; quítalo para todas las fases.
- **Render dormido / n8n lento**: el backend espera máximo 5 s y no reintenta; ese aviso se pierde. Revisa el admin de vez en cuando.
- **Prueba gratuita de n8n vencida**: el webhook deja de funcionar; pasa a un plan de pago o muévelo a un servidor propio.

## 11. Ideas para ampliar

- Aviso cuando el pago de Mercado Pago llegue (nuevo evento `order.paid` en `services/notify.js`, mismo patrón).
- Resumen diario: nodo *Schedule Trigger* + HTTP Request.
- Enviar también por Telegram o correo (otro nodo en paralelo) como respaldo.
- Pasar a WhatsApp Cloud API o Twilio si necesitas escribir a otras personas.
