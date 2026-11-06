import assert from "node:assert/strict";
import test from "node:test";
import { cartFingerprint, cartDraftKey, saveCartDraft, recoverCartDraft } from "../lib/catalog-cart-draft";
import { persistCatalogCart, recoverCatalogCart } from "../lib/catalog-cart-client";
import { digitalBudgetKey } from "../lib/digital-budget";

const owner="11111111-1111-4111-8111-111111111111",client="22222222-2222-4222-8222-222222222222";
const store=()=>{const map=new Map<string,string>();return {getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);},removeItem:(key:string)=>{map.delete(key);}};};
const radio={productKey:"radio:synthetic",quantity:30},ooh={productKey:"ooh:synthetic",quantity:2};
test("adding digital after other media finishes saving once, regardless of server order",async()=>{
  const digital={productKey:digitalBudgetKey("meta-ads","views",100000),quantity:1};
  const desired=[radio,ooh,digital];let requests=0;
  const fetcher:typeof fetch=async(_url,init)=>{
    requests++;const body=JSON.parse(String(init?.body));
    assert.equal(cartFingerprint(body.items),JSON.stringify(body.items));
    return Response.json({ok:true,cart:{version:2,items:[...body.items].reverse(),clientId:null}});
  };
  const result=await persistCatalogCart(desired,1,null,{fetcher});
  assert.equal(result.ok,true);
  if(result.ok)assert.equal(cartFingerprint(desired),cartFingerprint(result.cart.items));
  assert.equal(requests,1);
});
test("a stalled save and recovery abort instead of locking navigation indefinitely",async()=>{
  const fetcher:typeof fetch=async(_url,init)=>new Promise((_resolve,reject)=>{init?.signal?.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError")),{once:true});});
  await assert.rejects(persistCatalogCart([radio],1,null,{fetcher,timeoutMs:10}),{name:"AbortError"});
  await assert.rejects(recoverCatalogCart({fetcher,timeoutMs:10}),{name:"AbortError"});
});
test("authentication HTML and a changed client cannot be treated as successful persistence",async()=>{
  await assert.rejects(persistCatalogCart([radio],1,null,{fetcher:async()=>new Response("sign in",{headers:{"content-type":"text/html"}})}));
  await assert.rejects(persistCatalogCart([radio],1,null,{fetcher:async()=>Response.json({ok:true,cart:{version:2,clientId:client,items:[radio]}})}));
});
test("pending selections survive navigation only for the same owner and client",()=>{
  const storage=store(),key=cartDraftKey(owner,client),server={version:3,items:[radio],clientId:client};
  assert.equal(saveCartDraft(storage,key,3,cartFingerprint(server.items),[ooh,radio],1000),true);
  assert.deepEqual(recoverCartDraft(storage,key,server,2000),[ooh,radio]);
  assert.equal(recoverCartDraft(storage,cartDraftKey("33333333-3333-4333-8333-333333333333",client),server,2000),null);
  assert.equal(recoverCartDraft(storage,cartDraftKey(owner,null),server,2000),null);
  assert.equal(cartDraftKey("",client),null);
});
test("draft recovery never resurrects a completed purchase, overwrites another tab, or extends two hours",()=>{
  const storage=store(),key=cartDraftKey(owner,null),base={version:3,items:[radio]};
  saveCartDraft(storage,key,3,cartFingerprint(base.items),[ooh,radio],1000);
  assert.equal(recoverCartDraft(storage,key,{version:4,items:[]},2000),null);
  assert.equal(recoverCartDraft(storage,key,{version:4,items:[ooh]},2000),null);
  assert.equal(recoverCartDraft(storage,key,base,1000+2*60*60*1000),null);
  assert.equal(recoverCartDraft(storage,key,{version:4,items:[radio,ooh]},2000),null);
  assert.equal(storage.getItem(key!),null);
});
