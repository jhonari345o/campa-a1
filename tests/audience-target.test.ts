import assert from "node:assert/strict";
import test from "node:test";
import { audienceCohort, audienceMatchesSource, changeAudienceSelection, DEFAULT_AUDIENCE, restoreAudienceSelection, supportedAudienceSelection } from "../lib/audience-target";
import { radioCompatibility, type BroadcastSource } from "../lib/broadcast-catalog";
import { tvAudienceApplies, buildStrategyEvidence } from "../lib/media-strategy-evidence";
import { pressAudienceApplies, type PressAudience } from "../lib/atl-audience";
import { restorePlanBrief } from "../lib/planning-restore";
import { strategyAiPayload } from "../lib/media-strategy";
import { strategyAiTransport } from "../lib/strategy-ai-transport";
import { strategyBrief, strategyCatalogs, strategyResearch, tvStudy, tvSource } from "./media-strategy-fixture";
import type { MediaPlan } from "../lib/planner";

test("broad defaults and exact legacy aliases share one demographic definition", () => {
  assert.deepEqual(restoreAudienceSelection({}), DEFAULT_AUDIENCE);
  for (const ageRange of ["Personas 18+", "18–99", "18–99 años", "18+"]) {
    assert.deepEqual(audienceCohort({ ...DEFAULT_AUDIENCE, ageRange }), {ageMin:18,ageMax:99,sex:"all",nse:"all"});
  }
  assert.deepEqual(restoreAudienceSelection({ageRange:"Niños 3–11",sex:"all",socioeconomic:"A/B"}), {ageRange:"3-11",sex:"Todas las personas",socioeconomic:"NSE AB"});
});

test("unsupported cuts, crossed cohorts and empty selections never become total audience", () => {
  for (const patch of [{ageRange:"18-34"},{ageRange:"Todas las edades"},{sex:"No binario"},{sex:"Mujeres prioritario"},{socioeconomic:"C+"},{socioeconomic:"Por definir"},{ageRange:""},{sex:""},{socioeconomic:""},{ageRange:"15-34",sex:"Mujeres"},{ageRange:"Personas 3+",socioeconomic:"AB"}]) {
    assert.equal(supportedAudienceSelection({...DEFAULT_AUDIENCE,...patch}), false);
    assert.equal(audienceMatchesSource({ageMin:18,ageMax:99,sex:"all",nse:"all"},{...DEFAULT_AUDIENCE,...patch}), false);
  }
  assert.equal(audienceMatchesSource({ageMin:18,ageMax:99,sex:"all",nse:"all"},{}), false);
  const historical=restorePlanBrief({ageRange:"18-34",sex:"Mujeres prioritario",socioeconomic:"C+"});
  assert.equal(historical.ageRange, "18-34");
  assert.equal(restoreAudienceSelection(historical).ageRange, "");
});

test("changing age preserves compatible cuts without manufacturing a demographic cross", () => {
  const adults={...DEFAULT_AUDIENCE,sex:"Mujeres",socioeconomic:"NSE AB"};
  assert.deepEqual(changeAudienceSelection(adults,"ageRange","3-11"), {...adults,ageRange:"3-11",sex:"Todas las personas"});
  assert.deepEqual(changeAudienceSelection(adults,"ageRange","15-34"), {...DEFAULT_AUDIENCE,ageRange:"15-34"});
  assert.equal(supportedAudienceSelection({...DEFAULT_AUDIENCE,ageRange:"12-17",socioeconomic:"NSE AB"}), true);
});

test("TV uses native sex and AB cuts, never a total-population rating for a specific cut", () => {
  const brief=strategyBrief({ageRange:"18–99 años",sex:"Mujeres",socioeconomic:"A/B"});
  const study={...tvStudy,sex:"female",nse:"AB"};
  assert.equal(tvAudienceApplies(study,brief,"2026-11-05"), true);
  for (const patch of [{sex:"all"},{nse:"all"},{ageMin:3},{marketKeys:["guayaquil"]},{periodEnd:"2026-12-01"}]) {
    assert.equal(tvAudienceApplies({...study,...patch},brief,"2026-11-05"), false);
  }
  assert.equal(tvAudienceApplies({...study,ageMin:null},brief,"2026-11-05"),false);
});

test("radio and press resolve the same adult female cut and preserve their own NSE and markets", () => {
  const brief=strategyBrief({ageRange:"18–99 años",sex:"Mujeres"});
  const radio:BroadcastSource={...tvSource,kind:"radio",ageMin:18,ageMax:99,sex:"female",nse:"all",periodEnd:"2026-08-31"};
  const press:PressAudience={id:"synthetic",provider:"Diario sintético",ageMin:18,ageMax:99,sex:"female",nse:"all",universe:100000,audience:10000,reachPct:10,exclusiveReachPct:5,rank:1,periodStart:"2026-08-01",periodEnd:"2026-08-31",marketKeys:["quito"],row:1,derived:false};
  assert.equal(radioCompatibility(radio,brief),null);
  assert.equal(pressAudienceApplies(press,brief,"2026-11-05"),true);
  for (const patch of [{sex:"Todas las personas"},{socioeconomic:"NSE AB"},{ageRange:"15-34"}]) {
    assert.notEqual(radioCompatibility(radio,{...brief,...patch}),null);
    assert.equal(pressAudienceApplies(press,{...brief,...patch},"2026-11-05"),false);
  }
});

test("saved planning keeps explicit segmentation, objective and priority instead of resetting the client", () => {
  const brief=restorePlanBrief({ageRange:"18–99",sex:"Mujeres",socioeconomic:"A/B",objective:"Ventas",priority:"Frecuencia"});
  assert.equal(brief.ageRange,"Personas 18+");
  assert.equal(brief.sex,"Mujeres"); assert.equal(brief.socioeconomic,"NSE AB");
  assert.equal(brief.objective,"Ventas"); assert.equal(brief.priority,"Frecuencia");
});

test("needs and behaviors reach AI intact while demographics remain broad and measurements stay unchanged", () => {
  const brief=strategyBrief({audience:"Personas que necesitan comprar cerca del trabajo y suelen desplazarse en transporte público."});
  const bundle=buildStrategyEvidence(brief,strategyResearch,strategyCatalogs(),"2026-11-05");
  const base={plan:[],matched:0,totalRef:0,basis:"infomedia",benchmark:[],profileLabel:"Sintético",strategySummary:""} as MediaPlan;
  const payload=strategyAiPayload(brief,bundle,base);
  assert.deepEqual(payload.audienceContext.demographics,{ageMin:18,ageMax:99,sex:"all",nse:"all"});
  assert.equal(payload.audienceContext.needsAndBehaviors,brief.audience);
  const transport=strategyAiTransport(payload);
  assert.equal(transport.ready,true);
  assert.ok(transport.content.includes(brief.audience));
  const changed=strategyAiPayload({...brief,audience:"Personas que buscan servicios para sus hogares."},bundle,base);
  assert.notEqual(changed.audienceContext.needsAndBehaviors,payload.audienceContext.needsAndBehaviors);
  assert.deepEqual(changed.evidence,payload.evidence);
  assert.deepEqual(changed.audienceContext.demographics,payload.audienceContext.demographics);
});
