# dLocal Go + Meta — flujo de cobro y pauta

Referencia primaria: [Create a payment](https://docs.dlocalgo.com/integration-api/welcome-to-dlocal-go-api/payments/create-a-payment),
[Retrieve a payment](https://docs.dlocalgo.com/integration-api/welcome-to-dlocal-go-api/payments/retrieve-a-payment) y
[Notifications](https://docs.dlocalgo.com/integration-api/welcome-to-dlocal-go-api/payments/notifications).

El cobro y el gasto publicitario son dos movimientos distintos:

1. El cliente define la publicación, geolocalización e inversión base.
2. El servidor calcula `base + 22% + 25%`. Ejemplo: $200 + $44 + $50 = $294.
3. dLocal Go abre su Checkout estándar y cobra el total al cliente.
4. El webhook firmado solo trae el `payment_id`; el servidor valida HMAC y
   consulta de nuevo la API de dLocal para comprobar orden, monto, USD, Ecuador
   y estado `PAID`.
5. El ledger separa inversión para medios, cargo del 22%, comisión del 25%,
   comisión propia de dLocal y neto liquidado.
6. El equipo crea la campaña Meta en `PAUSED` usando exclusivamente
   `base_cents`. Una confirmación administrativa separada permite activarla.

## Lo que dLocal Go no hace

dLocal Go cobra al cliente y liquida el neto al comercio. No envía
automáticamente la inversión base a Meta ni sustituye el método de pago de la
cuenta publicitaria. Meta factura su gasto por separado. Por eso tesorería debe
reservar `base_cents` y conciliar:

- entrada: liquidación neta de dLocal Go;
- salida: factura/cobro de Meta por la inversión consumida;
- pasivo o tratamiento aplicable al cargo del 22%;
- ingreso: comisión de asistencia del 25%;
- gasto: comisión de procesamiento de dLocal Go.

La denominación y tratamiento fiscal del 22% requieren validación contable en
Ecuador antes de abrir cobros reales.

## Configuración técnica

1. Ejecutar `supabase/migrations/0010_dlocal_go_checkout.sql`.
2. En Amplify definir, sin copiarlas a Git ni al navegador:
   - `DLOCALGO_ENV=sandbox`
   - `DLOCALGO_API_KEY`
   - `DLOCALGO_SECRET_KEY`
3. Mantener `COMMERCIAL_PAYMENTS_ENABLED=false` hasta terminar la prueba.
4. La app registra automáticamente como notificación:
   `https://TU-DOMINIO/api/payments/dlocal/notifications`.
5. El retorno seguro es:
   `https://TU-DOMINIO/api/payments/dlocal/return?job=...`.

Las credenciales viajan únicamente desde el runtime SSR a la API oficial. La
firma se calcula con el cuerpo crudo y se compara en tiempo constante. Un
retorno del navegador nunca basta para aprobar un pago.

## Salida controlada

- Probar primero en sandbox: pendiente, pagado, rechazado, cancelado, expirado
  y webhook repetido.
- Verificar que $200 cobre $294 y que Meta reciba un presupuesto de $200.
- Habilitar `META_PAUSED_DRAFTS_ENABLED=true` solo para crear un borrador sin gasto.
- Confirmar en Meta que el borrador sigue `PAUSED` y que la cuenta/método de pago
  correctos están vinculados.
- Pasar dLocal a `live` y activar cobros solo con aprobación expresa.
- Mantener `META_REAL_SPEND_ENABLED=false` hasta una última aprobación humana y
  empezar con un tope bajo.

Nunca registrar API keys, tarjetas, CVC, cookies de sesión ni tokens Meta en
logs, documentación o tablas de negocio.
