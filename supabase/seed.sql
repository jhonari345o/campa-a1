-- =====================================================================
--  AD MAVERICKS ONE — Datos iniciales (seed)
--  Ejecutar DESPUES de schema.sql.
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. Primer administrador de plataforma (equipo Ad Mavericks)
--    Paso A: crea el usuario en Supabase -> Authentication -> Add user
--            (con correo y contrasena). Copia su UUID.
--    Paso B: reemplaza el correo de abajo y ejecuta. Marca ese perfil
--            como administrador de plataforma para poder usar la Consola.
-- ------------------------------------------------------------------
update public.profiles
set is_platform_admin = true
where email = 'admin@admavericks.one';   -- <-- CAMBIAR por el correo real

-- ------------------------------------------------------------------
-- 2. Fuentes de datos de la base de inversion publicitaria
-- ------------------------------------------------------------------
insert into public.data_sources (name, category, url, notes) values
  ('Superintendencia de Companias, Valores y Seguros', 'oficial',
   'https://www.supercias.gob.ec', 'Informacion societaria y financiera de companias en Ecuador.'),
  ('Superintendencia de Bancos del Ecuador', 'oficial',
   'https://www.superbancos.gob.ec', 'Informacion del sistema financiero.'),
  ('Canales de television (informacion publica)', 'medio',
   null, 'Inversion publicitaria reportada de forma publica por canales de TV.'),
  ('Google Ads', 'plataforma',
   'https://ads.google.com', 'Metricas de campanas y benchmarks de buscadores/display.'),
  ('Google Analytics', 'plataforma',
   'https://analytics.google.com', 'Comportamiento y conversiones en sitios y apps.'),
  ('Meta Ads (Facebook / Instagram)', 'plataforma',
   'https://www.facebook.com/business/ads', 'Metricas de campanas en redes sociales.')
on conflict do nothing;
