import test from "node:test";
import assert from "node:assert/strict";
import { comparableMetric, metricDifference, metricValue, documentPathAllowed, type CampaignLibrary, type LibraryMetric } from "../lib/campaign-library";
import { validCampaignLibrary } from "../lib/campaign-library-validation";
const id = (n: number) => "00000000-0000-0000-0000-" + String(n).padStart(12, "0");
const base = { value: 100, period: "June", scope: "City", basis: "Elements", estimated: false };
const metric: LibraryMetric = { id:id(4), campaignId:id(2), planDocumentId:id(3), reportDocumentId:id(5), label:"Units", unit:"number", planned:base, reported:{...base,value:110} };
function fixture(): CampaignLibrary { return {
 clients:[{id:id(1),name:"Example",category:"Media",campaignKind:"film"}],
 campaigns:[{id:id(2),clientId:id(1),name:"Example campaign",period:"June",status:"planning",poster:null,summary:""}],
 documents:[{id:id(3),campaignId:id(2),title:"Plan",kind:"plan",version:"V1",issuedOn:"2026-06-01",downloadable:false,summary:"",sections:[{title:"Budget",columns:["Item","Value"],rows:[["Media","100"]]}]},
 {id:id(5),campaignId:id(2),title:"Report",kind:"report",version:"V1",issuedOn:"2026-06-30",downloadable:false,summary:"",sections:[]}],metrics:[structuredClone(metric)] };
}
test("differences require matching period, coverage and measurement basis", () => {
 assert.equal(metricDifference(metric),10);
 for (const field of ["period","scope","basis"] as const) {
  assert.equal(comparableMetric({...metric,reported:{...base,[field]:"Other"}}),false);
  assert.equal(metricDifference({...metric,reported:{...base,[field]:"Other"}}),null);
 }
 assert.equal(metricDifference({...metric,reported:null}),null);
 assert.equal(metricValue(null,"USD"),"—");
 assert.equal(metricValue(NaN,"number"),"—");
});
test("document path is confined to the exact company, campaign and document",()=>{
 const path=id(1)+"/"+id(2)+"/"+id(3)+"/plan-v1.pdf";
 assert.equal(documentPathAllowed(path,id(1),id(2),id(3)),true);
 for(const bad of [path.replace(id(1),id(9)),path.replace("plan-v1.pdf","../secret.pdf"),path+".html",path.replace("plan-v1","a/b")])
  assert.equal(documentPathAllowed(bad,id(1),id(2),id(3)),false);
});
test("validated dataset accepts complete version references",()=>assert.equal(validCampaignLibrary(fixture()),true));
test("rejects malformed records and mismatched document relationships",()=>{
 for(const change of [
  (d:CampaignLibrary)=>{d.documents[0].sections[0].rows=[["Missing column"]];},
  (d:CampaignLibrary)=>{d.campaigns[0].clientId=id(99);},
  (d:CampaignLibrary)=>{d.metrics[0].planDocumentId=id(5);},
  (d:CampaignLibrary)=>{d.metrics[0].reportDocumentId=id(99);},
  (d:CampaignLibrary)=>{d.metrics[0].planned!.value=NaN;},
  (d:CampaignLibrary)=>{d.documents[0].issuedOn="2026-02-31";},
  (d:CampaignLibrary)=>{d.campaigns[0].poster="https://untrusted.example/image.jpg";},
  (d:CampaignLibrary)=>{d.clients.push(d.clients[0]);}
 ]) {const data=fixture();change(data);assert.equal(validCampaignLibrary(data),false);}
 assert.equal(validCampaignLibrary({clients:[]}),false);
 assert.equal(validCampaignLibrary(null),false);
});
