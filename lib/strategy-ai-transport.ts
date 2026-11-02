import type { strategyAiPayload } from "./media-strategy";

/** Short request-local identifiers reduce tokens without changing the source-bound contract. */
export function strategyAiTransport(payload:ReturnType<typeof strategyAiPayload>) {
  const sources=new Map(payload.evidence.sources.map((s,i)=>[s.id,`s${i+1}`]));
  const candidates=new Map(payload.evidence.candidates.map((c,i)=>[c.id,`c${i+1}`]));
  const aliases=new Map([...sources,...candidates]);
  const reverse=new Map([...aliases].map(([id,alias])=>[alias,id]));
  const content=JSON.stringify(payload,(_key,value)=>typeof value==="string"?aliases.get(value)??value:value);
  return {content,restore(raw:string):string {
    let value:unknown;try{value=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,"").trim());}catch{return raw;}
    if(!value||typeof value!=="object"||Array.isArray(value))return raw;
    const result=value as Record<string,unknown>;
    if(Array.isArray(result.allocations))result.allocations=result.allocations.map(row=>{
      if(!row||typeof row!=="object"||Array.isArray(row))return row;
      const allocation={...row} as Record<string,unknown>;
      for(const field of ["candidateIds","evidenceIds"])if(Array.isArray(allocation[field]))allocation[field]=(allocation[field] as unknown[]).map(id=>typeof id==="string"?reverse.get(id)??id:id);
      return allocation;
    });
    return JSON.stringify(result);
  }};
}
