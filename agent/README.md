# Mavi Agente — automatizacion de pauta (supervisada)

Agente de navegador que **abre Ads Manager y prepara la campana** que genera el
planificador. Es de **codigo abierto y bajo costo**: usa `browser-use` + Playwright
y un modelo que tu eliges (por defecto, **Ollama local = US$0 de API**).

> ⚠️ **Corre supervisado.** Con modelos baratos el agente falla en flujos
> complejos. Por seguridad, NUNCA publica solo: se detiene antes de gastar para
> que un humano revise y de "Publicar".
>
> ⚠️ **Terminos de las plataformas.** Automatizar los paneles de Meta/TikTok con
> bots puede ir contra sus terminos y arriesgar la cuenta. Lo soportado y estable
> es su API oficial. Usa esto de forma asistida y bajo tu responsabilidad.
>
> ⚠️ **No corre en Amplify.** Es una app companera: corre en tu computadora o en
> una EC2 con navegador. El sitio (Amplify) solo genera la campana; este agente
> la ejecuta.

## Requisitos
- Python 3.11+
- Un modelo. Lo mas barato (gratis): **Ollama** en tu maquina.
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ollama pull qwen2.5   # o llama3.1
  ollama serve          # expone http://localhost:11434/v1
  ```

## Instalacion
```bash
cd agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env    # ajusta el modelo si quieres
```

## Uso — modo TRABAJADOR (integrado al sitio, recomendado)
Asi todo se ve dentro de admavericks.one: el cliente aprieta "Ejecutar con Mavi"
y el estado aparece en la pantalla **Campanas**. El agente corre en tu maquina/EC2
y consulta el sitio por trabajos pendientes.

1. En `.env` pon `SITE_URL` y el mismo `AGENT_WORKER_TOKEN` que configuraste en Amplify.
2. Corre el trabajador (queda escuchando):
   ```bash
   python worker.py
   ```
3. Cuando un cliente use "Ejecutar con Mavi", el agente lo toma, prepara la campana
   y marca el trabajo como **listo_para_revision** (nunca publica solo).

## Uso — modo manual (una campana suelta, para probar)
1. Arma un JSON como `campaign.example.json`.
2. Corre:
   ```bash
   python run_campaign.py campaign.example.json
   ```
3. Se abre el navegador. **Inicia sesion tu** en la plataforma (no guardamos
   credenciales). El agente llena la campana paso a paso.
4. Cuando llega al final, **se detiene**: revisa presupuesto, geo y creatividades,
   y **tu** das "Publicar".

## Modelo (menor costo)
En `.env`:
- `AGENT_BASE_URL=http://localhost:11434/v1` y `AGENT_MODEL=qwen2.5` → Ollama, gratis.
- O apunta a cualquier endpoint compatible con OpenAI (vLLM, o un modelo barato).

## Siguiente nivel
Para produccion confiable con dinero de clientes, migrar el motor a las **APIs
oficiales** (Meta/Google/TikTok Marketing API). Este agente queda como respaldo
asistido.
