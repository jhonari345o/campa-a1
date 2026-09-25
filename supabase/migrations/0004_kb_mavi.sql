-- =====================================================================
--  Migracion 0004 — Base de conocimiento de Mavi (giros, canales, campanas)
--  Pequena base para que Mavi asesore de forma conversacional, sin Internet.
--  Aplicar en Supabase -> SQL Editor -> Run. Seguro re-ejecutar.
-- =====================================================================

-- ---- Tablas ----
create table if not exists public.kb_giros (
  id      uuid primary key default gen_random_uuid(),
  giro    text unique not null,
  publico text,
  canales text,
  tono    text,
  ideas   text
);

create table if not exists public.kb_canales (
  id            uuid primary key default gen_random_uuid(),
  canal         text unique not null,
  para_que      text,
  como_invertir text,
  formato       text,
  tip           text
);

create table if not exists public.kb_campanas (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null,   -- video | redes | tv | radio | whatsapp
  titulo     text not null,
  estructura text
);

-- ---- RLS: lectura/escritura solo equipo Ad Mavericks (Mavi las lee con la
--      clave de servicio del lado del servidor) ----
alter table public.kb_giros    enable row level security;
alter table public.kb_canales  enable row level security;
alter table public.kb_campanas enable row level security;
do $$
declare t text;
begin
  foreach t in array array['kb_giros','kb_canales','kb_campanas'] loop
    execute format('drop policy if exists %I_admin on public.%I', t, t);
    execute format('create policy %I_admin on public.%I for all using (public.is_platform_admin()) with check (public.is_platform_admin())', t, t);
  end loop;
end $$;

-- ---- Datos: giros de negocio ----
insert into public.kb_giros (giro, publico, canales, tono, ideas) values
('cafeteria','Jovenes y oficinistas 18-40, urbano','Instagram, TikTok, WhatsApp, Google Maps','Calido, fresco, cercano','Promos de cafe del dia, contenido de barismo, alianzas con creadores locales'),
('restaurante','Familias y parejas 25-55','Instagram, Facebook, Google, TikTok','Apetitoso, familiar','Reels de platos, resenas, promos de fin de semana, delivery'),
('farmacia','Amas de casa y adultos 30-65','Facebook, WhatsApp, Google, radio','Confiable, cercano','Consejos de salud, ofertas, recordatorio de vacunas, delivery de medicinas'),
('banco','Adultos 25-60, pymes','Google, YouTube, Facebook, TV, prensa','Serio, confiable','Educacion financiera, credito facil, seguridad, testimonios'),
('tienda de ropa','Jovenes 16-35, moda','Instagram, TikTok, influencers','Aspiracional, tendencia','Lookbooks, nuevas colecciones, descuentos por temporada, unboxing'),
('gimnasio','Jovenes y adultos 18-45, fitness','Instagram, TikTok, WhatsApp','Motivador, energico','Retos fitness, rutinas, testimonios de progreso, promos de inscripcion'),
('inmobiliaria','Adultos 30-55, inversionistas','Facebook, Google, YouTube, portales','Aspiracional, confiable','Tours de propiedades, financiamiento, plusvalia, testimonios'),
('salon de belleza','Mujeres 18-50','Instagram, TikTok, WhatsApp','Elegante, cercano','Antes y despues, tendencias, promos, agenda por WhatsApp'),
('cerveceria','Adultos 18-40, social','Instagram, TikTok, via publica, TV','Divertido, social','Activaciones, patrocinios, contenido de eventos, ediciones limitadas'),
('tecnologia','Jovenes y pymes 18-45','Google, YouTube, Facebook, TikTok','Innovador, claro','Demos de producto, comparativas, ofertas, soporte'),
('educacion','Padres y jovenes 16-40','Facebook, Google, YouTube, radio','Confiable, motivador','Historias de exito, becas, jornadas de puertas abiertas, testimonios'),
('ferreteria','Adultos 25-60, hogar y construccion','Facebook, Google, WhatsApp, radio','Practico, cercano','Tips de bricolaje, ofertas de temporada, catalogo por WhatsApp')
on conflict (giro) do nothing;

-- ---- Datos: canales ----
insert into public.kb_canales (canal, para_que, como_invertir, formato, tip) values
('Meta (Facebook e Instagram)','Alcance y comunidad; ideal para B2C','Campanas por objetivo (alcance, trafico, mensajes); segmentar por edad, ubicacion e intereses','Reels, historias, carruseles','Prueba 2-3 creatividades por publico y deja ganar a la mejor'),
('WhatsApp Business','Cierre de ventas y atencion directa','Boton de mensaje desde anuncios de Meta; catalogo y respuestas rapidas','Mensajes, catalogo','Responde en menos de 5 minutos para no perder al cliente'),
('Google (Busqueda y YouTube)','Captar demanda existente e intencion de compra','Search por palabras clave del giro; YouTube para awareness','Anuncios de texto, video','Usa palabras clave locales y extensiones de llamada'),
('TikTok','Awareness joven y contenido viral','Campanas de alcance/video; creatividades nativas','Video vertical corto','Contenido autentico gana a lo muy producido'),
('TV abierta','Cobertura masiva y confianza de marca','Spots por franja horaria; combinar con digital','Spot 15-30s','Concentra en horario estelar del publico objetivo'),
('TV pagada','Segmentacion por canal tematico','Pauta por canal/genero afin al publico','Spot 15-30s','Util para publicos especificos (deportes, noticias)'),
('Radio','Cercania local y frecuencia','Cunas por emisora y horario; menciones de locutor','Cuna 20-30s','La mencion en vivo del locutor genera mucha confianza'),
('Via publica','Presencia y recordacion local','Vallas y pantallas en zonas de alto trafico del publico','Grafica simple','Mensaje corto: una idea, una llamada a la accion')
on conflict (canal) do nothing;

-- ---- Datos: plantillas de campana / guiones ----
insert into public.kb_campanas (tipo, titulo, estructura) values
('video','Reel de producto (15-20s)','Gancho (0-3s: problema o deseo) -> Producto en accion (3-12s) -> Beneficio claro -> Llamada a la accion + marca'),
('redes','Carrusel de oferta','Portada con la oferta -> 3-4 tarjetas de beneficios o pasos -> Ultima tarjeta con CTA y datos de contacto'),
('tv','Spot TV 20s','Escena de apertura con el publico objetivo -> Presentacion del producto/servicio -> Beneficio principal -> Cierre con logo, slogan y CTA'),
('radio','Cuna de radio 30s','Efecto o gancho auditivo -> Problema del oyente -> Solucion (marca) -> Oferta -> Repetir marca y como contactar (2 veces)'),
('whatsapp','Secuencia de WhatsApp','Mensaje 1: saludo + valor -> Mensaje 2: catalogo/oferta -> Mensaje 3: pregunta para agendar o cerrar la venta'),
('redes','Campana de lanzamiento','Expectativa (teaser) -> Revelacion del producto -> Prueba social/testimonios -> Oferta de lanzamiento por tiempo limitado')
on conflict do nothing;
