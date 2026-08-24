# ADR-001 — Arquitectura y limites de produccion

- Estado: aceptado para piloto controlado
- Fecha: 2026-08-24
- Fuente de requisitos: handoff tecnico del 2026-08-12

## Contexto

Ad Mavericks One necesita un sitio publico y una aplicacion multiempresa para
planificar y gestionar medios en Ecuador. El handoff exige que no se procese
dinero ni se active inventario o pauta real hasta cerrar los controles P0/P1.

## Decisiones

1. AWS Amplify aloja Next.js con SSR, HTTPS y CDN. Supabase PostgreSQL es la
   fuente de verdad y Supabase Auth gestiona cuentas solo por invitacion.
2. RLS aísla empresas. Los datos de mercado crudos, licenciados o
   identificables son exclusivos del equipo; el cliente recibe derivados.
3. Los roles de empresa son `admin`, `planner`, `analyst`, `approver` y
   `viewer`. Crear y aprobar son permisos separados.
4. PayPhone usa su experiencia alojada; la aplicacion nunca solicita ni guarda
   numero de tarjeta o CVC.
5. Meta siempre se crea primero en `PAUSED`. Preparar un borrador y activar
   gasto son operaciones distintas y requieren habilitaciones independientes.
6. Mavi orienta y prepara borradores. No compra ni publica sola. Antes de enviar
   texto a un proveedor de IA se exige consentimiento y se minimiza el contexto.
7. Cobro, borradores Meta, gasto Meta, IA y worker automatico tienen
   interruptores con cierre seguro, apagados por defecto.
8. El piloto actual no equivale a apertura comercial. OIDC/MFA empresarial,
   staging aislado, WAF/rate limiting, restauracion de backups, observabilidad,
   retencion, conciliacion, reservas, ledger y pentest requieren evidencia antes
   de cambiar ese estado.

## Consecuencias

La pagina puede desplegarse y revisarse en AWS sin permitir efectos economicos.
Configurar un token no habilita cobros ni gasto. La activacion futura se hace de
forma gradual, documentada y reversible.
