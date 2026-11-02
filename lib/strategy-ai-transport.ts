import type { strategyAiPayload } from "./media-strategy";

/** Short request-local identifiers reduce tokens without changing the source-bound contract. */
export function strategyAiTransport(payload:ReturnType<typeof strategyAiPayload>) {
  const sources=new Map(payload.evidence.sources.map((s,i)=>[s.id,`s${i+1}`]));
  const candidates=new Map(payload.evidence.candidates.map((c,i)=>[c.id,`c${i+1}`]));
  const aliases=new Map([...sources,...candidates]);
  const reverse=new Map([...aliases].map(([id,alias])=>[alias,id]));
  const content=JSON.stringify(payload,(_key,value)=>typeof value==="string"?aliases.get(value)??value:value);
  const validOptions=payload.allocationOptions.filter(option=>option.evidenceIds.length>0);
  const idList=(ids:string[],minimum:number,maximum:number)=>({type:"array",minItems:minimum,maxItems:Math.min(maximum,ids.length),items:ids.length?{type:"string",enum:ids.map(id=>aliases.get(id)??id)}:{type:"string"}});
  const schema:Record<string,unknown>={type:"object",additionalProperties:false,required:["summary","allocations","questions"],properties:{
    summary:{type:"string",minLength:1,maxLength:1400,description:"Conclusión breve en español, sin cifras ni importes."},
    allocations:{type:"array",minItems:1,maxItems:payload.allowedMedia.length,items:{anyOf:validOptions.map(option=>({type:"object",additionalProperties:false,required:["medium","weight","rationale","evidenceIds","candidateIds"],properties:{
      medium:{type:"string",enum:[option.medium]},weight:{type:"integer",minimum:0,maximum:10000,description:"Los pesos de todos los medios suman diez mil."},rationale:{type:"string",minLength:1,maxLength:700,description:"Motivo de la selección, sin cifras ni importes."},
      evidenceIds:idList(option.evidenceIds,1,6),candidateIds:idList(option.candidateIds,0,3),
    }}))}},questions:{type:"array",maxItems:0,items:{type:"string"}},
  }};
  return {content,ready:validOptions.length>0,responseSchema:{name:"media_strategy",schema},restore(raw:string):string {
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
