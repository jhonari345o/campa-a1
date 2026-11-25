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


## Reportes visuales (19 de noviembre de 2026)

`/digital/dsp`, accesible también desde Reportes para administradores, contiene filtros por anunciante, campaña y período (hasta 93 días), indicadores, barras diarias de impresiones/clics/inversión, dispositivos, regiones y resultados por campaña. Permite descargar los datos diarios en CSV e imprimir el reporte.

- `mode=dashboard`: resumen TOTAL y serie GRAPH/DAILY de `campaignDelivery`; recorre todas las páginas de campañas antes de devolver el resultado.
- `mode=breakdowns`: `campaignInsight` con DEVICE_TYPE y COUNTRY/REGION, paginado y agregado por dimensión. Carga por separado para no bloquear los indicadores.
- Ambos modos conservan el acceso exclusivo de administradores. Una campaña seleccionada se valida contra su anunciante y ambos filtros se envían al proveedor. Cada fila de campaña o desglose debe pertenecer al anunciante autorizado.
- El alcance y la frecuencia se conservan del total del período informado por StackAdapt (`uniqueImpressionsBigint`, `frequency`). Se muestran como identificadores únicos, no como personas verificadas. No se suman entre días ni campañas.
- CTR, CPM y CPC se calculan con los totales y no promediando ratios. Un denominador cero o dato ausente muestra «—».
- Los huecos de la serie solo se completan con cero cuando todos los indicadores aditivos concilian con el total. Si no concilian, permanecen sin dato y el panel indica que el desglose está incompleto.
- Las fechas conservan el calendario informado por StackAdapt; la hora de consulta se presenta en America/Guayaquil. El panel indica ambas bases.
- Cambiar anunciante, campaña o fechas cancela las consultas anteriores y retira los resultados anteriores. Las respuestas tardías no pueden reemplazar la selección vigente.
- No se incorporan segmentos demográficos o métricas de otras plataformas si no vienen de la fuente. No se ha otorgado acceso a usuarios finales ni establecido correspondencias automáticas con los clientes internos de One.

Validación: pruebas de autorización, paginación, aislamiento de campaña/anunciante, alcance no aditivo, cifras nulas, ratios, fechas y conciliación diaria; contraste de lectura real con SUPER EASY (1 oct–18 nov de 2026), selección de su campaña de noviembre y rechazo de esa campaña bajo otro anunciante. Sin activar ni modificar campañas.
