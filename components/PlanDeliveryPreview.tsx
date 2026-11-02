"use client";
import { useEffect, useState } from "react";
import { projectMediaDelivery, type DeliveryRequest } from "@/app/planificador/delivery-actions";
import type { DeliverySummary } from "@/lib/media-delivery";
import { MediaDeliveryChart } from "./MediaDeliveryChart";

export function PlanDeliveryPreview({ request }: { request: DeliveryRequest }) {
  const key=JSON.stringify(request);
  const [result,setResult]=useState<{key:string;summary:DeliverySummary|null}|null>(null);
  useEffect(()=>{
    let active=true;
    const timer=setTimeout(()=>{void projectMediaDelivery(JSON.parse(key) as DeliveryRequest).then(summary=>{if(active)setResult({key,summary});}).catch(()=>{if(active)setResult({key,summary:null});});},350);
    return()=>{active=false;clearTimeout(timer);};
  },[key]);
  return <MediaDeliveryChart summary={result?.key===key?result.summary:null}/>;
}
