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

## Opcion A — Amazon Bedrock (recomendada: sin administrar GPU)

Corre en **tu** cuenta AWS, con modelos abiertos (Llama/Mistral), sin servidor
que mantener. Pagas por uso (centavos por consulta).

1. AWS Console → **Bedrock** → *Model access* → habilita Llama o Mistral.
2. Expon un endpoint compatible con OpenAI. Dos formas:
   - **LiteLLM Proxy** (recomendado): un contenedor pequeno que traduce de
     OpenAI a Bedrock. Lo corres en ECS/Fargate o una EC2 chica (sin GPU).
     Config minima (`config.yaml`):
     ```yaml
     model_list:
       - model_name: llama-3.1-8b-instruct
         litellm_params:
           model: bedrock/meta.llama3-1-8b-instruct-v1:0
           aws_region_name: us-east-1
     ```
   - Luego: `LLM_BASE_URL=http://TU-PROXY:4000/v1`, `LLM_MODEL=llama-3.1-8b-instruct`.

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
