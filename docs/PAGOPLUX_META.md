# PagoPlux + Meta — flujo operativo

## Flujo

1. El cliente define la publicación, geografía y presupuesto.
2. El servidor calcula inversión, componente comercial del 22% y comisión del 25%.
3. PagoPlux muestra su Paybox oficial. Ad Mavericks no recibe los datos de tarjeta.
4. La respuesta del navegador solo asocia el identificador de transacción; no marca el pago como confirmado.
5. `POST /api/payments/pagoplux/webhook` autentica Basic Auth, comprueba monto y estado `PAGADO` y recién entonces habilita la orden.
6. Meta utiliza la cuenta publicitaria y facturación configuradas en la consola. El cobro PagoPlux no paga automáticamente la factura de Meta.

## Instalación

1. Ejecutar `supabase/migrations/0016_pagoplux_checkout.sql` después de `0010_dlocal_go_checkout.sql`.
2. Configurar en AWS Amplify:
   - `PAYMENT_PROVIDER=pagoplux`
   - `NEXT_PUBLIC_PAGOPLUX_MERCHANT_EMAIL`
   - `NEXT_PUBLIC_PAGOPLUX_MERCHANT_NAME`
   - `NEXT_PUBLIC_PAGOPLUX_ENV`
   - `PAGOPLUX_WEBHOOK_CLIENT_ID`
   - `PAGOPLUX_WEBHOOK_SECRET`
3. Registrar en PagoPlux el webhook `https://TU-DOMINIO/api/payments/pagoplux/webhook` con las mismas credenciales Basic Auth.
4. Mantener `COMMERCIAL_PAYMENTS_ENABLED=false` hasta comprobar un pago controlado y su conciliación.

## Límites de seguridad

- No registrar `cardInfo`, `token`, `clientID` ni el cuerpo íntegro del webhook.
- Un callback `succeeded` del navegador no confirma el pago.
- Un monto diferente deja la operación en `requires_attention`.
- El gasto Meta se habilita con un interruptor separado después de revisar el borrador pausado.
