import test from "node:test";
import assert from "node:assert/strict";
import { handleCatalogCheckout, type CatalogCheckoutInput } from "../lib/catalog-checkout";
import { checkoutCatalog } from "../lib/catalog-checkout-client";
const origin="https://one.example",uuid="00000000-0000-4000-8000-000000000001";
const input:CatalogCheckoutInput={requestId:uuid,companyId:uuid,clientId:null,version:5,quote:"server-catalog-quote",title:"Ensayo",desiredStart:"2026-12-01",notes:""};
function post(body:unknown,headers:Record<string,string>={}){return new Request(origin+"/api/catalog/checkout",{method:"POST",headers:{origin,"content-type":"application/json",...headers},body:JSON.stringify(body)});}
test("checkout rejects cross-origin writes, tampering and oversized bodies before invoking the store",async()=>{
 const reject=async()=>{throw new Error("store must not run");};
 for (const [req,status] of [[post(input,{origin:"https://outsider.example"}),403],[post(input,{"sec-fetch-site":"cross-site"}),403],[post(input,{origin:""}),403],[post(input,{"content-type":"text/plain"}),415],[post({...input,priceCents:2}),400],[post({...input,ownerId:uuid}),400],[post({...input,desiredStart:"2026-02-31"}),400],[post({...input,notes:"x".repeat(264000)}),413]] as const)
  assert.equal((await handleCatalogCheckout(req,reject)).status,status);
});
test("after a lost receipt, resubmitting the same purchase recovers the order without issuing a second one",async()=>{
 const orders=new Map<string,string>();let loseResponse=true,calls=0;
 const fetcher:typeof fetch=async(_url,options)=>{
  const res=await handleCatalogCheckout(post(JSON.parse(String(options?.body))),async x=>{
   calls++;if(!orders.has(x.requestId))orders.set(x.requestId,crypto.randomUUID());
   return {ok:true,id:orders.get(x.requestId)!,cart:{version:6,items:[],clientId:null}};
  });
  if(loseResponse){loseResponse=false;throw new Error("network lost after commit");}return res;
 };
 await assert.rejects(checkoutCatalog(input,{fetcher}));
 const receipt=await checkoutCatalog(input,{fetcher});
 assert.equal(orders.size,1);assert.equal(calls,2);assert.equal(receipt.ok&&receipt.id,orders.get(uuid));
});
test("a stale version returns an actionable conflict; a login HTML response never announces a purchase",async()=>{
 const res=await handleCatalogCheckout(post(input),async()=>({ok:false,error:"Selección actualizada",refreshCart:true}));
 assert.equal(res.status,409);
 assert.deepEqual(await checkoutCatalog(input,{fetcher:async()=>res}),{ok:false,error:"Selección actualizada",refreshCart:true});
 await assert.rejects(checkoutCatalog(input,{fetcher:async()=>new Response("<html>Login</html>",{headers:{"content-type":"text/html"}})}));
});
