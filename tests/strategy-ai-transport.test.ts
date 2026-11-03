import assert from "node:assert/strict";
import test from "node:test";
import {strategyAiTransport} from "../lib/strategy-ai-transport";
import {strategyAiPayload,parseStrategyAdvice} from "../lib/media-strategy";
import {buildStrategyEvidence} from "../lib/media-strategy-evidence";
import {buildMediaPlan} from "../lib/planner";
import {strategyBrief,strategyCatalogs,strategyResearch} from "./media-strategy-fixture";

function expandTexts(value:unknown,texts:Record<string,string>):unknown {
  if(Array.isArray(value))return value.map(row=>expandTexts(row,texts));
  if(value&&typeof value==="object"){
    const row=value as Record<string,unknown>;
    if(typeof row.$text==="string")return texts[row.$text];
    if(Array.isArray(row.$columns)&&Array.isArray(row.$rows))return row.$rows.map(cells=>{
      const values=cells as unknown[],columns=row.$columns as string[];
      return {...Object.fromEntries(columns.map((column,i)=>[column,expandTexts(values[i],texts)])),...expandTexts(values[columns.length],texts) as object};
    });
    return Object.fromEntries(Object.entries(row).map(([key,item])=>[key,expandTexts(item,texts)]));
  }
  return value;
}

test("compact IDs restore to the original evidence and cannot select a forged source",async()=>{
  const brief=strategyBrief({selectedMedia:["television","radio"]});
  const bundle=buildStrategyEvidence(brief,strategyResearch,strategyCatalogs(),"2026-10-31");
  const payload=strategyAiPayload(brief,bundle,await buildMediaPlan({...brief,research:strategyResearch}));
  const before=JSON.stringify(payload),transport=strategyAiTransport(payload),compact=JSON.parse(transport.content);
  const evidence=expandTexts(compact.evidence,compact.textReferences??{}) as typeof payload.evidence;
  assert.ok(transport.content.length<before.length);
  assert.equal(JSON.stringify(payload),before);
  assert.deepEqual(evidence.competition,payload.evidence.competition);
  assert.deepEqual(evidence.channelShares,payload.evidence.channelShares);
  for(let i=0;i<payload.evidence.candidates.length;i++){
    assert.equal(evidence.candidates[i].unitPriceUsd,payload.evidence.candidates[i].unitPriceUsd);
    assert.equal(evidence.candidates[i].market,payload.evidence.candidates[i].market);
  }
  const option=compact.allocationOptions[0];
  const advice={summary:"Se prioriza una alternativa adecuada al público.",allocations:[{medium:option.medium,weight:10000,rationale:"Combina la cobertura y el costo de la pauta.",evidenceIds:option.evidenceIds.slice(0,2),candidateIds:option.candidateIds.slice(0,1)}],questions:[]};
  const restored=transport.restore(JSON.stringify(advice));
  assert.ok(parseStrategyAdvice(restored,brief,bundle));
  const extra=JSON.parse(restored);extra.allocations[0].productionWeight=0;
  assert.ok(parseStrategyAdvice(JSON.stringify(extra),brief,bundle),"an irrelevant editorial field cannot invalidate a television selection");
  assert.equal(parseStrategyAdvice(JSON.stringify(extra),brief,bundle)?.allocations[0].productionWeight,undefined);
  advice.allocations[0].evidenceIds=["s99999"];
  assert.equal(parseStrategyAdvice(transport.restore(JSON.stringify(advice)),brief,bundle),null);
  assert.equal(transport.restore('{"truncated"'),'{"truncated"');
});

test("table transport preserves optional fields, zero prices, nulls and separate audience scopes",async()=>{
  const brief=strategyBrief({selectedMedia:["television"]});
  const bundle=buildStrategyEvidence(brief,strategyResearch,strategyCatalogs(),"2026-10-31");
  bundle.candidates=Array.from({length:30},(_,i)=>({...bundle.candidates[0],id:`synthetic-${i}`,unitPriceUsd:i===0?0:i===1?null:100+i,market:i%2?"Guayaquil":"Quito",...(i%2?{maximumUnits:5}:{cohort:"Una cohorte distinta"})}));
  const payload=strategyAiPayload(brief,bundle,await buildMediaPlan({...brief,research:strategyResearch}));
  const transport=strategyAiTransport(payload),compact=JSON.parse(transport.content);
  assert.ok(transport.content.includes('"$columns"'));
  const expanded=expandTexts(compact,compact.textReferences??{}) as typeof payload;
  for(let i=0;i<payload.evidence.candidates.length;i++){
    const {id:_a,sourceIds:_as,...actual}=expanded.evidence.candidates[i];
    const {id:_b,sourceIds:_bs,...expected}=payload.evidence.candidates[i];
    void _a;void _as;void _b;void _bs;
    const sourceAliases=new Map(payload.evidence.sources.map((source,index)=>[source.id,`s${index+1}`]));
    assert.deepEqual(actual,JSON.parse(JSON.stringify(expected,(_key,value)=>typeof value==="string"?sourceAliases.get(value)??value:value)));
  }
});

test("large repeated commercial conditions are compressed losslessly, including scope and dates",async()=>{
  const brief=strategyBrief({selectedMedia:["television"]});
  const bundle=buildStrategyEvidence(brief,strategyResearch,strategyCatalogs(),"2026-10-31");
  const note="Condición sintética: válida solamente para esta plaza y este período; no representa cobertura en otros territorios. ".repeat(8);
  bundle.candidates=Array.from({length:30},(_,i)=>({...bundle.candidates[0],id:`synthetic-${i}`,note,unitPriceUsd:100+i}));
  const payload=strategyAiPayload(brief,bundle,await buildMediaPlan({...brief,research:strategyResearch}));
  const transport=strategyAiTransport(payload),compact=JSON.parse(transport.content);
  assert.ok(transport.content.length<JSON.stringify(payload).length*.6);
  const expanded=expandTexts(compact.evidence,compact.textReferences) as typeof payload.evidence;
  assert.deepEqual(expanded.candidates.map(c=>[c.note,c.unitPriceUsd,c.period,c.market,c.target]),payload.evidence.candidates.map(c=>[c.note,c.unitPriceUsd,c.period,c.market,c.target]));
});

test("the provider schema and restored advice preserve the explicit editorial share",async()=>{
 const brief=strategyBrief({selectedMedia:["television","digital"]});
 const bundle=buildStrategyEvidence(brief,strategyResearch,strategyCatalogs(),"2026-11-03");
 bundle.candidates.push({...bundle.candidates[0],id:"synthetic-editorial",medium:"digital",digitalProduction:{id:"synthetic-editorial",rights:["Paquete sintético"]}});
 const transport=strategyAiTransport(strategyAiPayload(brief,bundle,await buildMediaPlan({...brief,research:strategyResearch})));
 const schema=transport.responseSchema.schema as {properties:{allocations:{items:{anyOf:{required:string[];properties:{medium:{enum:string[]};productionWeight?:unknown}}[]}}}};
 const variants=schema.properties.allocations.items.anyOf;
 const digital=variants.find(v=>v.properties.medium.enum[0]==="digital")!;
 assert.ok(digital.required.includes("productionWeight"));
 assert.ok(digital.properties.productionWeight);
 assert.ok(variants.filter(v=>v!==digital).every(v=>!v.properties.productionWeight));
 const compact=JSON.parse(transport.content),expanded=expandTexts(compact,compact.textReferences??{}) as {allocationOptions:{medium:string;evidenceIds:string[];candidateIds:string[]}[]};
 const option=expanded.allocationOptions.find(o=>o.medium==="digital")!;
 const raw={summary:"Combina pauta y contenido editorial.",allocations:[{medium:"digital",weight:10000,productionWeight:2500,rationale:"La pauta responde al objetivo de la campaña.",evidenceIds:option.evidenceIds.slice(0,1),candidateIds:option.candidateIds}],questions:[]};
 assert.equal(parseStrategyAdvice(transport.restore(JSON.stringify(raw)),brief,bundle)?.allocations[0].productionWeight,2500);
});
