import type { StrategyAllocation, StrategyExecution } from "./media-strategy";
import { televisionProviderKey } from "./television-directory";
import { televisionStartMinute } from "./broadcast-time";

/** Historical saved plans already encode the charged months in their unit.
 * Keep the original price/quantity; this only exposes the existing arithmetic. */
export function strategyRentalBreakdown(row:StrategyExecution) {
  if(row.candidate.medium!=="ooh"||row.units==null||row.units<1)return null;
  const months=row.candidate.rental?.months??Number(row.candidate.unit.match(/contrataci[oó]n de (\d+) mes(?:es)?/i)?.[1]);
  const price=row.candidate.unitPriceUsd;
  if(!Number.isSafeInteger(months)||months<1||price==null||!Number.isFinite(price)||price<=0)return null;
  const monthlyPriceUsd=row.candidate.rental?.monthlyPriceUsd??price/months;
  const totalUsd=row.referenceSpendUsd??price*row.units;
  if(!Number.isFinite(monthlyPriceUsd)||Math.abs(monthlyPriceUsd*months*row.units-totalUsd)>.011)return null;
  return {monthlyPriceUsd,months,quantity:row.units,totalUsd};
}

export function strategyRadioMonths(allocation:StrategyAllocation){
  const months=new Map<string,{month:string;stations:Set<string>;units:number;spend:number}>();
  for(const row of allocation.executions??[])for(const flight of row.radioFlights??[]){
    const month=months.get(flight.month)??{month:flight.month,stations:new Set<string>(),units:0,spend:0};
    month.stations.add(row.candidate.stationId??row.candidate.provider);month.units+=flight.units;month.spend+=Math.round(flight.spendUsd*100);months.set(flight.month,month);
  }
  return [...months.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(m=>({...m,stations:m.stations.size,spend:m.spend/100}));
}

export function strategyProviderGroups(allocation: StrategyAllocation) {
  const executions = allocation.executions?.length ? allocation.executions : allocation.candidate ? [{candidate:allocation.candidate,amountUsd:allocation.amountUsd,units:allocation.units,referenceSpendUsd:allocation.referenceSpendUsd,remainderUsd:allocation.remainderUsd}] : [];
  const groups = new Map<string,{key:string;provider:string;rows:StrategyExecution[];spots:number;spend:number}>();
  for (const row of executions) {
    const provider=row.candidate.provider, key=`${allocation.medium}:${allocation.medium==="television"?televisionProviderKey(provider):provider}`;
    const group=groups.get(key)??{key,provider,rows:[],spots:0,spend:0};
    group.rows.push(row); group.spots+=row.units??0; group.spend+=Math.round((row.referenceSpendUsd??row.amountUsd??0)*100);
    groups.set(key,group);
  }
  return [...groups.values()].map(group=>({...group,spend:group.spend/100,rows:group.rows.sort((a,b)=>televisionStartMinute(a.candidate.note)-televisionStartMinute(b.candidate.note)||a.candidate.product.localeCompare(b.candidate.product,"es"))}));
}
