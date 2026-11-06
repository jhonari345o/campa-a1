"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { reviewCreativeAsset, type CreativePlacement } from "@/lib/creative-lab";
import { parseMp4Metadata } from "@/lib/local-media";

type Asset = { file: File; url: string; mimeType: string; kind: "image" | "video"; previewAvailable: boolean; width: number; height: number; durationSeconds: number | null };

const PLACEMENTS: Array<[CreativePlacement, string]> = [
  ["meta_reels", "Instagram/Facebook Reels"],
  ["meta_feed", "Meta Feed"],
  ["youtube_shorts", "YouTube Shorts"],
  ["ooh", "Vía pública"],
];

export function CreativeLab() {
  const [placement, setPlacement] = useState<CreativePlacement>("meta_reels");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [rights, setRights] = useState(false);
  const [sound, setSound] = useState(true);
  const [captions, setCaptions] = useState(false);
  const [cta, setCta] = useState("");
  const [copy, setCopy] = useState("");
  const [localAnalysisConsent, setLocalAnalysisConsent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [aiReply, setAiReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => () => { if (asset?.url) URL.revokeObjectURL(asset.url); }, [asset]);
  const review = useMemo(() => asset ? reviewCreativeAsset({ placement, mimeType: asset.mimeType, sizeBytes: asset.file.size, width: asset.width, height: asset.height, durationSeconds: asset.durationSeconds, hasRights: rights, hasSound: sound, hasCaptions: captions, cta }) : null, [asset, captions, cta, placement, rights, sound]);

  async function chooseFile(file?: File) {
    if (!file) return;
    if (!localAnalysisConsent) { setError("Autoriza el análisis local antes de seleccionar el archivo."); return; }
    const isMp4 = file.type === "video/mp4" || /\.mp4$/i.test(file.name);
    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") || isMp4 ? "video" : null;
    if (!kind) { setError("Selecciona una imagen JPG, PNG, WebP o un video MP4."); return; }
    if (file.size > 250 * 1024 * 1024) { setError("Para revisión local, usa un archivo menor a 250 MB."); return; }
    setError("");
    setNotice("");
    if (asset?.url) URL.revokeObjectURL(asset.url);
    const url = URL.createObjectURL(file);
    try {
      const metadata = kind === "video" ? await videoMetadata(url) : await imageMetadata(url);
      setAsset({ file, url, mimeType: isMp4 ? "video/mp4" : file.type, kind, previewAvailable: true, ...metadata });
      setNotice("Archivo analizado localmente. No se envió a ningún servidor.");
    } catch {
      if (isMp4) {
        try {
          const metadata = parseMp4Metadata(await file.arrayBuffer());
          URL.revokeObjectURL(url);
          setAsset({ file, url: "", mimeType: "video/mp4", kind: "video", previewAvailable: false, ...metadata });
          setNotice("El navegador no reproduce el códec, pero el MP4 fue analizado localmente y sus metadatos están disponibles.");
          return;
        } catch {
          // Continua al error legible de abajo.
        }
      }
      URL.revokeObjectURL(url);
      setError("No pude leer la estructura del archivo. Comprueba que no esté incompleto o dañado y usa MP4, JPG, PNG o WebP.");
    }
  }

  function changeLocalAnalysisConsent(value: boolean) {
    setLocalAnalysisConsent(value);
    if (!value) {
      if (asset?.url) URL.revokeObjectURL(asset.url);
      setAsset(null);
      setError("");
      setNotice("");
    }
  }

  async function askMavi() {
    if (!review || !consent) { setError("Confirma el aviso para pedir una adaptación a Mavi."); return; }
    setLoading(true); setError(""); setAiReply("");
    const summary = review.checks.map((item) => `${item.label}: ${item.status} — ${item.detail}`).join("\n");
    try {
      const response = await fetch("/api/asistente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: true, messages: [{ role: "user", content: `Actúa como directora creativa. Propón una adaptación concreta para ${placementLabel(placement)}. CTA: ${cta || "por definir"}. Copy actual: ${copy || "no declarado"}. Diagnóstico local:\n${summary}\nEntrega: gancho, secuencia visual, copy final, CTA y checklist de producción. No inventes resultados.` }] }) });
      const data = await response.json() as { reply?: string; error?: string };
      if (!response.ok) setError(data.error ?? "Mavi no pudo preparar la adaptación.");
      else setAiReply(data.reply ?? "No se recibió una propuesta.");
    } catch { setError("No fue posible conectar con Mavi."); } finally { setLoading(false); }
  }

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-panel border border-border bg-white shadow-panel"><header className="bg-forest p-7 text-white"><p className="text-xs font-black uppercase tracking-[.2em] text-signal">Laboratorio creativo</p><h1 className="mt-2 text-3xl font-black">Revisa la pieza antes de pagar por mostrarla.</h1><p className="mt-2 max-w-3xl text-sm text-white/60">Con tu autorización, el navegador analiza localmente formato, tamaño, resolución y duración. El archivo no se sube a AWS, Supabase, OpenRouter ni Mavi; Mavi recibe únicamente el diagnóstico y el texto que autorices por separado.</p></header><div className="grid gap-6 p-6 lg:grid-cols-[.9fr_1.1fr]"><div className="space-y-4"><label className="block text-xs font-black uppercase text-forest">Ubicación publicitaria<select value={placement} onChange={(event) => setPlacement(event.target.value as CreativePlacement)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-fog px-3 text-sm font-normal normal-case">{PLACEMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="flex items-start gap-3 rounded-xl border border-signal/30 bg-signal/5 p-4 text-xs text-forest"><input type="checkbox" checked={localAnalysisConsent} onChange={(event) => changeLocalAnalysisConsent(event.target.checked)} className="mt-1 accent-[#00a100]" /><span><strong className="block">Autorizo el análisis local del archivo</strong>Mi navegador podrá leer temporalmente el archivo para obtener formato, tamaño, resolución y duración. El archivo original no se enviará ni se almacenará en los servidores de Ad Mavericks o del proveedor de IA. <a href="/privacidad" target="_blank" className="font-black underline">Ver Política de Privacidad</a>.</span></label><label className={`grid min-h-36 place-items-center rounded-2xl border-2 border-dashed p-6 text-center ${localAnalysisConsent ? "cursor-pointer border-signal/40 bg-signal/5" : "cursor-not-allowed border-border bg-fog opacity-70"}`}><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" disabled={!localAnalysisConsent} className="sr-only" onChange={(event) => void chooseFile(event.target.files?.[0])} /><span><strong className="block text-forest">Seleccionar imagen o video</strong><small className="mt-1 block text-muted">{localAnalysisConsent ? "JPG, PNG, WebP o MP4 H.264 compatible con tu navegador" : "Primero confirma el análisis local"}</small></span></label><div className="grid gap-3 sm:grid-cols-2"><Toggle checked={rights} onChange={setRights} label="Derechos comerciales confirmados" /><Toggle checked={sound} onChange={setSound} label="Tiene audio o voz" /><Toggle checked={captions} onChange={setCaptions} label="Tiene subtítulos" /><label className="text-xs font-black text-forest">CTA principal<input value={cta} onChange={(event) => setCta(event.target.value)} maxLength={80} placeholder="Ej. Comprar ahora" className="mt-1 h-11 w-full rounded-xl border border-border bg-fog px-3 text-sm font-normal" /></label></div><label className="block text-xs font-black text-forest">Copy o mensaje principal<textarea value={copy} onChange={(event) => setCopy(event.target.value)} maxLength={1200} rows={4} className="mt-1 w-full rounded-xl border border-border bg-fog p-3 text-sm font-normal" placeholder="Pega aquí el texto de la pieza." /></label></div><div>{asset ? <CreativePreview asset={asset} placement={placement} /> : <div className="grid min-h-80 place-items-center rounded-2xl bg-fog p-8 text-center"><div><span className="text-5xl">✦</span><strong className="mt-3 block text-lg text-forest">Tu pieza aparecerá aquí</strong><p className="mt-1 text-sm text-muted">Mostraremos formato, resolución, duración y una zona segura orientativa.</p></div></div>}</div></div></section>

    {notice && <p className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm font-bold text-forest">{notice}</p>}
    {review && <section className="rounded-panel border border-border bg-white p-6 shadow-panel"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide text-signal-dark">Diagnóstico</p><h2 className="mt-1 text-2xl font-black">Preflight creativo</h2></div><div className={`rounded-2xl px-5 py-3 text-center ${review.status === "blocked" ? "bg-coral/15 text-[#a13b31]" : review.status === "warning" ? "bg-amber/15 text-[#805900]" : "bg-signal/15 text-forest"}`}><strong className="block text-2xl">{review.score}/100</strong><small className="font-black uppercase">{review.status === "blocked" ? "Bloqueado" : review.status === "warning" ? "Revisar" : "Listo"}</small></div></div><div className="mt-5 grid gap-3 md:grid-cols-2">{review.checks.map((check) => <article key={check.label} className="rounded-xl border border-border bg-fog p-4"><div className="flex gap-3"><span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${check.status === "pass" ? "bg-signal/20 text-forest" : check.status === "fail" ? "bg-coral/20 text-[#a13b31]" : "bg-amber/20 text-[#805900]"}`}>{check.status === "pass" ? "✓" : check.status === "fail" ? "×" : "!"}</span><div><strong className="text-sm text-forest">{check.label}</strong><p className="mt-1 text-xs text-muted">{check.detail}</p></div></div></article>)}</div><div className="mt-5 rounded-xl border border-sky/20 bg-sky/5 p-4"><label className="flex items-start gap-2 text-xs text-muted"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" /><span>Autorizo enviar a Mavi el diagnóstico técnico, el CTA y el copy escritos. El archivo visual no será enviado.</span></label><button type="button" disabled={loading || !consent} onClick={() => void askMavi()} className="btn btn-primary mt-3 disabled:opacity-50">{loading ? "Mavi está adaptando…" : "Crear variante con Mavi →"}</button></div>{aiReply && <article className="mt-5 rounded-2xl bg-forest p-5 text-white"><p className="text-xs font-black uppercase tracking-wide text-signal">Dirección creativa de Mavi</p><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{aiReply}</p></article>}<p className="mt-4 text-[10px] text-muted">Referencias de formato: <a href="https://www.facebook.com/business/ads/facebook-instagram-reels-ads" target="_blank" rel="noopener noreferrer" className="font-bold underline">Meta Reels</a> · <a href="https://support.google.com/google-ads/answer/16041697" target="_blank" rel="noopener noreferrer" className="font-bold underline">YouTube Shorts</a>. La plataforma publicitaria realiza la validación final.</p></section>}
    {error && <p className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">{error}</p>}
  </div>;
}

function CreativePreview({ asset, placement }: { asset: Asset; placement: CreativePlacement }) { const vertical = placement === "meta_reels" || placement === "youtube_shorts"; return <div><div className={`relative mx-auto overflow-hidden rounded-2xl bg-black ${vertical ? "aspect-[9/16] max-h-[560px]" : placement === "meta_feed" ? "aspect-[4/5] max-h-[520px]" : "aspect-[16/7]"}`}>{asset.previewAvailable ? asset.kind === "video" ? <video src={asset.url} controls muted className="size-full object-contain" /> : <Image src={asset.url} alt="Vista previa del creativo" width={asset.width} height={asset.height} unoptimized className="size-full object-contain" /> : <div className="grid size-full place-items-center p-8 text-center text-white"><div><span className="text-4xl">◉</span><strong className="mt-3 block">Metadatos analizados</strong><p className="mt-1 text-xs text-white/60">Tu navegador no reproduce este códec, por eso no puede mostrar la vista previa.</p></div></div>}<div className="pointer-events-none absolute inset-[8%] rounded-xl border-2 border-dashed border-signal/80"><span className="absolute left-2 top-2 rounded bg-black/65 px-2 py-1 text-[9px] font-black text-signal">ZONA SEGURA ORIENTATIVA</span></div></div><div className="mt-3 flex flex-wrap justify-center gap-2 text-[10px] font-bold text-muted"><span>{asset.width} × {asset.height}px</span><span>•</span><span>{(asset.file.size / 1024 / 1024).toFixed(1)} MB</span>{asset.durationSeconds != null && <><span>•</span><span>{asset.durationSeconds.toFixed(1)} s</span></>}</div></div>; }
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) { return <label className="flex items-center gap-2 rounded-xl border border-border bg-fog p-3 text-xs font-bold text-forest"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }
function imageMetadata(url: string) { return new Promise<{ width: number; height: number; durationSeconds: null }>((resolve, reject) => { const image = new globalThis.Image(); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, durationSeconds: null }); image.onerror = reject; image.src = url; }); }
function videoMetadata(url: string) { return new Promise<{ width: number; height: number; durationSeconds: number }>((resolve, reject) => { const video = document.createElement("video"); const timer = window.setTimeout(() => reject(new Error("VIDEO_METADATA_TIMEOUT")), 8_000); video.preload = "metadata"; video.onloadedmetadata = () => { window.clearTimeout(timer); resolve({ width: video.videoWidth, height: video.videoHeight, durationSeconds: Number.isFinite(video.duration) ? video.duration : 0 }); }; video.onerror = () => { window.clearTimeout(timer); reject(new Error("VIDEO_CODEC_UNSUPPORTED")); }; video.src = url; }); }
function placementLabel(value: CreativePlacement) { return PLACEMENTS.find(([id]) => id === value)?.[1] ?? value; }
