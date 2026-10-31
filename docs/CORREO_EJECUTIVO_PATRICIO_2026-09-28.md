# Correo ejecutivo — Ad Mavericks One

**De:** programacion@myverix.com  
**Para:** patricio@ad-mavericks.com  
**Asunto:** Entrega técnica y estado ejecutivo de Ad Mavericks One

Hola Patricio,

Te comparto la entrega y el estado ejecutivo de **Ad Mavericks One**, plataforma desarrollada para centralizar la planificación, compra, coordinación y reportería de medios publicitarios.

## Entrega disponible

La plataforma está publicada en **https://one.ad-mavericks.com**, alojada en AWS Amplify, con HTTPS y el dominio administrado desde Squarespace. El sitio principal, el correo corporativo y sus registros DNS no fueron alterados.

Se dejó implementado y validado técnicamente lo siguiente:

- Identidad oficial de Ad Mavericks: logotipo, isotipo, colores y favicon aplicados al sitio público, login y panel privado.
- Sitio público sin precios fijos: todos los planes se presentan como soluciones sujetas a cotización personalizada y con el botón **Cotizar con acceso**.
- Login cerrado con Supabase Auth: no existe autorregistro público; solo ingresan cuentas creadas por administración.
- Consola administrativa multiempresa con aislamiento de datos, perfiles, roles y registro de auditoría.
- Alta segura de nuevos administradores desde el panel. Solo un administrador total puede crear otro; la contraseña temporal se muestra una vez y la operación queda auditada.
- Carga administrativa de anunciantes, medios, inversiones y métricas para alimentar la base de mercado.
- Planificador de medios por rubro, objetivo, audiencia, geografía, presupuesto y canales seleccionados.
- Catálogos de televisión, radio, vía pública, prensa, digital e influenciadores, con fichas, programas, horarios, tarifas referenciales y recursos visuales disponibles.
- Mapa de Ecuador y segmentación geográfica por ciudad, centro y radio, con inventario de vallas y visualización de ubicaciones.
- Mavi integrada como asistente flotante y centro de procesos, conectada a OpenRouter y preparada para consultar tendencias actuales.
- Laboratorio creativo con análisis local de imágenes y videos, revisión de formato, copy, CTA, audio, subtítulos y derechos comerciales.
- Gestión de planes guardados, órdenes, campañas y flujo de coordinación.
- Reportería y post-buy para campañas Warner 2026, con impactos, alcance, evidencias, logos de medios y estado amarillo cuando la evidencia está pendiente.
- Estructura de Meta Marketing API para seleccionar cuenta publicitaria, página, Instagram y línea de crédito.
- Integración técnica de PagoPlux con autorización del pago, webhook firmado y conciliación antes de habilitar una orden.
- Avisos de privacidad, términos, tratamiento de datos, conservación, facturación, devoluciones, contracargos y eliminación de datos.
- Despliegue automático desde GitHub hacia AWS Amplify, con pruebas de TypeScript, seguridad y compilación.

## Estado de validación

La versión publicada pasó las pruebas automatizadas y la compilación de producción. El dominio, la portada, el login y los recursos gráficos responden correctamente por HTTPS.

La plataforma está lista para demostración comercial y carga controlada de información. Para activar pagos y pauta real todavía deben cerrarse estas validaciones externas:

1. Conectar las credenciales productivas definitivas de PagoPlux y completar un pago controlado con webhook conciliado.
2. Conectar el token, cuenta publicitaria, página e Instagram definitivos de Meta; confirmar la línea de crédito y crear primero una campaña en estado `PAUSED`.
3. Aplicar y verificar en Supabase las migraciones finales de reportería/post-buy y checkout, si aún no se han ejecutado en producción.
4. Completar evidencia operativa de MFA, WAF, restauración de respaldos, límites de abuso y prueba de aislamiento entre empresas.
5. Validar con contabilidad y asesoría legal el tratamiento del componente del 22%, la facturación, devoluciones y contracargos antes de cobrar al público.

## Proyección comercial orientativa

La proyección utiliza únicamente la comisión operativa del **25% sobre la inversión publicitaria administrada**. El componente del 22% se trata como impuesto o cobertura fiscal y **no se contabiliza como ingreso** hasta que contabilidad confirme su tratamiento. Tampoco se incluyen cargos personalizados de implementación, soporte o licenciamiento, por lo que existe potencial adicional.

| Escenario | Clientes activos | Inversión media por cliente/mes | Pauta administrada/mes | Comisión 25%/mes | Comisión anual |
|---|---:|---:|---:|---:|---:|
| Conservador | 8 | USD 2.500 | USD 20.000 | USD 5.000 | USD 60.000 |
| Base | 20 | USD 4.000 | USD 80.000 | USD 20.000 | USD 240.000 |
| Crecimiento | 40 | USD 6.000 | USD 240.000 | USD 60.000 | USD 720.000 |

El escenario base requiere captar aproximadamente veinte clientes activos y mantener una inversión media mensual de USD 4.000 por cliente. La rentabilidad puede aumentar con cotizaciones de acceso, implementación, reportería premium, acompañamiento estratégico y mayor volumen negociado con medios.

## Próximo paso recomendado

Propongo realizar una sesión de cierre con tecnología, comercial, contabilidad y operaciones para asignar responsables a los cinco pendientes externos, ejecutar una campaña piloto controlada y aprobar el lanzamiento comercial.

Quedo atento para coordinar la demostración y el cierre de producción.

Saludos,

**Equipo de Programación Myverix**  
programacion@myverix.com
