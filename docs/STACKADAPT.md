# StackAdapt en Medios digitales

El módulo `/digital/dsp` permite a administradores de la plataforma verificar una conexión GraphQL, seleccionar un anunciante autorizado, consultar campañas no archivadas y solicitar resultados agregados por período. Se abre desde **Medios digitales → Administrar DSP** y desde la tarjeta Programmatic. No envía mutaciones ni activa inversión.

## Configuración privada

En el entorno servidor de la rama de Amplify configurada para One, guardar:

- `STACKADAPT_API_TOKEN`: llave **GraphQL**, con permiso READ sobre los anunciantes de la operación. No sirve una llave REST.
- `STACKADAPT_ACCOUNT_ID`: identificador de la cuenta propietaria de esos anunciantes. La integración lo coteja con `account.id` antes de devolver campañas o reportes.

Recompilar/desplegar tras cambiar estas variables y pulsar **Verificar conexión** en One. La presencia de variables por sí sola no acredita una conexión: la API debe responder y la cuenta debe coincidir. No guardar credenciales en el repositorio, archivos de ejemplo, logs ni variables `NEXT_PUBLIC_*`.

Un propietario o administrador de StackAdapt puede generar llaves de lectura. La habilitación de escritura exige coordinación con StackAdapt. Una llave con WRITE no habilita acciones de escritura en este módulo. La facturación de medios y el inventario se gestionan en la cuenta del proveedor.

## Alcance y permisos

- Página y API exigen una sesión con `is_platform_admin`. No se comparten los anunciantes de la cuenta con usuarios de clientes. Una futura vista de cliente requerirá una vinculación explícita entre empresa, cliente y anunciante.
- Cada consulta vuelve a comprobar cuenta, vigencia y permisos. Los anunciantes archivados o sin READ quedan excluidos del selector.
- La llave nunca llega al navegador. No se aceptan URLs ni consultas GraphQL suministradas por el usuario; solo se ejecutan tres consultas fijas en `https://api.stackadapt.com/graphql`.
- Redirecciones prohibidas, tiempo máximo por solicitud, respuesta acotada y `no-store`. Los errores de proveedor no se muestran en bruto.
- Los resultados incluyen campañas archivadas del anunciante para el período indicado. La lista de campañas, en cambio, omite archivadas. Se conserva la moneda de la cuenta y no se convierte a USD.
- Un reporte en preparación se muestra como tal. Una métrica ausente se muestra como «—», nunca como cero. `MoneyValue` está expresado en unidades monetarias, no en centavos; las conversiones pueden ser fraccionarias.
- El módulo pagina campañas de 100 en 100 y limita el intervalo de reporte a 93 días. Hasta 20 páginas de permisos; si se supera ese límite, se solicita restringir el alcance de la llave.

## Prueba de aceptación con credencial real

1. Verificar cuenta, moneda, permisos, vigencia y anunciantes en One.
2. Elegir un anunciante y comparar campañas/estados con StackAdapt.
3. Consultar un período cerrado y contrastar inversión, impresiones, clics y conversiones con el reporte del mismo período en StackAdapt.
4. Confirmar que un usuario de cliente y una sesión anónima no pueden consultar `/api/digital/dsp/stackadapt`.

Las pruebas automatizadas usan respuestas sintéticas y no acreditan acceso a una cuenta real. La aceptación de datos vivos requiere una llave habilitada.

## Referencias oficiales

- [API GraphQL](https://docs.stackadapt.com/graphql)
- [Referencia del esquema](https://docs.stackadapt.com/graphql/reference)
- [Administración de llaves](https://support.stackadapt.com/hc/en-us/articles/32798717073175-Managing-API-Keys)
- [Reportes](https://docs.stackadapt.com/graphql/scenarios/delivery-reports)
