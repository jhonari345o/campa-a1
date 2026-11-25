import { reachAtGrps, type ReachCurve } from "./media-delivery";

/** Allocate a campaign's modeled net reach, without inventing station cume.
 * These are contributions to the selected mix, NOT each station's unique
 * audience. Ratings establish gross contacts only. In particular, dividing
 * station GRPs by this attribution would not establish station frequency.
 * Exact average marginal contributions for <=8 stations; balanced, seeded
 * permutations for larger schedules. Every ordering telescopes to the same
 * campaign total and no additional audience enters the multimedia calculation.
 */
export function radioReachContributions(curve: ReachCurve, rows: { key: string; grps: number }[], totalReach: number) {
  if (curve.medium !== "radio" || !Number.isFinite(totalReach) || totalReach < 0 || totalReach > 100
    || rows.length > 100 || new Set(rows.map(r => r.key)).size !== rows.length
    || rows.some(r => !Number.isFinite(r.grps) || r.grps < 0)) return null;
  const ordered = rows.filter(r => r.grps > 0).sort((a,b) => a.key.localeCompare(b.key));
  if (ordered.length < 2) return null;
  const n = ordered.length, grps = ordered.reduce((sum,r) => sum+r.grps,0);
  const net = reachAtGrps(curve,grps);
  if (net == null || net <= 0 || totalReach > net + 1e-7) return null;
  const values = Array<number>(n).fill(0);
  if (n <= 8) {
    const factorial = [1];
    for (let i=1;i<=n;i++) factorial[i]=factorial[i-1]*i;
    for (let mask=0;mask<1<<n;mask++) {
      let subtotal=0,size=0;
      for(let i=0;i<n;i++) if(mask&(1<<i)){subtotal+=ordered[i].grps;size++;}
      const before=reachAtGrps(curve,subtotal)!;
      if(before==null)return null;
      for(let i=0;i<n;i++) if(!(mask&(1<<i))) {
        const after=reachAtGrps(curve,subtotal+ordered[i].grps);
        if(after==null)return null;
        values[i]+=(after-before)*factorial[size]*factorial[n-size-1]/factorial[n];
      }
    }
  } else {
    let seed=1126, count=0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let sample=0;sample<16;sample++) {
      const order=ordered.map((_,i)=>i);
      for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
      for(let shift=0;shift<n;shift++) {
        let subtotal=0,before=0;
        for(let j=0;j<n;j++) {
          const i=order[(j+shift)%n];subtotal+=ordered[i].grps;
          const after=reachAtGrps(curve,subtotal);if(after==null)return null;
          values[i]+=after-before;before=after;
        }
        count++;
      }
    }
    for(let i=0;i<n;i++)values[i]/=count;
  }
  const sum=values.reduce((a,b)=>a+b,0);
  return ordered.map((row,i)=>({key:row.key,contributionPct:Math.max(0,values[i])*totalReach/sum}));
}
