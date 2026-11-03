import assert from "node:assert/strict";
import test from "node:test";
import { selectAvailableFreeModels } from "../lib/assistant/free-model-routing";
import { chatCompletion } from "../lib/assistant/llm";

const row = (id:string, overrides:Record<string,unknown>={}) => ({ id, context_length:100_000, pricing:{prompt:"0",completion:"0"}, supported_parameters:["response_format"], ...overrides });

test("only available, explicitly free, compatible models replace retired configured IDs",()=>{
  const models=selectAvailableFreeModels(["retired/model:free","live/preferred:free","paid/model"],[
    row("live/other:free"),row("live/preferred:free"),row("paid/model"),row("mispriced/model:free",{pricing:{prompt:"0",completion:"0.01"}}),
    row("small/context:free",{context_length:1000}),row("no/json:free",{supported_parameters:[]}),row("unknown/price:free",{pricing:{prompt:null,completion:null}}),
  ],true,40_000);
  assert.deepEqual(models,["live/preferred:free","live/other:free","openrouter/free"]);
  assert.deepEqual(selectAvailableFreeModels(["retired/model:free"],[],true,40_000),["openrouter/free"]);
});

test("a valid free completion can finish after ten seconds without a premature restart",async()=>{
  const originalFetch=globalThis.fetch;
  const keys=["AI_PROVIDER","OPENROUTER_API_KEY","OPENROUTER_MODEL","OPENROUTER_FALLBACK_MODELS"];
  const previous=keys.map(key=>process.env[key]);
  Object.assign(process.env,{AI_PROVIDER:"openrouter",OPENROUTER_API_KEY:"synthetic-test-key",OPENROUTER_MODEL:"retired/model:free",OPENROUTER_FALLBACK_MODELS:"live/preferred:free"});
  const requests:Record<string,unknown>[]=[];let actualModel="";
  globalThis.fetch=async (url,options)=>{
    if(String(url).endsWith("/models")) {
      assert.equal(options?.headers,undefined);
      return new Response(JSON.stringify({data:[row("live/preferred:free"),row("live/other:free")]}),{status:200});
    }
    const body=JSON.parse(String(options?.body));requests.push(body);
    assert.equal(body.model,"live/preferred:free");
    assert.deepEqual(body.provider.max_price,{prompt:0,completion:0});
    assert.equal(body.provider.require_parameters,true);
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{options?.signal?.removeEventListener("abort",abort);resolve();},10_500);
      const abort=()=>{clearTimeout(timer);reject(options?.signal?.reason);};
      options?.signal?.addEventListener("abort",abort,{once:true});
    });
    return new Response(JSON.stringify({model:"live/preferred:free",choices:[{finish_reason:"stop",message:{content:'{"ok":true}'}}]}),{status:200});
  };
  try {
    const result=await chatCompletion([{role:"user",content:"Synthetic test only"}],{fastFreeRouting:true,json:true,responseSchema:{name:"test",schema:{type:"object"}},timeoutMs:14_000,onModel:model=>{actualModel=model;}});
    assert.equal(result,'{"ok":true}');assert.equal(requests.length,1);assert.equal(actualModel,"live/preferred:free");
  } finally {
    globalThis.fetch=originalFetch;
    keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});
  }
});
