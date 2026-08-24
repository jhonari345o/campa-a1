# Cumplimiento del handoff tecnico 2026-08-12

Revision fechada 2026-08-24. Este documento separa lo implementado de lo que
necesita configuracion, evidencia o desarrollo adicional.

| Requisito | Estado | Evidencia / siguiente paso |
| --- | --- | --- |
| Identidad visual, tono y Mavi como guia | Implementado | Paleta, Nunito Sans, componentes y textos; Mavi no sustituye aprobaciones. |
| Alta cerrada de usuarios | Implementado | Autorregistro deshabilitado; consola local y administracion controlada. |
| PostgreSQL, migraciones y RLS | Aplicado y verificado | Esquema y migraciones hasta `0007`; controles de catalogo y RLS verificados en Supabase el 2026-08-24. |
| Datos crudos y licenciados restringidos | Aplicado y verificado | Una sesion simulada de miembro normal obtuvo cero filas crudas y solo sus empresas/campanas. |
| Roles y separacion crear/aprobar | Parcial | Rol `approver` y permiso separado; falta un flujo completo de aprobacion/versiones. |
| Auditoria inmutable | Parcial | Esquema append-only y contexto adicional; falta instrumentar todos los eventos y exportacion. |
| Cobro sin capturar tarjetas | Implementado | PayPhone alojado; se elimino el formulario simulado de tarjeta. |
| Cobro real y conciliacion | Bloqueado | Interruptor apagado; faltan credenciales, pruebas controladas, webhooks firmados y ledger. |
| Meta en pausa y activacion humana | Implementado con bloqueo | Dos pasos separados; borrador y gasto estan apagados por defecto. |
| IA explicable y supervisada | Parcial | Consentimiento, minimizacion y bloqueo por variable; falta contrato/DPA y evaluacion formal. |
| Metricas con fuente y metodologia | Parcial | Meta muestra fuente, periodo y metodo; catalogo cross-media homologado sigue pendiente. |
| Headers y CSP | Implementado | CSP, HSTS, anti-frame, no-sniff, permisos y no-cache/no-index en rutas privadas. |
| CI, pruebas y SAST | Configurado | Workflow de calidad, pruebas de flags/permisos y CodeQL; verificar primera ejecucion en GitHub. |
| OIDC/SSO y MFA | Pendiente externo | Configurar proveedor empresarial antes de usuarios externos. |
| Entornos separados | Pendiente externo | Crear staging con proyecto Supabase y secretos propios. |
| WAF, rate limiting y anti-bot | Pendiente externo | Configurar AWS WAF/Turnstile equivalente y guardar evidencia. |
| Backups y restauracion | Pendiente externo | Confirmar retencion y ejecutar restauracion documentada. |
| Observabilidad y alertas | Pendiente externo | Integrar errores/alertas sin PII, tokens ni datos licenciados. |
| Retencion, exportacion, borrado y legal | Pendiente externo | Aprobar politicas, terminos, privacidad y DPA. |
| Reservas, anti-duplicacion, ordenes y ledger | Pendiente de producto | No presentar como funcional hasta construir y probar concurrencia. |
| Pentest | Pendiente externo | Obligatorio antes de cobros o gasto real. |

## Regla de lanzamiento

Mientras exista un requisito P0/P1 sin evidencia aprobada, mantener en `false`:

- `COMMERCIAL_PAYMENTS_ENABLED`
- `META_REAL_SPEND_ENABLED`
- `AGENT_AUTOMATION_ENABLED`

`META_PAUSED_DRAFTS_ENABLED` puede abrirse antes, exclusivamente para una prueba
controlada en pausa. `AI_ASSISTANT_ENABLED` requiere aprobar proveedor,
consentimiento y tratamiento de datos.
