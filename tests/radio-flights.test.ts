import test from "node:test";
import assert from "node:assert/strict";
import { allocateRadioFlights } from "../lib/media-strategy";
import { radioFlightMonths } from "../lib/planning-broadcast";
import { strategyRadioMonths, strategyRentalBreakdown } from "../lib/strategy-groups";
import type { StrategyCandidate } from "../lib/media-strategy-evidence";
import { strategyBrief } from "./media-strategy-fixture";

const candidate=(i:number,price=15):StrategyCandidate=>({id:`radio-${i}`,stationId:`station-${i}`,medium:"radio",provider:`Radio ${i}`,product:"Rotativo",market:i%2?"Quito":"Guayaquil",stationCoverage:[i%2?"Pichincha":"Guayas"],target:"Personas 18+",period:"",sourceIds:[],sourceUse:"comparable",unit:"cuña de 20 s",unitPriceUsd:price,referencePriceUsd:price,minimumUnits:1,minimumSpendUsd:price,metrics:[],note:""});
const brief=strategyBrief({selectedMedia:["radio"],geography:"Guayas, Pichincha",coverage:undefined,startDate:"2026-12-04",endDate:"2027-04-30",budgetUsd:21739.13});

test("five months rotate five or six affordable stations per month without repeating the campaign budget",()=>{
  const rows=allocateRadioFlights(Array.from({length:30},(_,i)=>candidate(i)),[],brief,21739.13);
  const flights=radioFlightMonths(brief);
  assert.equal(flights.length,5);
  const sets:string[][]=[];
  for(const flight of flights){
    const monthly=rows.flatMap(row=>(row.radioFlights??[]).filter(f=>f.month===flight.month).map(f=>({row,flight:f})));
    assert.ok(monthly.length>=5&&monthly.length<=6,`${flight.month}: ${monthly.length}`);
    assert.deepEqual(new Set(monthly.flatMap(m=>m.row.candidate.stationCoverage!)),new Set(["Guayas","Pichincha"]));
    assert.ok(monthly.every(({flight:f})=>f.activeDays===20&&f.units>=40&&f.units<=120&&f.spendUsd===f.units*15));
    assert.ok(monthly.reduce((sum,m)=>sum+Math.round(m.flight.spendUsd*100),0)<=434784);
    sets.push(monthly.map(m=>m.row.candidate.stationId!).sort());
  }
  assert.notDeepEqual(sets[0],sets[1]);
  assert.ok(rows.length>6&&rows.length<=25);
  assert.ok(rows.reduce((sum,r)=>sum+Math.round(r.referenceSpendUsd!*100),0)<=2173913);
  for(const row of rows){
    assert.equal(row.units,row.radioFlights!.reduce((n,f)=>n+f.units,0));
    assert.equal(Math.round(row.referenceSpendUsd!*100),row.radioFlights!.reduce((n,f)=>n+Math.round(f.spendUsd*100),0));
  }
  const months=strategyRadioMonths({medium:"radio",executions:rows} as Parameters<typeof strategyRadioMonths>[0]);
  assert.equal(months.length,5);assert.ok(months.every(m=>m.stations>=5));
});

test("small budgets lower station count and cadence but preserve feasible requested provinces",()=>{
  const oneMonth={...brief,startDate:"2026-11-01",endDate:"2026-11-30"};
  const rows=allocateRadioFlights(Array.from({length:12},(_,i)=>candidate(i,17)),[],oneMonth,1000);
  assert.equal(rows.length,2);
  assert.deepEqual(new Set(rows.flatMap(r=>r.candidate.stationCoverage!)),new Set(["Guayas","Pichincha"]));
  assert.ok(rows.reduce((n,r)=>n+r.referenceSpendUsd!,0)<=1000);
  assert.equal(allocateRadioFlights([candidate(0)],[],oneMonth,10).length,0);
  assert.equal(radioFlightMonths({...oneMonth,startDate:"2026-11-09",endDate:"2026-11-13"})[0].activeDays,5);
  assert.equal(radioFlightMonths({...oneMonth,endDate:"2026-10-31"}).length,0);
});

test("OOH breaks down monthly tariff and months without changing totals in existing saved plans",()=>{
  const c={...candidate(0),medium:"ooh" as const,unit:"contratación de 5 meses",unitPriceUsd:7500};
  assert.deepEqual(strategyRentalBreakdown({candidate:c,units:1,referenceSpendUsd:7500,amountUsd:7500,remainderUsd:0}),{monthlyPriceUsd:1500,months:5,quantity:1,totalUsd:7500});
  assert.deepEqual(strategyRentalBreakdown({candidate:{...c,unitPriceUsd:750,rental:{monthlyPriceUsd:150,months:5}},units:2,referenceSpendUsd:1500,amountUsd:1500,remainderUsd:0}),{monthlyPriceUsd:150,months:5,quantity:2,totalUsd:1500});
  assert.equal(strategyRentalBreakdown({candidate:{...c,unit:"salida"},units:1,referenceSpendUsd:7500,amountUsd:7500,remainderUsd:0}),null);
  assert.equal(strategyRentalBreakdown({candidate:c,units:2,referenceSpendUsd:7500,amountUsd:7500,remainderUsd:0}),null);
});
