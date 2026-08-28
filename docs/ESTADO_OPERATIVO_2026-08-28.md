# Informe de estado operativo — Ad Mavericks One

**Fecha de corte:** 28 de agosto de 2026  
**Aplicación AWS Amplify:** `campa-a1` (`djk125z43ran7`)  
**Rama publicada:** `claude/adsmaiber-website-admin-9xc3cv`

## Resumen ejecutivo

Ad Mavericks One está construido, desplegado y técnicamente estable. Incluye
acceso privado, planificador de cinco etapas, catálogos, Mavi, laboratorio
creativo, geolocalización, órdenes, campañas, reportes, consentimiento legal y
administración multiempresa.

La apertura comercial completa sigue bloqueada de forma intencional. Faltan
credenciales productivas válidas de dLocal Go y Meta, una API Key de inferencia
correcta para OpenRouter y la validación controlada de pago y pauta pausada. Los
interruptores de cobro y gasto permanecen apagados; actualmente el sitio no
puede cobrar ni consumir una línea de crédito de Meta por accidente.

## Incidente de Mavi / OpenRouter

Amplify contiene las variables `AI_PROVIDER=openrouter`,
`OPENROUTER_MODEL=openrouter/free`, `AI_ASSISTANT_ENABLED=true` y
`AI_WEB_TRENDS_ENABLED=true`. CloudWatch registró una falla del proveedor el 28
de agosto de 2026 a las 10:51:55, hora de Ecuador.

La cuenta de OpenRouter muestra que la API Key normal no ha sido usada y mantiene
pendiente la verificación del correo. La clave incorporada anteriormente se
obtuvo desde el apartado **Management Keys**. Esas claves administran otras
claves y no sustituyen una API Key de inferencia para `/chat/completions`.

**Corrección necesaria:** verificar el correo de OpenRouter, revocar la clave
compartida anteriormente, crear una API Key normal en **API Keys**, rotarla desde
la consola local y comprobar una respuesta de Mavi después del despliegue.

Para producción no se recomienda depender exclusivamente de `openrouter/free`:
los modelos gratuitos tienen límites bajos y disponibilidad variable. Debe
configurarse una cuenta con crédito o un proveedor de respaldo.

## Estado de integraciones

| Integración | Estado | Falta |
| --- | --- | --- |
| Supabase | Conectada | Prueba programada de respaldo/restauración |
| Mavi / OpenRouter | Configuración presente, credencial incorrecta | Verificar correo, API Key normal y prueba de respuesta |
| Tendencias web | Habilitadas | Monitorear disponibilidad de fuentes |
| OpenStreetMap | Activo | Sin bloqueo |
| Google Maps / 360 | Parcial | Clave restringida de Maps Embed API |
| dLocal Go | No configurado | API Key, Secret Key y `DLOCALGO_ENV=live` |
| Meta Ads | Ejecución Facebook/Instagram construida, no configurada | Token de sistema, cuenta publicitaria, página e Instagram profesional |
| WhatsApp Ads | Recomendación disponible, ejecución directa pendiente | Definir flujo Click-to-WhatsApp, WABA, número y medición |
| Cobros reales | Bloqueados | Conciliación y prueba productiva controlada |
| Borradores Meta | Bloqueados | Validación de conexión y campaña `PAUSED` |
| Gasto Meta | Bloqueado | Aprobación final y tope inicial de inversión |

## Qué se necesita para cambiar la línea de crédito de Meta

La línea de crédito no pertenece al token. Pertenece a la cuenta publicitaria
configurada en Meta. Para migrar del crédito actual al crédito del cliente deben
rotarse en conjunto:

1. `META_ACCESS_TOKEN`: token de sistema con permisos de Marketing API.
2. `META_AD_ACCOUNT_ID`: cuenta publicitaria del cliente que contiene su método
   de pago o línea de crédito.
3. `META_PAGE_ID`: página de Facebook autorizada.
4. `META_INSTAGRAM_USER_ID`: cuenta profesional de Instagram vinculada.

Después debe ejecutarse una comprobación de solo lectura y crear una campaña en
estado `PAUSED`. El gasto real se habilita únicamente cuando la cuenta y la
facturación hayan sido confirmadas.

## Qué necesita dLocal Go

dLocal Go no requiere una sola credencial. Producción necesita:

1. `DLOCALGO_API_KEY`.
2. `DLOCALGO_SECRET_KEY`.
3. `DLOCALGO_ENV=live`.
4. URL de notificación registrada para el webhook.
5. Prueba de firma HMAC, idempotencia, monto, moneda y estado pagado.

dLocal Go cobra al cliente y liquida al comercio. No paga automáticamente la
factura de Meta. Tesorería debe conciliar la inversión base, el cargo del 22%,
la comisión del 25%, la comisión del procesador y la factura de Meta.

## Checklist de salida comercial

### P0 — obligatorio antes de aceptar dinero

- [ ] Verificar el correo de OpenRouter.
- [ ] Revocar la clave de OpenRouter compartida en el chat.
- [ ] Crear y probar una API Key normal de inferencia.
- [ ] Instalar las dos credenciales productivas de dLocal Go.
- [ ] Registrar y verificar el webhook de dLocal Go.
- [ ] Ejecutar pago controlado y conciliación sin diferencia de centavos.
- [ ] Instalar token y activos del nuevo Business Manager de Meta.
- [ ] Verificar permisos `ads_management`, `ads_read`, `business_management`,
      `pages_read_engagement`, `pages_show_list` e `instagram_basic`.
- [ ] Crear campaña de prueba en `PAUSED` y confirmar la cuenta facturada.
- [ ] Definir si WhatsApp se ejecutará como Click-to-WhatsApp desde Meta; si se
      requiere gestión directa, incorporar WABA, número, plantillas y medición.
- [ ] Validar con contabilidad el tratamiento y nombre comercial del 22%.
- [ ] Definir responsable y SLA de devoluciones/contracargos.

### P1 — obligatorio antes de promoción pública

- [ ] Conectar el dominio comercial definitivo con HTTPS.
- [ ] Activar AWS WAF con límites de solicitudes y reglas administradas.
- [ ] Crear alarmas para errores 5xx, pagos fallidos y fallas de webhook.
- [ ] Definir retención y protección de datos de CloudWatch.
- [ ] Ejecutar prueba de respaldo y restauración de Supabase.
- [ ] Configurar MFA para administradores y operador IAM limitado.
- [ ] Probar el flujo completo en móvil y escritorio.
- [ ] Reconfirmar tarifas, disponibilidad y permisos de inventario comercial.
- [ ] Crear un entorno separado de ensayo antes de futuros cambios.

## Consola privada de credenciales

La consola local de Ad Mavericks ahora contiene una sección **Credenciales**.
Permite rotar OpenRouter, dLocal Go, Meta y Google Maps sin mostrar los valores
actuales. La herramienta:

- escucha exclusivamente en `127.0.0.1`;
- exige una frase de acceso local;
- usa un perfil IAM con permisos limitados;
- no guarda secretos en Supabase;
- registra únicamente nombres de variables cambiadas, nunca sus valores;
- valida OpenRouter y Meta antes de guardar;
- conserva los interruptores financieros apagados;
- lanza un nuevo despliegue de Amplify después de cada rotación.

## Resultado técnico verificado

- 24 pruebas automatizadas aprobadas.
- comprobación de TypeScript aprobada;
- compilación de producción aprobada;
- RLS y consentimiento legal aplicados en Supabase;
- CloudWatch recibe registros SSR y de rutas API;
- pagos y gasto real fallan de forma cerrada cuando faltan credenciales.
