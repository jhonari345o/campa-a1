/** Produce a reviewable, atomic SQL import. Never connects to a database.
 * Input and output must be outside this public repository. All downloads stay
 * disabled until each client-safe attachment is separately reviewed and stored.
 */
import { readFile, writeFile, realpath } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { validCampaignLibrary } from "../lib/campaign-library-validation";
async function main() {
const args = process.argv.slice(2);
const option = (key: string) => { const i=args.indexOf(key); return i<0 ? "" : args[i+1] ?? ""; };
const input=option("--input"), output=option("--output"), company=option("--company"), name=option("--company-name");
if (!input || !output || !name || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(company))
 throw new Error("Required: --input private.json --output private.sql --company UUID --company-name ExactName");
const repo=await realpath(resolve(__dirname,".."));
const outside=(path:string)=>{const r=relative(repo,path);return r.startsWith(".."+"/") || isAbsolute(r);};
const source=await realpath(resolve(input)), target=resolve(await realpath(dirname(resolve(output))),resolve(output).split("/").pop()!);
if (!outside(source) || !outside(target)) throw new Error("Private import files must stay outside the repository");
const data:unknown=JSON.parse(await readFile(source,"utf8"));
if (!validCampaignLibrary(data)) throw new Error("Invalid library: check IDs, versions, dates, measurements and relationships");
if (data.documents.some(d=>d.downloadable)) throw new Error("Import summaries first; attachment downloads require separate review");
const sql=(v:unknown):string=>v==null?"null":typeof v==="boolean"||typeof v==="number"?String(v):"'"+(typeof v==="object"?JSON.stringify(v):String(v)).replaceAll("'","''")+"'";
const statements=[
 "-- Private customer content. Do not commit or publish this file.",
 "begin;",
 "set local standard_conforming_strings=on;",
 "create temporary table _workspace_import_target on commit drop as select id from public.companies where id="+sql(company)+" and name="+sql(name)+" and status='activa';",
 "do $$ begin if (select count(*) from pg_temp._workspace_import_target)<>1 then raise exception 'Target company is missing, inactive or has a different name'; end if; end $$;",
];
function insert(table:string,records:Record<string,unknown>[]) {
 for(const row of records) {
  const keys=Object.keys(row), updates=keys.filter(k=>!["id","company_id"].includes(k));
  statements.push("insert into public."+table+"("+keys.join(",")+") values("+keys.map(k=>sql(row[k])).join(",")+") on conflict(id) do update set "+updates.map(k=>k+"=excluded."+k).join(",")+" where "+table+".company_id=excluded.company_id;");
 }
 if(records.length) statements.push("do $$ begin if (select count(*) from public."+table+" where company_id="+sql(company)+" and id in ("+records.map(r=>sql(r.id)).join(",")+"))<>"+records.length+" then raise exception 'Import ID collision in "+table+"'; end if; end $$;");
}
insert("workspace_clients",data.clients.map(c=>({id:c.id,company_id:company,name:c.name,category:c.category,campaign_kind:c.campaignKind})));
insert("workspace_campaigns",data.campaigns.map((c,i)=>({id:c.id,company_id:company,client_id:c.clientId,name:c.name,period:c.period,status:c.status,poster:c.poster,summary:c.summary,sort_order:i})));
insert("workspace_documents",data.documents.map(d=>({id:d.id,company_id:company,campaign_id:d.campaignId,title:d.title,kind:d.kind,version:d.version,issued_on:d.issuedOn,summary:d.summary,sections:d.sections,downloadable:false})));
insert("workspace_metrics",data.metrics.map((m,i)=>({id:m.id,company_id:company,campaign_id:m.campaignId,plan_document_id:m.planDocumentId,report_document_id:m.reportDocumentId,label:m.label,unit:m.unit,planned:m.planned,reported:m.reported,sort_order:i})));
statements.push("commit;");
await writeFile(target,statements.join("\n")+"\n",{encoding:"utf8",flag:"wx",mode:0o600});
console.log(JSON.stringify({prepared:true,connectedToDatabase:false,clients:data.clients.length,campaigns:data.campaigns.length,documents:data.documents.length,metrics:data.metrics.length}));
}
main().catch(error=>{console.error(error instanceof Error ? error.message : "Import preparation failed");process.exitCode=1;});
