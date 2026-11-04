# Social Media

Ruta privada: `/social-media`. Ejecutar `supabase/migrations/0050_social_media.sql` antes del despliegue. Reutiliza Supabase Auth, los espacios de trabajo y `workspace_clients`; no usa la clave administrativa.

Cada cliente mantiene su ficha de marca, logo oficial y manual seleccionado. Los archivos se conservan como versiones inmutables en un bucket privado. La aplicación admite PNG, JPG y WebP para logos, y PDF para manuales, hasta 4 MB por archivo. Los logos se validan y se almacenan con sus bytes originales. Las descargas requieren sesión y permisos del mismo espacio. Mavi aplica las reglas textuales de la ficha; no interpreta automáticamente el PDF.

El briefing contiene objetivo, público, oferta confirmada, pilares, fechas clave y canales. Cada período guarda hasta 120 publicaciones con fecha y hora de Ecuador, formato, dirección creativa, CTA, caption y estado. El calendario puede exportarse como CSV con protección frente a fórmulas de hoja de cálculo. La fecha es editorial: este módulo no conecta cuentas ni publica en redes.

Los administradores y planificadores de agencia editan; los administradores y aprobadores de agencia aprueban. Los planificadores de cliente editan únicamente si su espacio tiene habilitada la planificación. Los lectores consultan. Los proveedores no tienen acceso. Los administradores de plataforma eligen explícitamente el espacio cuando existe más de uno.

Los guardados usan revisión esperada para evitar sobrescrituras concurrentes. Solo la función de aprobación puede aprobar. Cambiar contenido o briefing revoca la aprobación; cambiar la versión de marca exige una nueva revisión. La aprobación requiere caption, logo, tono y reglas guardados. Nunca implica publicación.

Los captions usan el proveedor y las opciones gratuitas configuradas para Mavi, con una reserva atómica por usuario cada 30 segundos. Se requieren `AI_ASSISTANT_ENABLED=true`, un proveedor configurado, permiso de edición y reglas de marca guardadas. Una solicitud fallida mantiene el contenido existente. Se devuelven tres opciones para selección humana.

Validación: pruebas de reglas y archivos en `tests/social-media.test.ts`; el control de calidad del repositorio ejecuta TypeScript, ESLint, pruebas y compilación. La migración debe comprobarse también con RLS y roles efectivos antes de habilitar el módulo en otro entorno.
