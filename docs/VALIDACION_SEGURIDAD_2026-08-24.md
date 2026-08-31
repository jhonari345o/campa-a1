# Validacion de seguridad — 2026-08-24

Proyecto Supabase de produccion, sin registrar UUID, correos, IP, tokens ni
contenido de clientes en este documento.

## Migraciones aplicadas

- Tabla mensual `ad_investments_monthly` con RLS administrativo.
- `0007_handoff_security.sql`: rol aprobador, auditoria inmutable, proteccion de
  privilegios, permiso para crear campanas y restriccion de datos crudos.

## Comprobaciones de catalogo

| Control | Resultado |
| --- | --- |
| Rol `approver` existe | OK |
| Trigger de auditoria inmutable activo | OK |
| Trigger contra autoelevacion activo | OK |
| Insert de campana exige rol y autor autenticado | OK |
| Seis tablas de mercado solo para platform admin | OK |
| Auditoria sin FK que muten evidencia al borrar | OK |
| RLS activo en auditoria y campanas | OK |

## Prueba como miembro no administrador

La prueba tomo internamente un miembro activo no administrador, configuro sus
claims en una transaccion y termino con `ROLLBACK`.

| Prueba | Resultado |
| --- | --- |
| Filas crudas de anunciantes visibles | 0, OK |
| Empresas fuera de su membresia visibles | 0, OK |
| Campanas fuera de su membresia visibles | 0, OK |
| Intento de activar `is_platform_admin` en su perfil | Bloqueado, OK |

## Integracion continua

Los controles de TypeScript, lint, pruebas, compilacion de produccion,
auditoria de dependencias y CodeQL finalizaron correctamente en GitHub para
las ramas de integracion y produccion.

Pendiente antes de apertura externa: repetir con una matriz automatizada de dos
empresas y todos los roles, incluyendo crear/aprobar, cargas y proveedores.
