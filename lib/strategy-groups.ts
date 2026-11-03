import type { StrategyAllocation, StrategyExecution } from "./media-strategy";
import { televisionProviderKey } from "./television-directory";
import { televisionStartMinute } from "./broadcast-time";

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
