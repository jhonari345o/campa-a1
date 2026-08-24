# PayPhone + Meta — puesta en produccion

El flujo separa el cobro de la activacion publicitaria:

1. El cliente define publicacion, punto, radio e inversion.
2. El servidor calcula inversion + 22% de impuestos/costos + 25% de servicio.
3. PayPhone prepara dos formularios alojados: tarjeta o app PayPhone.
4. Al regresar, el servidor confirma la transaccion directamente con PayPhone y
   compara identificador, monto, moneda y estado aprobado.
5. Un platform admin crea en Meta un borrador completo en `PAUSED`.
6. Tras revisar cuenta, publicacion, radio y presupuesto, el admin confirma la
   activacion. Solo ese ultimo paso permite que empiece el gasto.

## 1. Supabase

En SQL Editor, ejecutar en orden `supabase/migrations/0001_*.sql` hasta
`0006_payphone_meta_pauta.sql`. La ultima migracion crea:

- `campaign_payments`: importes esperados y estado de PayPhone.
- `campaign_payment_confirmations`: idempotencia y auditoria de confirmaciones.
- `campaign_deliveries`: ids y estado de campaña, ad set, creativo y anuncio.

Mantener desactivado **Allow new users to sign up**. Las escrituras de pago y
Meta no tienen politicas RLS publicas: se hacen con `service_role` en el servidor.

## 2. PayPhone

1. Crear o activar una cuenta PayPhone Business.
2. Crear un usuario con rol Desarrollador y una aplicacion de tipo **WEB**.
3. Registrar exactamente el dominio HTTPS definido en `NEXT_PUBLIC_SITE_URL`.
4. Registrar como URL de respuesta:
   `https://TU-DOMINIO/api/payments/payphone/confirm`.
5. Guardar `PAYPHONE_TOKEN` y `PAYPHONE_STORE_ID` directamente en las variables
   de Amplify. No pegarlas en GitHub, documentacion ni chat.
6. Probar primero en el ambiente controlado de PayPhone.

PayPhone indica que los enlaces de pago duran 10 minutos. Tras el pago, la
confirmacion debe ejecutarse dentro de 5 minutos o la operacion se reversa
automaticamente. Por eso la URL de respuesta confirma de inmediato en servidor.
Los enlaces se abren directamente, nunca en iframe, y la app envia
`Referrer-Policy: origin` para que PayPhone pueda validar el dominio registrado.

## 3. Meta

La app de Meta necesita Marketing API aprobada, una cuenta publicitaria, una
pagina de Facebook y, para Instagram, una cuenta profesional vinculada. Cargar:

- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID` (`act_...`)
- `META_PAGE_ID`
- `META_INSTAGRAM_USER_ID`
- `META_GRAPH_API_VERSION`
- `META_MAX_CAMPAIGN_BUDGET_USD`
- `META_CAMPAIGN_DURATION_DAYS`

La URL pegada debe pertenecer a la pagina/cuenta configurada. La integracion
resuelve el post o media existente y crea campaña, ad set, creativo y anuncio en
pausa. Si Meta rechaza un paso, conserva los ids ya creados para reanudar.

## 4. Salida controlada

- Probar PayPhone en su ambiente controlado y Meta solo en `PAUSED`.
- Revisar con contabilidad ecuatoriana la denominacion/facturacion del 22% antes
  de cobrar clientes reales.
- Pasar PayPhone a produccion y aumentar el tope Meta solo con aprobacion.
- Verificar que **Pausar gasto** detenga la campaña antes de la primera pauta.
- Rotar de inmediato cualquier token que haya sido expuesto.

