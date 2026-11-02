import assert from "node:assert/strict";
import test from "node:test";
import {strategyAiTransport} from "../lib/strategy-ai-transport";
import {strategyAiPayload,parseStrategyAdvice} from "../lib/media-strategy";
import {buildStrategyEvidence} from "../lib/media-strategy-evidence";
import {buildMediaPlan} from "../lib/planner";
import {strategyBrief,strategyCatalogs,strategyResearch} from "./media-strategy-fixture";

test("compact IDs restore to the original evidence and cannot select a forged source",async()=>{
  const brief=strategyBrief({selectedMedia:["television","radio"]});
  const bundle=buildStrategyEvidence(brief,strategyResearch,strategyCatalogs(),"2026-10-31");
  const payload=strategyAiPayload(brief,bundle,await buildMediaPlan({...brief,research:strategyResearch}));
  const before=JSON.stringify(payload),transport=strategyAiTransport(payload),compact=JSON.parse(transport.content);
  assert.ok(transport.content.length<before.length);
  assert.equal(JSON.stringify(payload),before);
  assert.deepEqual(compact.evidence.competition,payload.evidence.competition);
  assert.deepEqual(compact.evidence.channelShares,payload.evidence.channelShares);
  for(let i=0;i<payload.evidence.candidates.length;i++){
    assert.equal(compact.evidence.candidates[i].unitPriceUsd,payload.evidence.candidates[i].unitPriceUsd);
    assert.equal(compact.evidence.candidates[i].market,payload.evidence.candidates[i].market);
  }
  const option=compact.allocationOptions[0];
  const advice={summary:"Se prioriza una alternativa adecuada al público.",allocations:[{medium:option.medium,weight:10000,rationale:"Combina la cobertura y el costo de la pauta.",evidenceIds:option.evidenceIds.slice(0,2),candidateIds:option.candidateIds.slice(0,1)}],questions:[]};
  const restored=transport.restore(JSON.stringify(advice));
  assert.ok(parseStrategyAdvice(restored,brief,bundle));
  advice.allocations[0].evidenceIds=["s99999"];
  assert.equal(parseStrategyAdvice(transport.restore(JSON.stringify(advice)),brief,bundle),null);
  assert.equal(transport.restore('{"truncated"'),'{"truncated"');
});
