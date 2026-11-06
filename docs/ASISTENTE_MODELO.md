# Mavi — Modelo propio (red neuronal) en tu AWS

Mavi no depende de ningun proveedor externo: el sitio habla con **tu** modelo a
traves de un endpoint estandar (protocolo "chat completions", compatible con
OpenAI). Solo configuras tres variables y listo.

```
LLM_BASE_URL   URL de tu modelo (termina en /v1)
LLM_MODEL      nombre del modelo cargado
LLM_API_KEY    opcional, si tu servidor lo exige
```

El sitio arma un resumen de la base de inversion publicitaria (Supabase) y se lo
entrega al modelo como contexto en cada pregunta, junto con las reglas de Mavi
(solo publicidad, datos honestos, tono de marca).

## Que es "la red neuronal"

Es un **modelo de lenguaje ya entrenado, de codigo abierto** (Llama, Mistral,
Qwen, etc.). No se entrena desde cero: se descarga y se sirve. Elige uno segun
tu presupuesto de hardware:

| Modelo | Tamano | Calidad | GPU recomendada |
| --- | --- | --- | --- |
| Llama 3.1 8B Instruct | 8B | Buena para chat en espanol | 1 GPU 16–24 GB |
| Mistral 7B Instruct | 7B | Buena, liviano | 1 GPU 16 GB |
| Qwen2.5 14B Instruct | 14B | Muy buena | 1 GPU 24–40 GB |

## Opcion A — Amazon Bedrock (recomendada: sin servidor)

El sitio ya trae el conector de Bedrock incorporado (Converse API). No hace falta
proxy ni servidor. Pasos:

1. **AWS Console → Bedrock → Model access** → habilita un modelo abierto
   (ej. *Llama 3.1 8B Instruct* o *Mistral 7B*). La activacion suele ser inmediata.
2. **IAM → Users → Create user** (acceso programatico) con la politica
   **AmazonBedrockFullAccess** (o una politica minima con `bedrock:InvokeModel`).
   Guarda el **Access key ID** y el **Secret access key**.
3. En **Amplify → Variables de entorno** agrega:
   - `BEDROCK_REGION` = `us-east-1`
   - `BEDROCK_MODEL_ID` = `meta.llama3-1-8b-instruct-v1:0`
   - `BEDROCK_ACCESS_KEY_ID` = tu access key
   - `BEDROCK_SECRET_ACCESS_KEY` = tu secret key
4. **Volver a implementar** (redeploy). Listo: Mavi responde.

> Si sale un error de "inference profile", antepon `us.` al modelo:
> `us.meta.llama3-1-8b-instruct-v1:0`.

## Opcion B — Modelo dedicado en una GPU (sin pago por consulta)

Control total; costo **fijo** por la GPU encendida (aprox. US$200–800+/mes).

1. Lanza una EC2 con GPU (ej. `g5.xlarge`, `g6.xlarge`) con drivers NVIDIA.
2. Sirve el modelo con **vLLM** (expone `/v1` compatible con OpenAI):
   ```bash
   pip install vllm
   vllm serve meta-llama/Llama-3.1-8B-Instruct \
     --port 8000 --api-key TU_TOKEN_SECRETO
   ```
   O con **Ollama** (mas simple, ideal para pruebas):
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ollama pull llama3.1
   ollama serve            # expone http://localhost:11434/v1
   ```
3. Config: `LLM_BASE_URL=http://TU-EC2:8000/v1` (o `:11434/v1` para Ollama),
   `LLM_MODEL=Llama-3.1-8B-Instruct` (o `llama3.1`), `LLM_API_KEY` si lo pusiste.

> Seguridad: no expongas la GPU al Internet abierto. Ponla detras de un ALB o en
> red privada, y protege el endpoint con `LLM_API_KEY` y grupos de seguridad.

## Conectar el sitio

Agrega `LLM_BASE_URL`, `LLM_MODEL` (y `LLM_API_KEY` si aplica) en:
- **Local:** `.env.local`.
- **AWS Amplify:** *Environment variables* → luego *Redeploy*.

Si faltan, el chat de Mavi muestra un aviso claro en vez de fallar.

## Siguiente paso opcional — "que use Internet"

Para que Mavi consulte datos actuales de la web, se le agrega una herramienta de
**busqueda web** (Brave Search API, Bing, o SerpAPI): el sitio busca, resume los
resultados y se los pasa al modelo como contexto extra. Es un anadido sobre esta
misma arquitectura; se documenta aparte cuando lo activemos.
