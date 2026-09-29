-- Warner 2026 - campañas y ubicaciones de Reportería/Post-buys
-- Ejecutar después de supabase/migrations/0015_reporting_postbuys.sql.

begin;

insert into public.postbuy_campaigns
  (id, company_id, client_name, execution_month, campaign_name, status,
   ooh_reach, radio_reach, total_reach, source_file, source_sheet)
values
('21f3bab4-d7c9-5431-b64e-fc02f9a2fb6f'::uuid, null, 'Warner Bros. Discovery Ecuador', '2026-01-01'::date, 'Wuthering Heights', 'completed', 0.113, null, null, 'Warner_medios_2026_con_imagenes.xlsx', 'Wuthering Heights'),
('bd3261cc-ff2c-57a1-bc9b-884d1a238f04'::uuid, null, 'Warner Bros. Discovery Ecuador', '2026-02-01'::date, 'The Bride', 'partial', 0.136, 0.115, 0.2354, 'Warner_medios_2026_con_imagenes.xlsx', 'The Bride'),
('719294d5-749a-5298-9580-5252a74fd2ad'::uuid, null, 'Warner Bros. Discovery Ecuador', '2026-03-01'::date, 'They Will Kill You', 'completed', 0.214, null, null, 'Warner_medios_2026_con_imagenes.xlsx', 'They Will Kill You'),
('b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, null, 'Warner Bros. Discovery Ecuador', '2026-04-01'::date, 'La Momia', 'partial', 0.27, 0.06, 0.3138, 'Warner_medios_2026_con_imagenes.xlsx', 'La Momia'),
('661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, null, 'Warner Bros. Discovery Ecuador', '2026-04-01'::date, 'Mortal Kombat 2', 'completed', 0.285, null, null, 'Warner_medios_2026_con_imagenes.xlsx', 'Mortal Kombat 2'),
('5be5eb46-cb03-53ff-be5f-58fbc898c5bb'::uuid, null, 'Warner Bros. Discovery Ecuador', '2026-06-01'::date, 'Supergirl', 'partial', 0.3, null, null, 'Warner_medios_2026_con_imagenes.xlsx', 'Supergirl'),
('9d748224-3143-5124-acfc-c22700c4d111'::uuid, null, 'Warner Bros. Discovery Ecuador', '2026-07-01'::date, 'Oak Street', 'partial', 0.175, 0.12, 0.274, 'Warner_medios_2026_con_imagenes.xlsx', 'Oak Street')
on conflict (id) do update set
  client_name = excluded.client_name,
  execution_month = excluded.execution_month,
  campaign_name = excluded.campaign_name,
  status = excluded.status,
  ooh_reach = excluded.ooh_reach,
  radio_reach = excluded.radio_reach,
  total_reach = excluded.total_reach,
  source_file = excluded.source_file,
  source_sheet = excluded.source_sheet,
  updated_at = now();

insert into public.postbuy_placements
  (id, campaign_id, channel, media_name, placement_name, element_quantity,
   media_rights, monthly_impacts, evidence_image_url, media_logo_url,
   evidence_status, source_note, source_row, display_order)
values
('75cd7d76-166f-593d-9603-cd8aa0416fee'::uuid, '21f3bab4-d7c9-5431-b64e-fc02f9a2fb6f'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Av. 6 de Diciembre y Río Coca, diagonal Riocentro Norte (S-0226)', 1, null, 1100000, '/postbuy/warner/evidence/wuthering-heights/08-valla-led-quito-av-6-de-diciembre-y-rio-coca-diagonal-riocentro-norte-s-.webp', null, 'verified', 'Fotograma de la campaña.', 8, 1),
('b40979eb-0060-5774-8f78-52d933c6dc80'::uuid, '21f3bab4-d7c9-5431-b64e-fc02f9a2fb6f'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Av. América y Naciones Unidas, frente a Plaza de las Américas (S-1878)', 1, null, 812000, '/postbuy/warner/evidence/wuthering-heights/09-valla-led-quito-av-america-y-naciones-unidas-frente-a-plaza-de-las-ameri.webp', null, 'verified', 'Fotograma de la campaña.', 9, 2),
('f308bf1c-394f-51d3-8b31-f28d5234cd01'::uuid, '21f3bab4-d7c9-5431-b64e-fc02f9a2fb6f'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Área Guayaquil · Riocentro El Dorado', 5, null, 720000, '/postbuy/warner/evidence/wuthering-heights/10-totem-led-area-guayaquil-riocentro-el-dorado.webp', null, 'verified', 'Fotografía de la campaña.', 10, 3),
('69aefaf8-ba39-53b3-b239-bf12c265881a'::uuid, '21f3bab4-d7c9-5431-b64e-fc02f9a2fb6f'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Área Guayaquil · Village', 4, null, 500000, '/postbuy/warner/evidence/wuthering-heights/11-totem-led-area-guayaquil-village.webp', null, 'verified', 'Fotografía de la campaña.', 11, 4),
('db1ad443-8a5b-54d7-8757-3ff7872b3bf8'::uuid, 'bd3261cc-ff2c-57a1-bc9b-884d1a238f04'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Estadio Atahualpa, Av. 6 de Diciembre', 1, null, 1400000, '/postbuy/warner/evidence/the-bride/08-valla-led-quito-estadio-atahualpa-av-6-de-diciembre.webp', null, 'verified', 'Fotograma de la campaña.', 8, 1),
('5bb84861-223e-5afc-9ce7-034b23f249b9'::uuid, 'bd3261cc-ff2c-57a1-bc9b-884d1a238f04'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Guayaquil · Mall del Sol', 5, null, 1100000, '/postbuy/warner/evidence/the-bride/09-totem-led-guayaquil-mall-del-sol.webp', null, 'verified', 'Fotograma de la campaña.', 9, 2),
('9df5a2aa-f8f0-533b-9082-a2eda9c8e5a5'::uuid, 'bd3261cc-ff2c-57a1-bc9b-884d1a238f04'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Guayaquil · Riocentro Ceibos', 5, null, 650000, '/postbuy/warner/evidence/the-bride/10-totem-led-guayaquil-riocentro-ceibos.webp', null, 'verified', 'Fotografía de la campaña.', 10, 3),
('6b0fbb20-eebd-52c4-af3e-a9e52d523107'::uuid, 'bd3261cc-ff2c-57a1-bc9b-884d1a238f04'::uuid, 'btl', 'Arco', 'Arco · Guayaquil · Supercines Orellana', 1, null, 175000, null, null, 'pending', 'Arte del arco de The Bride.
Foto de ubicación pendiente.
Confirmar sede: Excel Orellana; correo de producción Ceibos.', 11, 4),
('e5bc9c8c-3ea5-5bec-8021-6e459597c53e'::uuid, 'bd3261cc-ff2c-57a1-bc9b-884d1a238f04'::uuid, 'btl', 'Arco', 'Arco · Quito · Multicines CCI', 1, null, 220000, null, null, 'pending', 'Referencia de la misma ubicación.
Imagen de La Momia.
Foto de The Bride pendiente.', 12, 5),
('4ef09e43-bf1f-5404-9f82-755c91594be3'::uuid, 'bd3261cc-ff2c-57a1-bc9b-884d1a238f04'::uuid, 'radio', 'FM Mundo', 'FM Mundo · Hola Mundo', null, 40, null, null, '/postbuy/warner/logos/fm-mundo.png', 'pending', 'Logo de FM Mundo.
Fuente oficial.
Validar período: audios de marzo; plan de febrero.', 13, 6),
('90ff4ab4-ca01-5374-b62b-08e9a83d2253'::uuid, 'bd3261cc-ff2c-57a1-bc9b-884d1a238f04'::uuid, 'radio', 'Blue Radio', 'Blue Radio · Encuentro', null, 50, null, null, '/postbuy/warner/logos/blue-radio-1013.png', 'pending', 'Logo de Blue Radio 101.3.
Fuente oficial.
Validar período: audios de marzo; plan de febrero.', 14, 7),
('f160eed9-b37e-5893-a90b-d8af96871b5c'::uuid, '719294d5-749a-5298-9580-5252a74fd2ad'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Área Guayaquil · Riocentro El Dorado', 3, null, 620000, '/postbuy/warner/evidence/they-will-kill-you/08-totem-led-area-guayaquil-riocentro-el-dorado.webp', null, 'verified', 'Fotografía de la campaña.', 8, 1),
('275ce6b1-3559-5dd4-825b-3666deb6a5d5'::uuid, '719294d5-749a-5298-9580-5252a74fd2ad'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Área Guayaquil · Riocentro Ceibos', 3, null, 550000, '/postbuy/warner/evidence/they-will-kill-you/09-totem-led-area-guayaquil-riocentro-ceibos.webp', null, 'verified', 'Fotografía de la campaña.', 9, 2),
('e0f93a47-23d8-5193-9ddb-454120596164'::uuid, '719294d5-749a-5298-9580-5252a74fd2ad'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Área Guayaquil · Riocentro Entre Ríos', 3, null, 465000, '/postbuy/warner/evidence/they-will-kill-you/10-totem-led-area-guayaquil-riocentro-entre-rios.webp', null, 'verified', 'Fotografía de la campaña.', 10, 3),
('59bf0ede-a319-57c4-b4ba-5649afbe0b4d'::uuid, '719294d5-749a-5298-9580-5252a74fd2ad'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Área Guayaquil · Riocentro Sur', 3, null, 700000, '/postbuy/warner/evidence/they-will-kill-you/11-totem-led-area-guayaquil-riocentro-sur.webp', null, 'verified', 'Fotografía de la campaña.', 11, 4),
('2b41e211-4136-551e-a7c6-58e8387a9eaa'::uuid, '719294d5-749a-5298-9580-5252a74fd2ad'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Área Guayaquil · Riocentro Norte', 2, null, 630000, '/postbuy/warner/evidence/they-will-kill-you/12-totem-led-area-guayaquil-riocentro-norte.webp', null, 'verified', 'Fotografía de la campaña.', 12, 5),
('4d53f015-0bed-5ebd-bf99-e352b4ebb647'::uuid, '719294d5-749a-5298-9580-5252a74fd2ad'::uuid, 'ooh', 'Valla LED', 'Valla LED · Guayaquil · City Mall', 1, null, 1250000, '/postbuy/warner/evidence/they-will-kill-you/13-valla-led-guayaquil-city-mall.webp', null, 'verified', 'Fotograma de la campaña.', 13, 6),
('e287ddd7-d984-526f-8483-35f1b303b5ac'::uuid, '719294d5-749a-5298-9580-5252a74fd2ad'::uuid, 'ooh', 'Valla LED', 'Valla LED · Guayaquil · Pedro Menéndez', 1, null, 1300000, '/postbuy/warner/evidence/they-will-kill-you/14-valla-led-guayaquil-pedro-menendez.webp', null, 'verified', 'Fotograma de la campaña.', 14, 7),
('e67608bf-b0d6-523d-b5e2-6594cf6437a4'::uuid, '719294d5-749a-5298-9580-5252a74fd2ad'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Estadio Atahualpa', 1, null, 1400000, '/postbuy/warner/evidence/they-will-kill-you/15-valla-led-quito-estadio-atahualpa.webp', null, 'verified', 'Fotograma de la campaña.', 15, 8),
('b4556b91-5028-530d-96cf-3f494292af5f'::uuid, '719294d5-749a-5298-9580-5252a74fd2ad'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Cumbayá', 1, null, 1260000, '/postbuy/warner/evidence/they-will-kill-you/16-valla-led-quito-cumbaya.webp', null, 'verified', 'Fotograma de la campaña.', 16, 9),
('b9411aef-ecef-53ce-9f45-ca818015ea9e'::uuid, '719294d5-749a-5298-9580-5252a74fd2ad'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Av. 6 de Diciembre', 1, null, 1100000, '/postbuy/warner/evidence/they-will-kill-you/17-valla-led-quito-av-6-de-diciembre.webp', null, 'verified', 'Fotograma de la campaña.', 17, 10),
('c5233457-eeb7-515d-9749-6c0816035f64'::uuid, '719294d5-749a-5298-9580-5252a74fd2ad'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Av. de los Shyris', 1, null, 1000000, '/postbuy/warner/evidence/they-will-kill-you/18-valla-led-quito-av-de-los-shyris.webp', null, 'verified', 'Fotograma de la campaña.', 18, 11),
('9d469239-afcf-5037-9f08-06774cd2d82a'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Guayaquil · Mall del Sol', 5, null, 1100000, '/postbuy/warner/evidence/la-momia/08-totem-led-guayaquil-mall-del-sol.webp', null, 'verified', 'Fotograma de la campaña.', 8, 1),
('112b4138-680d-5a51-8e0c-7933263eb923'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Guayaquil · Riocentro Sur', 5, null, 800000, '/postbuy/warner/evidence/la-momia/09-totem-led-guayaquil-riocentro-sur.webp', null, 'verified', 'Fotografía de la campaña.', 9, 2),
('df3acb7f-bf14-548b-97b2-61a956f128c4'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Diego Vásquez y Juan Celis', 1, null, 1200000, '/postbuy/warner/evidence/la-momia/10-valla-led-quito-diego-vasquez-y-juan-celis.webp', null, 'verified', 'Fotograma de la campaña.', 10, 3),
('7edf10bc-0991-5c63-bfa5-c8a15a9754ee'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Av. 6 de Diciembre y California', 1, null, 1100000, '/postbuy/warner/evidence/la-momia/11-valla-led-quito-av-6-de-diciembre-y-california.webp', null, 'verified', 'Fotograma de la campaña.', 11, 4),
('9cdabb5a-ab04-5b7b-995a-30b79beca0c1'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Av. de los Shyris y El Salvador', 1, null, 1000000, '/postbuy/warner/evidence/la-momia/12-valla-led-quito-av-de-los-shyris-y-el-salvador.webp', null, 'verified', 'Fotograma de la campaña.', 12, 5),
('9bfc0d28-70da-509d-9e02-3f5ddec4fa62'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'ooh', 'Valla fija troquelada', 'Valla fija troquelada · Guayaquil · Sector Riocentro Norte; Fco Orellana', 1, null, 2000000, '/postbuy/warner/evidence/la-momia/13-valla-fija-troquelada-guayaquil-sector-riocentro-norte-fco-orellana.webp', null, 'verified', 'Fotografía de la campaña.', 13, 6),
('74246a96-7227-5041-9036-2b4bb59edef7'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'ooh', 'Mupi', 'Mupi · Guayaquil · Jardines del Malecón', 1, null, 1200000, null, null, 'pending', 'Referencia de la misma ubicación.
Imagen de Mortal Kombat 2.
Foto de La Momia pendiente.', 14, 7),
('81dbffe0-dbd4-5f75-b3fc-396b5583b351'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'ooh', 'Mupi', 'Mupi · Guayaquil · Sucre y García Avilés', 1, null, 900000, null, null, 'pending', 'Referencia de la misma ubicación.
Imagen de Mortal Kombat 2.
Foto de La Momia pendiente.', 15, 8),
('f587dc99-3938-50ef-9505-0370689b254c'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'ooh', 'Mupi', 'Mupi · Guayaquil · Mall del Sur', 1, null, 1500000, null, null, 'pending', 'Referencia de la misma ubicación.
Imagen de Mortal Kombat 2.
Foto de La Momia pendiente.', 16, 9),
('88a75804-d005-5071-a102-e76ddc88d2ef'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'ooh', 'Mupi', 'Mupi · Guayaquil · Carlos Julio Arosemena', 1, null, 1300000, null, null, 'pending', 'Referencia de la misma ubicación.
Imagen de Mortal Kombat 2.
Foto de La Momia pendiente.', 17, 10),
('37dcff9d-4b07-5a1c-90a4-1951c5b387c9'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'btl', 'Arco', 'Arco · Quito · Multicines CCI', 1, null, 1000000, '/postbuy/warner/evidence/la-momia/18-arco-quito-multicines-cci.webp', null, 'verified', 'Fotografía de la campaña.', 18, 11),
('80f9baf7-21f6-5614-88e8-3196d761cf24'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'btl', 'Arco', 'Arco · Guayaquil · Riocentro Ceibos', 1, null, 220000, '/postbuy/warner/evidence/la-momia/19-arco-guayaquil-riocentro-ceibos.webp', null, 'verified', 'Fotografía de la campaña.', 19, 12),
('f5a50d5e-f8d8-572e-a25c-a9c48d2af351'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'btl', 'Arco', 'Arco · Guayaquil · San Marino', 1, null, 260000, null, null, 'pending', 'Arte del arco de La Momia.
Previsto para San Marino.
Foto de instalación pendiente.', 20, 13),
('ad05dc2d-e12f-549c-815f-539f95884bb7'::uuid, 'b1d1daca-e9b1-50bc-83f8-a80ecadaded9'::uuid, 'radio', 'Fuego', 'Fuego · ¿Qué pasa con Mariela?', null, 50, null, null, '/postbuy/warner/logos/radio-fuego-1065.jpg', 'pending', 'Logo de Radio Fuego 106.5.
Fuente oficial.', 21, 14),
('cd4d8c9e-29b0-5544-b86c-cff8b1f5eac1'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Área Guayaquil · Riocentro Norte', 3, null, 630000, '/postbuy/warner/evidence/mortal-kombat-2/08-totem-led-area-guayaquil-riocentro-norte.webp', null, 'verified', 'Fotografía de la campaña.', 8, 1),
('ccb18156-a66d-5193-b0a0-a506074f5e2c'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Área Guayaquil · Riocentro El Dorado', 3, null, 750000, '/postbuy/warner/evidence/mortal-kombat-2/09-totem-led-area-guayaquil-riocentro-el-dorado.webp', null, 'verified', 'Fotografía de la campaña.', 9, 2),
('29fd33a8-21ab-514b-a7c1-294f218471eb'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Área Guayaquil · Riocentro Sur', 2, null, 700000, '/postbuy/warner/evidence/mortal-kombat-2/10-totem-led-area-guayaquil-riocentro-sur.webp', null, 'verified', 'Fotografía de la campaña.', 10, 3),
('25bf9995-7bcc-5ebc-a05b-ff574c3ca75b'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Tótem LED', 'Tótem LED · Área Guayaquil · Riocentro Ceibos', 2, null, 550000, '/postbuy/warner/evidence/mortal-kombat-2/11-totem-led-area-guayaquil-riocentro-ceibos.webp', null, 'verified', 'Fotografía de la campaña.', 11, 4),
('e2dce8ae-2a5f-5fc0-a50c-0a0f3f34b1d2'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Valla LED', 'Valla LED · Área Guayaquil · Vía a Salitre, sector El Dorado', 1, null, 1150000, '/postbuy/warner/evidence/mortal-kombat-2/12-valla-led-area-guayaquil-via-a-salitre-sector-el-dorado.webp', null, 'verified', 'Fotograma de la campaña.', 12, 5),
('23d17f01-1c60-5a32-bdd6-0cb9ba8d4b54'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Av. Morán Valverde, sector Quicentro Sur', 1, null, 1275000, '/postbuy/warner/evidence/mortal-kombat-2/13-valla-led-quito-av-moran-valverde-sector-quicentro-sur.webp', null, 'verified', 'Fotograma de la campaña.', 13, 6),
('b97ada53-cd81-5f8c-b7e6-98d42cf39d89'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Valla LED', 'Valla LED · Guayaquil · Av. del Bombero, Ceibos', 1, null, 1200000, '/postbuy/warner/evidence/mortal-kombat-2/14-valla-led-guayaquil-av-del-bombero-ceibos.webp', null, 'verified', 'Fotograma de la campaña.', 14, 7),
('71c07ac4-8477-54c1-b514-1db6f5560dae'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Valla LED', 'Valla LED · Guayaquil · Plaza Dañín', 1, null, 1130000, '/postbuy/warner/evidence/mortal-kombat-2/15-valla-led-guayaquil-plaza-danin.webp', null, 'verified', 'Fotograma de la campaña.', 15, 8),
('8043249e-bef2-5c67-8b77-33b3be094f14'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Valla LED', 'Valla LED · Guayaquil · José María Egas, puente hacia Samborondón', 1, null, 1500000, '/postbuy/warner/evidence/mortal-kombat-2/16-valla-led-guayaquil-jose-maria-egas-puente-hacia-samborondon.webp', null, 'verified', 'Fotograma de la campaña.', 16, 9),
('8269bbe2-8c0f-585a-8ebc-3c26024071bc'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Eloy Alfaro y República', 1, null, 1300000, '/postbuy/warner/evidence/mortal-kombat-2/17-valla-led-quito-eloy-alfaro-y-republica.webp', null, 'verified', 'Fotografía de la campaña.', 17, 10),
('b35065b9-0f10-51df-9676-7f8277359270'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Mupi', 'Mupi · Guayaquil · Jardines del Malecón', 1, null, 1200000, '/postbuy/warner/evidence/mortal-kombat-2/18-mupi-guayaquil-jardines-del-malecon.webp', null, 'verified', 'Fotografía de la campaña.', 18, 11),
('b08e8beb-3e6c-5e49-bf87-26681d46d656'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Mupi', 'Mupi · Guayaquil · Sucre y García Avilés', 1, null, 900000, '/postbuy/warner/evidence/mortal-kombat-2/19-mupi-guayaquil-sucre-y-garcia-aviles.webp', null, 'verified', 'Fotografía de la campaña.', 19, 12),
('00de1dcc-9ff1-5399-9c7b-bc7251d00828'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Mupi', 'Mupi · Guayaquil · Mall del Sur', 1, null, 1500000, '/postbuy/warner/evidence/mortal-kombat-2/20-mupi-guayaquil-mall-del-sur.webp', null, 'verified', 'Fotografía de la campaña.', 20, 13),
('e334aee1-82e8-5205-a219-2b0e7a669271'::uuid, '661849d9-9de6-5740-b7f9-fa29ee795106'::uuid, 'ooh', 'Mupi', 'Mupi · Guayaquil · Carlos Julio Arosemena', 1, null, 1300000, '/postbuy/warner/evidence/mortal-kombat-2/21-mupi-guayaquil-carlos-julio-arosemena.webp', null, 'verified', 'Fotografía de la campaña.', 21, 14),
('cc9e923c-e18b-5761-be6f-05ea23b3ce9f'::uuid, '5be5eb46-cb03-53ff-be5f-58fbc898c5bb'::uuid, 'ooh', 'Valla fija', 'Valla fija · Guayaquil · Av. del Bombero', 1, null, 2300000, '/postbuy/warner/evidence/supergirl/08-valla-fija-guayaquil-av-del-bombero.webp', null, 'verified', 'Fotografía de la campaña.', 8, 1),
('1a6af9b6-d685-50be-93bc-4eb1cc5c81b5'::uuid, '5be5eb46-cb03-53ff-be5f-58fbc898c5bb'::uuid, 'ooh', 'Valla fija', 'Valla fija · Guayaquil · Av. Pedro Menéndez', 1, null, 2500000, '/postbuy/warner/evidence/supergirl/09-valla-fija-guayaquil-av-pedro-menendez.webp', null, 'verified', 'Fotografía de la campaña.', 9, 2),
('ee2a603b-e93c-5b5e-9b16-290d437883cd'::uuid, '5be5eb46-cb03-53ff-be5f-58fbc898c5bb'::uuid, 'ooh', 'Valla fija', 'Valla fija · Quito · América y Brasil', 1, null, 2200000, '/postbuy/warner/evidence/supergirl/10-valla-fija-quito-america-y-brasil.webp', null, 'verified', 'Fotografía de la campaña.', 10, 3),
('a77c65ce-e202-52b1-b735-7b0e9a9f881a'::uuid, '5be5eb46-cb03-53ff-be5f-58fbc898c5bb'::uuid, 'ooh', 'Valla fija', 'Valla fija · Quito · República y Bourgeois', 1, null, 2000000, '/postbuy/warner/evidence/supergirl/11-valla-fija-quito-republica-y-bourgeois.webp', null, 'verified', 'Fotografía de la campaña.', 11, 4),
('fcd0c76a-48e6-512f-9564-687136d45c24'::uuid, '5be5eb46-cb03-53ff-be5f-58fbc898c5bb'::uuid, 'ooh', 'Mural', 'Mural · Guayaquil · Av. 9 de Octubre (10 × 20 m)', 1, null, 3100000, '/postbuy/warner/evidence/supergirl/12-mural-guayaquil-av-9-de-octubre-10-20-m.webp', null, 'verified', 'Fotografía de la campaña.', 12, 5),
('89e3e362-ce6a-5a8c-9096-4060b046cbe9'::uuid, '5be5eb46-cb03-53ff-be5f-58fbc898c5bb'::uuid, 'ooh', 'Mural', 'Mural · Quito · Amazonas y Japón, formato horizontal', 1, null, 1900000, '/postbuy/warner/evidence/supergirl/13-mural-quito-amazonas-y-japon-formato-horizontal.webp', null, 'verified', 'Fotografía de la campaña.', 13, 6),
('145b7f63-225a-5348-a136-96c1d53c783c'::uuid, '5be5eb46-cb03-53ff-be5f-58fbc898c5bb'::uuid, 'ooh', 'LED bonificado', 'LED bonificado · Guayaquil · Av. del Bombero', 1, null, 1200000, null, null, 'pending', 'Referencia del LED bonificado.
Imagen con otro anunciante.
Foto de Supergirl pendiente.', 14, 7),
('16e93b8d-c1cf-56b5-a0c1-4a49cb8eac10'::uuid, '9d748224-3143-5124-acfc-c22700c4d111'::uuid, 'ooh', 'Valla fija troquelada', 'Valla fija troquelada · Guayaquil · Ceibos; av del bombero', 1, null, 2300000, '/postbuy/warner/evidence/oak-street/08-valla-fija-troquelada-guayaquil-ceibos-av-del-bombero.webp', null, 'verified', 'Fotografía de la campaña.', 8, 1),
('308c9728-0610-54ee-84af-1deeb1c3fb8f'::uuid, '9d748224-3143-5124-acfc-c22700c4d111'::uuid, 'ooh', 'Mupi LED', 'Mupi LED · Guayaquil · Pedro Menéndez', 1, null, 850000, '/postbuy/warner/evidence/oak-street/09-mupi-led-guayaquil-pedro-menendez.webp', null, 'verified', 'Fotograma de la campaña.', 9, 2),
('3eec0cdc-3e5b-5922-b286-affed2be1396'::uuid, '9d748224-3143-5124-acfc-c22700c4d111'::uuid, 'ooh', 'Mupi LED', 'Mupi LED · Guayaquil · Mall del Sur', 1, null, 930000, '/postbuy/warner/evidence/oak-street/10-mupi-led-guayaquil-mall-del-sur.webp', null, 'verified', 'Fotograma de la campaña.', 10, 3),
('931be548-6909-5bb5-ad79-afa708982a3b'::uuid, '9d748224-3143-5124-acfc-c22700c4d111'::uuid, 'ooh', 'Mupi LED', 'Mupi LED · Guayaquil · Carlos Julio Arosemena', 1, null, 750000, '/postbuy/warner/evidence/oak-street/11-mupi-led-guayaquil-carlos-julio-arosemena.webp', null, 'verified', 'Fotograma de la campaña.', 11, 4),
('21bedfd5-1923-5b5c-9c35-5f64114ecf58'::uuid, '9d748224-3143-5124-acfc-c22700c4d111'::uuid, 'ooh', 'Mupi LED', 'Mupi LED · Guayaquil · Boyacá y Ballén', 1, null, 800000, '/postbuy/warner/evidence/oak-street/12-mupi-led-guayaquil-boyaca-y-ballen.webp', null, 'verified', 'Fotograma de la campaña.', 12, 5),
('f60b8f53-72a4-54e9-bf5e-eaadf68343ed'::uuid, '9d748224-3143-5124-acfc-c22700c4d111'::uuid, 'ooh', 'Mupi LED', 'Mupi LED · Guayaquil · Av. de las Américas', 1, null, 940000, '/postbuy/warner/evidence/oak-street/13-mupi-led-guayaquil-av-de-las-americas.webp', null, 'verified', 'Fotograma de la campaña.', 13, 6),
('3057d4f7-1a3f-5bb6-949a-df6852e89b29'::uuid, '9d748224-3143-5124-acfc-c22700c4d111'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Naciones Unidas y Amazonas', 1, null, 815000, '/postbuy/warner/evidence/oak-street/14-valla-led-quito-naciones-unidas-y-amazonas.webp', null, 'verified', 'Fotografía de la campaña.', 14, 7),
('1c9f79a8-b3f3-5136-95c3-f264138b8d49'::uuid, '9d748224-3143-5124-acfc-c22700c4d111'::uuid, 'ooh', 'Valla LED', 'Valla LED · Quito · Gaspar de Villarroel y 6 de Diciembre', 1, null, 1155000, '/postbuy/warner/evidence/oak-street/15-valla-led-quito-gaspar-de-villarroel-y-6-de-diciembre.webp', null, 'verified', 'Fotograma de la campaña.', 15, 8),
('4eba2597-7c07-5f9c-8f6b-9e715c28a3b9'::uuid, '9d748224-3143-5124-acfc-c22700c4d111'::uuid, 'radio', 'FM Mundo', 'FM Mundo ·Café Mundo', null, 66, null, null, '/postbuy/warner/logos/fm-mundo.png', 'pending', 'Logo de FM Mundo.
Fuente oficial.
Validar período: audios de agosto; plan de julio.', 16, 9),
('b0bd8f4a-0fb3-5097-a78e-b1244525ab8b'::uuid, '9d748224-3143-5124-acfc-c22700c4d111'::uuid, 'radio', 'Fuego', 'Fuego · ¿Qué pasa con Mariela?', null, 50, null, null, '/postbuy/warner/logos/radio-fuego-1065.jpg', 'pending', 'Logo de Radio Fuego 106.5.
Fuente oficial.
Validar período: audios de agosto; plan de julio.', 17, 10)
on conflict (id) do update set
  campaign_id = excluded.campaign_id,
  channel = excluded.channel,
  media_name = excluded.media_name,
  placement_name = excluded.placement_name,
  element_quantity = excluded.element_quantity,
  media_rights = excluded.media_rights,
  monthly_impacts = excluded.monthly_impacts,
  evidence_image_url = excluded.evidence_image_url,
  media_logo_url = excluded.media_logo_url,
  evidence_status = excluded.evidence_status,
  source_note = excluded.source_note,
  source_row = excluded.source_row,
  display_order = excluded.display_order,
  updated_at = now();

commit;
