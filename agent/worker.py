"""
Mavi Agente — modo TRABAJADOR.

Consulta el sitio por trabajos pendientes, los ejecuta con el navegador
(supervisado) y reporta el estado de vuelta. Asi todo se ve dentro del sitio
(admavericks.one): el cliente aprieta "Ejecutar con Mavi" y ve el estado.

Config (.env):
    SITE_URL=https://TU-SITIO.amplifyapp.com
    AGENT_WORKER_TOKEN=el-mismo-token-que-pusiste-en-el-sitio
    AGENT_BASE_URL / AGENT_MODEL / AGENT_API_KEY  (modelo, ver .env.example)

Uso:
    python worker.py
"""
import asyncio
import os
import time

import requests
from dotenv import load_dotenv

from run_campaign import PLATFORM_URLS, build_task

load_dotenv()

SITE = os.environ.get("SITE_URL", "").rstrip("/")
TOKEN = os.environ.get("AGENT_WORKER_TOKEN", "")
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
POLL_SECONDS = 20


def claim_job():
    r = requests.post(f"{SITE}/api/agent/next", headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json().get("job")


def report(job_id: str, status: str, log: str = ""):
    requests.post(
        f"{SITE}/api/agent/update",
        headers=HEADERS,
        json={"id": job_id, "status": status, "log": log[:4000]},
        timeout=30,
    )


async def run_job(job: dict):
    spec = dict(job.get("spec") or {})
    spec.setdefault("platform", job.get("platform", "meta"))

    from browser_use import Agent
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(
        model=os.environ.get("AGENT_MODEL", "qwen2.5"),
        base_url=os.environ.get("AGENT_BASE_URL", "http://localhost:11434/v1"),
        api_key=os.environ.get("AGENT_API_KEY", "ollama"),
        temperature=0.2,
    )
    agent = Agent(task=build_task(spec), llm=llm)
    result = await agent.run(max_steps=40)
    # Nunca publica solo: queda listo para revision humana.
    report(job["id"], "listo_para_revision", f"Preparada por el agente.\n{result}")


async def main():
    if not SITE or not TOKEN:
        print("Configura SITE_URL y AGENT_WORKER_TOKEN en .env")
        return
    print(f"Trabajador Mavi activo. Consultando {SITE} cada {POLL_SECONDS}s...")
    while True:
        try:
            job = claim_job()
            if job:
                print(f"Trabajo {job['id']} ({job.get('platform')}) — ejecutando...")
                try:
                    await run_job(job)
                    print("  -> listo_para_revision")
                except Exception as e:  # noqa: BLE001
                    report(job["id"], "error", f"Error del agente: {e}")
                    print(f"  -> error: {e}")
            else:
                time.sleep(POLL_SECONDS)
        except Exception as e:  # noqa: BLE001
            print(f"Error consultando el sitio: {e}")
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    asyncio.run(main())
