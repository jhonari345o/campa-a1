import test from "node:test";
import assert from "node:assert/strict";
import { makeRadioDailySpots, radioMonthDates, radioMonthSchedule } from "../lib/radio-schedule";
import { allocateRadioFlights, type StrategyAllocation } from "../lib/media-strategy";
import { radioFlightMonths } from "../lib/planning-broadcast";
import { strategyRadioMonths } from "../lib/strategy-groups";
import type { StrategyCandidate } from "../lib/media-strategy-evidence";
import { strategyBrief } from "./media-strategy-fixture";

const brief = strategyBrief({selectedMedia:["radio"],geography:"Guayas, Pichincha",coverage:undefined,startDate:"2026-12-04",endDate:"2027-04-30",budgetUsd:21740});
const candidate = (i: number): StrategyCandidate => ({id:`radio-${i}`,stationId:`station-${i}`,medium:"radio",provider:`Radio ${i}`,product:"Rotativo",market:i%2?"Quito":"Guayaquil",stationCoverage:[i%2?"Pichincha":"Guayas"],target:"Personas 18+",period:"",sourceIds:[],sourceUse:"comparable",unit:"cuña de 20 s",unitPriceUsd:10.67+i%8,referencePriceUsd:10.67+i%8,minimumUnits:1,minimumSpendUsd:10.67+i%8,metrics:[],note:""});

test("monthly calendar conserves every spot, station and cent of the rotating plan", () => {
  const executions = allocateRadioFlights(Array.from({length:30},(_,i)=>candidate(i)),[],brief,21740);
  const allocation = {medium:"radio",executions} as StrategyAllocation;
  const overview = strategyRadioMonths(allocation);
  assert.equal(overview.length,5);
  let allUnits=0, allCents=0;
  for (const summary of overview) {
    const calendar=radioMonthSchedule(allocation,summary.month);
    assert.equal(calendar.stations,summary.stations);
    assert.equal(calendar.units,summary.units);
    assert.equal(calendar.spendUsd,summary.spend);
    assert.equal(calendar.dailyTotals.reduce((a,b)=>a+b,0),summary.units);
    for (const row of calendar.rows) {
      assert.equal(row.daily.reduce((a,b)=>a+b,0),row.units);
      assert.equal(Math.round(row.priceUsd!*row.units*100),Math.round(row.totalUsd*100));
      assert.ok(row.daily.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=6&&(!calendar.dates[i].weekend||n===0)));
      assert.ok(row.daily.every((n,i)=>calendar.dates[i].date>=brief.startDate!||n===0));
    }
    allUnits+=calendar.units;allCents+=Math.round(calendar.spendUsd*100);
  }
  assert.equal(allUnits,executions.reduce((n,r)=>n+r.units!,0));
  assert.equal(allCents,executions.reduce((n,r)=>n+Math.round(r.referenceSpendUsd!*100),0));
  assert.ok(executions.every(row=>row.radioFlights!.every(f=>f.dailySpots?.length)));
  const december=radioMonthSchedule(allocation,"2026-12").rows.map(r=>r.stationId);
  const january=radioMonthSchedule(allocation,"2027-01").rows.map(r=>r.stationId);
  assert.notDeepEqual(december,january);
});

test("daily allocation spans the flight, balances remainder and handles short/leap periods in UTC", () => {
  const flight=radioFlightMonths(brief)[0];
  const days=makeRadioDailySpots(flight,66);
  assert.equal(days.length,20);assert.equal(days[0].date,"2026-12-04");assert.equal(days.at(-1)!.date,"2026-12-31");
  assert.equal(days.reduce((n,d)=>n+d.units,0),66);
  assert.deepEqual(new Set(days.map(d=>d.units)),new Set([3,4]));
  assert.equal(radioMonthDates("2028-02").length,29);assert.equal(radioMonthDates("2027-02").length,28);
  assert.deepEqual(radioMonthDates("2026-13"),[]);
  const short=radioFlightMonths({...brief,startDate:"2026-11-09",endDate:"2026-11-13"})[0];
  assert.deepEqual(makeRadioDailySpots(short,2),[{date:"2026-11-09",units:1},{date:"2026-11-13",units:1}]);
  const weekend=radioFlightMonths({...brief,startDate:"2026-11-07",endDate:"2026-11-08"})[0];
  assert.deepEqual(makeRadioDailySpots(weekend,5),[{date:"2026-11-07",units:2},{date:"2026-11-08",units:3}]);
  assert.deepEqual(makeRadioDailySpots({...flight,endDate:"2027-01-01"},20),[]);
  assert.deepEqual(makeRadioDailySpots(flight,1.5),[]);
});

test("saved flight dates are preserved and legacy flights gain the same daily view without mutation", () => {
  const flight={month:"2026-12",startDate:"2026-12-04",endDate:"2026-12-31",activeDays:20,units:8,spendUsd:85.36};
  const execution={candidate:candidate(0),units:8,amountUsd:85.36,referenceSpendUsd:85.36,remainderUsd:0,radioFlights:[flight]};
  const allocation={medium:"radio",executions:[execution]} as StrategyAllocation;
  const before=JSON.stringify(allocation);
  const old=radioMonthSchedule(allocation,"2026-12");
  assert.equal(old.rows[0].daily.reduce((n,u)=>n+u,0),8);assert.equal(JSON.stringify(allocation),before);
  const saved={...flight,dailySpots:[{date:"2026-12-10",units:3},{date:"2026-12-17",units:5}]};
  const custom=radioMonthSchedule({...allocation,executions:[{...execution,radioFlights:[saved]}]},"2026-12");
  assert.equal(custom.rows[0].daily[9],3);assert.equal(custom.rows[0].daily[16],5);
  assert.equal(custom.rows[0].daily.reduce((n,u)=>n+u,0),8);
  assert.equal(radioMonthSchedule(allocation,"2027-01").rows.length,0);
});
