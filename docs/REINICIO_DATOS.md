# Reiniciar los datos (dejar la fiesta "desde cero")

Script: `backend/scripts/reset-sales.js` (también `npm --prefix backend run reset:sales -- <opciones>`).
**Es destructivo e irreversible** (salvo por el respaldo que hace antes). Por defecto solo SIMULA (dry-run).

## Qué borra y qué conserva

| Se BORRA | Se REVIERTE | Se CONSERVA |
|---|---|---|
| Compras (órdenes), entradas (tickets), comprobantes, entradas de portería | Habitaciones: vuelven a libres, sin compra ni apartado | Ajustes (precios, fechas, cuentas, ubicación), usuarios del staff |
| Ventas de barra y su consecutivo, **solo con `--include-bar`** | Invitados: quedan sin redimir (siguen en la lista) | Lista de invitados, productos y stock de barra, gastos, configuración de habitaciones |
| | | **Toda la auditoría** (nunca se borra) |

Cada reinicio deja 1 registro en la auditoría (`data.reset`: quién, cuándo, motivo y cuántos datos se borraron).

## Antes de empezar: respaldo extra (recomendado)

En el admin exporta CSV de **Compras** y de **Entradas**. Además el script guarda un respaldo JSON en `backups/<fecha-hora>/` (carpeta ignorada por git; guárdala en un lugar seguro). Se omite con `--no-backup` (no lo hagas en producción).

## 1. Simulación (dry-run, no borra nada)

Muestra el servidor, la base y cuántos documentos se borrarían.

```powershell
# Base LOCAL (con "npm run db" encendido)
$env:MONGODB_URI='mongodb://127.0.0.1:27017/fiesta_disfraces'
node backend/scripts/reset-sales.js
```

Añade `--include-bar` si también quieres ver las ventas de barra.

## 2. Borrar de verdad (apply)

```powershell
node backend/scripts/reset-sales.js --apply --reason "Fin de pruebas, empezamos limpio" --include-bar
```

- `--reason` es obligatorio (mínimo 3 caracteres) y queda en la auditoría.
- El script te pide escribir **exactamente el nombre de la base**. Si es producción, además escribir `PRODUCCION`.
- Sin teclado interactivo (CI, etc.) exige `--confirm-db <nombre_base>` (y `--confirm-prod PRODUCCION` si es producción).
- Es seguro repetirlo: si ya está limpio no falla.

## 3. Contra PRODUCCIÓN (MongoDB Atlas)

1. En Atlas: **Network Access** debe permitir la IP de tu PC (la de tu casa/red actual).
2. Deja **Render sin tráfico real**: nadie comprando mientras limpias (apaga las ventas en el admin o avisa al equipo).
3. En TU ventana de PowerShell escribe la URI (con la clave) y ejecuta primero el dry-run:

```powershell
$env:MONGODB_URI='mongodb+srv://USUARIO:CLAVE@cluster0.xxxxx.mongodb.net/fiesta_disfraces'
node backend/scripts/reset-sales.js
# Revisa host, base y conteos. Si todo es correcto:
node backend/scripts/reset-sales.js --apply --reason "Lanzamiento oficial: limpiar pruebas" --include-bar
# Al terminar, borra la URI de la sesión:
Remove-Item Env:MONGODB_URI
```

El script nunca imprime la URI completa ni la clave: solo host y nombre de la base. No pegues la URI en chats, commits ni archivos.

## Alternativa sin script

Admin > Compras > seleccionar todo > **Eliminar**. Sirve para pocas compras y deja una auditoría por cada una. El script es mejor para limpiar de golpe: borra también comprobantes, portería (y barra), libera habitaciones e invitados en un solo paso, hace respaldo y deja una única entrada de auditoría.

## Nota

No se tocan los productos, así que su contador de vendidos (`soldQty`) no se reinicia con `--include-bar`; el stock sí queda igual.
