import "server-only";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { catalogAccess } from "./catalog-access-server";
import { createClient } from "./supabase/server";
import { parseAtlAudience, type AtlAudienceCatalog, type PressAudience, type OohObservation } from "./atl-audience";

export async function readAtlAudience(media:("press"|"ooh")[]):Promise<AtlAudienceCatalog>{
 const result:AtlAudienceCatalog={press:[],ooh:[]};if(!media.length)return result;
 try{
  const caller=await createClient();const {data:allowed,error:permissionError}=await caller.rpc("can_access_infomedia");
  if(permissionError||!allowed)return result;
  const {db}=await catalogAccess();
  const {data,error}=await db.from("planning_audience_sources").select("id,medium,object_path,sha256,record_count").eq("active",true).in("medium",media).order("id").limit(20);
  if(error)throw error;
  await Promise.all((data??[]).map(async source=>{
   if(!/^[a-z0-9-]+\.json\.gz$/.test(source.object_path)||!["press","ooh"].includes(source.medium))throw new Error("INVALID_ATL_MANIFEST");
   const {data:blob,error}=await db.storage.from("planning-audience").download(source.object_path);
   if(error||!blob||blob.size>5242880)throw new Error("ATL_DOWNLOAD_FAILED");
   const bytes=Buffer.from(await blob.arrayBuffer());
   if(createHash("sha256").update(bytes).digest("hex")!==source.sha256)throw new Error("ATL_HASH_MISMATCH");
   const rows=parseAtlAudience(JSON.parse(gunzipSync(bytes,{maxOutputLength:12*1024*1024}).toString("utf8")),source.medium);
   if(rows.length!==source.record_count)throw new Error("ATL_COUNT_MISMATCH");
   if(source.medium==="press")result.press.push(...rows as PressAudience[]);else result.ooh.push(...rows as OohObservation[]);
  }));
  return result;
 }catch{return {press:[],ooh:[],error:"No se pudieron cargar los estudios de prensa y vía pública."};}
}
