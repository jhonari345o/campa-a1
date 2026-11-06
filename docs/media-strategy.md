# Recomendación de medios con evidencia

El brief guiado consulta la categoría seleccionada, los competidores declarados, TGI y los catálogos privados antes de construir una distribución. Una referencia contextual nunca se presenta como medición del target. La inversión estimada de una marca no es su compra neta ni una medida de efectividad.

## Flujo

1. `generarPlan` valida la sesión y el permiso para planificar.
2. La investigación se resuelve por ID de categoría y período; los competidores declarados se buscan por coincidencia exacta, incluso fuera de las primeras diez marcas.
3. `media-strategy-evidence.ts` conserva la plaza, público, período, unidad y estado de cada fuente. No admite cortes posteriores a la fecha de referencia como evidencia observada.
4. El motor construye opciones por medio. Una tarifa desconocida, sin vigencia o de otra plaza no produce cantidades comprables. TGI contextual no modifica los pesos numéricos del público.
5. La interpretación opcional utiliza exclusivamente Amazon Bedrock. La respuesta propone pesos y razones, sin sustituir cifras, precios o métricas. Se rechazan identificadores ajenos, pesos inválidos, cifras inventadas en el relato y respuestas truncadas.
6. El servidor conserva el presupuesto en centavos y recalcula cantidades desde las tarifas canónicas. Las alternativas no son pronósticos de desempeño.
7. Guardar o registrar una distribución vuelve a resolver los datos en el servidor. Los precios y análisis enviados por el navegador no son la fuente de verdad. Una distribución personalizada vuelve a calcular sus cantidades.

## Activación de AWS

La integración queda apagada por defecto mediante `MEDIA_STRATEGY_AWS_AI_ENABLED=false`. No necesita activar el asistente general ni otro proveedor.

Antes de habilitarla:

- Confirmar en la cuenta AWS el modelo disponible, región, precio, créditos aplicables y límites de consumo. El código no supone gratuidad ni cambia a un modelo pago alternativo.
- Asignar al runtime SSR de Amplify un rol de cómputo con `bedrock:InvokeModel` limitado al modelo o perfil de inferencia elegido. No colocar contraseñas, access keys ni claves secretas de larga vida en el navegador, Git o variables públicas.
- Definir `BEDROCK_REGION` y `BEDROCK_MODEL_ID`. La lista de variables de `amplify.yml` entrega estos valores y el interruptor al servidor.
- Aplicar `0027_media_strategy.sql` y comprobar sus políticas con una sesión autorizada y otra sin permisos.
- Probar un brief con el modelo real, comprobar la respuesta estructurada, latencia y consumo, y después habilitar el interruptor para el entorno acordado.

Documentación oficial: [Converse](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html), [perfiles de inferencia](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-use.html), [rol de cómputo SSR de Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/amplify-SSR-compute-role.html).

## Controles de uso y privacidad

- El caché está limitado a su propietario y a la huella del brief, fuentes, versión del motor y modelo. Vence en veinticuatro horas.
- La reserva de solicitudes es atómica; peticiones concurrentes de la misma combinación no disparan inferencias duplicadas.
- Se conserva el techo existente de tres consultas nuevas por usuario y día, cincuenta en la cuenta y un intervalo mínimo de treinta segundos. Revisar estos valores solo después de comprobar créditos y costos.
- Cada inferencia admite como máximo noventa y seis mil bytes de contexto y dos mil cuatrocientos tokens de salida, sin reintentos automáticos ni otro proveedor.
- Un error, una respuesta inválida o un fallo al persistir el resultado deja disponible el cálculo con datos y muestra el estado real de la IA.
- El repositorio contiene contratos y pruebas sintéticas. Las observaciones comerciales, sus documentos originales y sus precios se cargan en Supabase por separado.

## Ratings y límites de interpretación

`tv_audience_observations` admite estudios documentados con fechas, plaza, target, filtros demográficos y vínculos explícitos a los programas del catálogo. Los campos desconocidos permanecen nulos o desconocidos.

Los estrenos se registran con `basis=premiere` y se muestran como contexto. No sustituyen promedios de período. El motor solo utiliza automáticamente ratings homologados con `basis=period_average`, la misma plaza y público y un corte anterior a la campaña; la ventana operativa máxima es de un año.

Los rankings de radio conservan cohortes independientes por estudio, público, banda y franja. No se mezclan para crear un ranking consolidado. La comparación por costo y rating solo se realiza dentro de una cohorte y una unidad comparables.

El sistema no dispone por defecto de curvas de respuesta, duplicación entre medios, inventario en tiempo real o forecasts de todas las plataformas. Sin esas fuentes no calcula alcance único, ventas, ROI ni un óptimo universal. Las brechas se presentan junto a la propuesta para que el equipo pueda completar una pauta comprable.
