import test from "node:test";
import assert from "node:assert/strict";
import { radioReachContributions } from "../lib/radio-reach";
import { reachAtGrps, type ReachCurve } from "../lib/media-delivery";
const curve:ReachCurve={medium:"radio",points:[{grps:25,reachPct:10},{grps:100,reachPct:20},{grps:300,reachPct:28},{grps:800,reachPct:32}]};

test("station contributions conserve the existing total instead of giving each station the complete curve",()=>{
  const rows=[{key:"a",grps:1000},{key:"b",grps:600},{key:"c",grps:370}];
  const result=radioReachContributions(curve,rows,32)!;
  assert.equal(result.length,3);
  assert.ok(result.every(r=>r.contributionPct>0&&r.contributionPct<20));
  assert.ok(Math.abs(result.reduce((n,r)=>n+r.contributionPct,0)-32)<1e-9);
  assert.deepEqual(result,radioReachContributions(curve,[...rows].reverse(),32));
  assert.equal(reachAtGrps(curve,1970),32);
  const clipped=radioReachContributions(curve,rows,16)!;
  assert.ok(clipped.every((r,i)=>Math.abs(r.contributionPct-result[i].contributionPct/2)<1e-9));
});

test("larger rotated schedules preserve symmetry and the radio total with deterministic attribution",()=>{
  const rows=Array.from({length:25},(_,i)=>({key:`station-${i}`,grps:120}));
  const result=radioReachContributions(curve,rows,32)!;
  assert.ok(result.every(r=>Math.abs(r.contributionPct-32/25)<1e-9));
  assert.ok(Math.abs(result.reduce((n,r)=>n+r.contributionPct,0)-32)<1e-9);
  assert.deepEqual(result,radioReachContributions(curve,[...rows].reverse(),32));
});

test("aggregate radio curves do not establish station cume or support invalid inputs",()=>{
  assert.equal(radioReachContributions(curve,[{key:"only",grps:100}],20),null);
  assert.equal(radioReachContributions(curve,[{key:"a",grps:1},{key:"b",grps:1}],32),null);
  assert.equal(radioReachContributions(curve,[{key:"a",grps:NaN},{key:"b",grps:100}],20),null);
  assert.equal(radioReachContributions({...curve,medium:"television"},[{key:"a",grps:100},{key:"b",grps:100}],20),null);
});
