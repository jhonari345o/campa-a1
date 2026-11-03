import { MAX_STRATEGY_EXECUTIONS } from "./media-strategy";
import type { strategyAiPayload } from "./media-strategy";

/** Short request-local identifiers reduce tokens without changing the source-bound contract. */
export function strategyAiTransport(payload:ReturnType<typeof strategyAiPayload>) {
  const sources=new Map(payload.evidence.sources.map((s,i)=>[s.id,`s${i+1}`]));
  const candidates=new Map(payload.evidence.candidates.map((c,i)=>[c.id,`c${i+1}`]));
  const aliases=new Map([...sources,...candidates]);
  const reverse=new Map([...aliases].map(([id,alias])=>[alias,id]));
  // Repeated conditions and cohort descriptions are carried once, verbatim.
  // No observations, price, geography, date or qualification is truncated.
  const aliased=JSON.parse(JSON.stringify(payload,(_key,value)=>typeof value==="string"?aliases.get(value)??value:value));
  const occurrences=new Map<string,number>();
  JSON.stringify(aliased,(_key,value)=>{if(typeof value==="string"&&value.length>=64)occurrences.set(value,(occurrences.get(value)??0)+1);return value;});
  const texts=new Map([...occurrences].filter(([,count])=>count>=2).map(([value],i)=>[value,`t${i+1}`]));
  const compressed=JSON.parse(JSON.stringify(aliased,(_key,value)=>typeof value==="string"&&texts.has(value)?{$text:texts.get(value)}:value));
  const content=JSON.stringify(texts.size?{textReferences:Object.fromEntries([...texts].map(([value,id])=>[id,value])),...compressed}:aliased);
  const validOptions=payload.allocationOptions.filter(option=>option.evidenceIds.length>0);
  const idList=(ids:string[],minimum:number,maximum:number)=>({type:"array",minItems:minimum,maxItems:Math.min(maximum,ids.length),items:ids.length?{type:"string",enum:ids.map(id=>aliases.get(id)??id)}:{type:"string"}});
  const schema:Record<string,unknown>={type:"object",additionalProperties:false,required:["summary","allocations","questions"],properties:{
    summary:{type:"string",minLength:1,maxLength:480,pattern:"^[^0-9%$€<>]*$",description:"Conclusión de una o dos frases en español. Sin dígitos, porcentajes, importes, enlaces ni HTML; tampoco escribir edades o nombres con cifras."},
    allocations:{type:"array",minItems:1,maxItems:payload.allowedMedia.length,items:{anyOf:validOptions.map(option=>({type:"object",additionalProperties:false,required:["medium","weight","rationale","evidenceIds","candidateIds"],properties:{
      medium:{type:"string",enum:[option.medium]},weight:{type:"integer",minimum:0,maximum:10000,description:"Los pesos de todos los medios suman diez mil."},rationale:{type:"string",minLength:1,maxLength:240,pattern:"^[^0-9%$€<>]*$",description:"Una frase sobre la selección. Sin dígitos, porcentajes, importes, enlaces ni HTML; tampoco escribir edades o nombres con cifras."},
      evidenceIds:idList(option.evidenceIds,1,6),candidateIds:idList(option.candidateIds,0,MAX_STRATEGY_EXECUTIONS),
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
