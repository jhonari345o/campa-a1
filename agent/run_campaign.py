"""
Mavi Agente — abre Ads Manager y prepara la campana (supervisado).

Uso:
    python run_campaign.py campaign.example.json

Requisitos: ver README.md. NUNCA publica solo: se detiene antes de gastar.

Nota: la API de `browser-use` cambia entre versiones. Si tu version usa nombres
distintos (Browser/BrowserSession), ajusta las importaciones segun su README.
"""
import asyncio
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

PLATFORM_URLS = {
    "meta": "https://adsmanager.facebook.com/adsmanager/manage/campaigns",
    "google": "https://ads.google.com/aw/campaigns/new",
    "tiktok": "https://ads.tiktok.com/i18n/creation/campaign",
    "whatsapp": "https://business.facebook.com/latest/whatsapp_manager",
}


def build_task(c: dict) -> str:
    platform = c.get("platform", "meta").lower()
    url = PLATFORM_URLS.get(platform, PLATFORM_URLS["meta"])
    return f"""
Eres un asistente que PREPARA (no publica) una campana publicitaria en {platform}.

1. Abre: {url}
2. Espera a que el humano inicie sesion si hace falta (no intentes adivinar
   credenciales; si ves un login, pausa y avisa).
3. Crea una nueva campana con estos datos:
   - Objetivo: {c.get('objetivo', '')}
   - Publico: {c.get('publico', '')}
   - Ubicacion geografica: {c.get('geo', '')}
   - Presupuesto diario (USD): {c.get('presupuesto_diario_usd', '')}
   - Creatividad: {c.get('creatividad', '')} (si pide subir un archivo, pausa y
     pide al humano que lo suba).
   - Texto del anuncio:
{c.get('copy', '')}

REGLA DE SEGURIDAD CRITICA:
- NO hagas clic en "Publicar", "Publish", "Confirmar", "Pagar" ni nada que
  ACTIVE la campana o gaste dinero.
- Cuando la campana este lista para revisar, DETENTE y escribe:
  "LISTO PARA REVISION HUMANA" y explica que falta confirmar.
""".strip()


async def main() -> None:
    if len(sys.argv) < 2:
        print("Uso: python run_campaign.py <campaign.json>")
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8") as f:
        campaign = json.load(f)

    from browser_use import Agent
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(
        model=os.environ.get("AGENT_MODEL", "qwen2.5"),
        base_url=os.environ.get("AGENT_BASE_URL", "http://localhost:11434/v1"),
        api_key=os.environ.get("AGENT_API_KEY", "ollama"),
        temperature=0.2,
    )

    # Navegador VISIBLE (headful) para que el humano vea y supervise.
    agent = Agent(task=build_task(campaign), llm=llm)

    print("Abriendo el navegador. Inicia sesion tu si te lo pide.\n")
    result = await agent.run(max_steps=40)
    print("\n--- Fin del agente ---")
    print(result)
    print("\nRevisa la campana en pantalla y da 'Publicar' tu mismo cuando este correcta.")


if __name__ == "__main__":
    asyncio.run(main())
