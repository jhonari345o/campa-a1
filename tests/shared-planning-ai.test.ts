import assert from "node:assert/strict";
import test from "node:test";
import { getLlmConfiguration, planningAiEnabled } from "../lib/assistant/llm-config";
import { chatCompletion } from "../lib/assistant/llm";

const freeEnv = { AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "test-only", AI_ASSISTANT_ENABLED: "true", BEDROCK_MODEL_ID: "configured-for-later" };

test("planning reuses Mavi's selected free provider even with Bedrock configured", () => {
  const config = getLlmConfiguration(freeEnv)!;
  assert.equal(config.provider, "openrouter");
  assert.equal(config.freeOnly, true);
  assert.equal(planningAiEnabled("strategy", config, freeEnv), true);
  assert.equal(planningAiEnabled("category", config, freeEnv), true);
  assert.equal(planningAiEnabled("strategy", config, { ...freeEnv, MEDIA_STRATEGY_AI_ENABLED: "false" }), false);
  assert.equal(JSON.stringify(config).includes("test-only"), false);
});

test("missing credentials never redirect an explicitly selected provider", () => {
  assert.equal(getLlmConfiguration({ ...freeEnv, OPENROUTER_API_KEY: undefined, DEEPSEEK_API_KEY: "test" }), null);
  assert.equal(getLlmConfiguration({ ...freeEnv, AI_PROVIDER: "unknown" }), null);
  assert.equal(planningAiEnabled("strategy", null, { MEDIA_STRATEGY_AI_ENABLED: "true" }), false);
});

test("free model fallbacks remain free and preserve configured priority", () => {
  const config = getLlmConfiguration({ ...freeEnv, OPENROUTER_FALLBACK_MODELS: "paid/model,other/model:free,openrouter/free,other/model:free" })!;
  assert.deepEqual(config.fallbackModels, ["other/model:free", "openrouter/free"]);
  const changed = getLlmConfiguration({ ...freeEnv, OPENROUTER_FALLBACK_MODELS: "openrouter/free" });
  assert.notEqual(JSON.stringify(config), JSON.stringify(changed));
});

test("paid providers remain opt-in for planning; existing Bedrock flags still work", () => {
  for (const env of [
    { AI_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "test", AI_ASSISTANT_ENABLED: "true" },
    { ...freeEnv, OPENROUTER_MODEL: "paid/model" },
    { ...freeEnv, AI_PROVIDER: "bedrock" },
  ]) {
    const config = getLlmConfiguration(env)!;
    assert.equal(planningAiEnabled("strategy", config, env), false);
    assert.equal(planningAiEnabled("strategy", config, { ...env, MEDIA_STRATEGY_AI_ENABLED: "true" }), true);
  }
  const config = getLlmConfiguration({ ...freeEnv, AI_PROVIDER: "bedrock" });
  assert.equal(planningAiEnabled("strategy", config, { MEDIA_STRATEGY_AWS_AI_ENABLED: "true" }), true);
});

async function mockProvider(response: Response | Response[], run: (requests: { url: string; body: Record<string, unknown>; signal: AbortSignal | null | undefined }[]) => Promise<void>) {
  const before = { ...process.env }, originalFetch = globalThis.fetch;
  const requests: { url: string; body: Record<string, unknown>; signal: AbortSignal | null | undefined }[] = [];
  Object.assign(process.env, freeEnv, { OPENROUTER_MODEL: "test/primary:free", OPENROUTER_FALLBACK_MODELS: "test/backup:free,paid/model", LLM_REQUEST_TIMEOUT_MS: "10000" });
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)), signal: init?.signal });
    const responses = Array.isArray(response) ? response : [response];
    return responses[Math.min(requests.length - 1, responses.length - 1)].clone();
  };
  try { await run(requests); } finally { globalThis.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]; Object.assign(process.env, before); }
}

test("structured planning requests pass fallback, zero-price cap and cancellation to the existing provider", async () => {
  await mockProvider(Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"summary":"Análisis"}' } }] }), async requests => {
    const controller = new AbortController();
    const result = await chatCompletion([{ role: "user", content: "Return JSON" }], { json: true, maxTokens: 6000, reasoningEffort: "low", signal: controller.signal });
    assert.equal(result, '{"summary":"Análisis"}');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://openrouter.ai/api/v1/chat/completions");
    assert.deepEqual(requests[0].body.models, ["test/primary:free", "test/backup:free", "openrouter/free"]);
    assert.deepEqual(requests[0].body.response_format, { type: "json_object" });
    assert.deepEqual(requests[0].body.provider, { max_price: { prompt: 0, completion: 0 } });
    assert.deepEqual(requests[0].body.reasoning, { effort: "low", exclude: true });
    assert.equal(requests[0].body.max_tokens, 6000);
    controller.abort(); assert.equal(requests[0].signal?.aborted, true);
  });
});

test("exhausted provider quota and truncated responses never become an AI recommendation", async () => {
  await mockProvider(new Response("private account detail", { status: 429 }), async requests => {
    await assert.rejects(chatCompletion([{ role: "user", content: "test" }], { json: true }), /^Error: PROVIDER_HTTP_429$/);
    assert.equal(requests.length, 1);
  });
  await mockProvider(Response.json({ choices: [{ finish_reason: "length", message: { content: '{"partial":true}' } }] }), async requests => {
    await assert.rejects(chatCompletion([{ role: "user", content: "test" }], { json: true }), /PROVIDER_OUTPUT_TRUNCATED/);
    assert.equal(requests.length, 2);
  });
});
test("the bounded planning response can disable optional reasoning without changing the free fallback pool",async()=>{
  await mockProvider(Response.json({choices:[{finish_reason:"stop",message:{content:"{}"}}]}),async requests=>{
    await chatCompletion([{role:"user",content:"Return JSON"}],{json:true,reasoningEnabled:false,maxTokens:3200});
    assert.deepEqual(requests[0].body.reasoning,{enabled:false});
    assert.deepEqual(requests[0].body.models,["test/primary:free","test/backup:free","openrouter/free"]);
    assert.deepEqual(requests[0].body.provider,{max_price:{prompt:0,completion:0}});
  });
});

test("a rejected model advances through only the configured free pool within one deadline", async () => {
  await mockProvider([
    Response.json({error:{message:"Unknown model test/primary:free"}},{status:400}),
    Response.json({error:{message:"Reasoning option unsupported"}},{status:400}),
    Response.json({choices:[{finish_reason:"stop",message:{content:'{"complete":true}'}}]}),
  ],async requests=>{
    assert.equal(await chatCompletion([{role:"user",content:"Return JSON"}],{json:true,reasoningEnabled:false}),'{"complete":true}');
    assert.equal(requests.length,3);
    assert.deepEqual(requests.map(r=>r.body.model),["test/primary:free","test/backup:free","openrouter/free"]);
    for(const request of requests){
      assert.deepEqual(request.body.provider,{max_price:{prompt:0,completion:0}});
      assert.equal(request.signal,requests[0].signal);
    }
  });
});

test("provider rejection diagnoses never expose raw details or retry access denials",async()=>{
  for(const [status,message,code] of [[400,"Reasoning disabled for private account abc","PROVIDER_HTTP_400_REASONING"],[401,"private account abc","PROVIDER_HTTP_401"],[403,"private account abc","PROVIDER_HTTP_403"]] as const){
    await mockProvider(Response.json({error:{message}},{status}),async requests=>{
      await assert.rejects(chatCompletion([{role:"user",content:"Return JSON"}],{json:true}),new RegExp(`^Error: ${code}$`));
      assert.equal(requests.length,status===400?3:1);
    });
  }
});

test("bad-request fallback cannot add paid inference",async()=>{
  await mockProvider(Response.json({error:{message:"Unknown model"}},{status:400}),async requests=>{
    process.env.OPENROUTER_MODEL="paid/primary";
    await assert.rejects(chatCompletion([{role:"user",content:"test"}]),/PROVIDER_HTTP_400_MODEL/);
    assert.equal(requests.length,1);
  });
});

test("a truncated free completion retries once on the remaining pool with the original deadline", async () => {
  await mockProvider([
    Response.json({ model: "test/primary:free", choices: [{ finish_reason: "length", message: { content: '{"partial":true}' } }] }),
    Response.json({ model: "test/backup:free", choices: [{ finish_reason: "stop", message: { content: '{"complete":true}' } }] }),
  ], async requests => {
    const result = await chatCompletion([{ role: "user", content: "Return JSON" }], { json: true });
    assert.equal(result, '{"complete":true}');
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1].body.models, ["test/backup:free", "openrouter/free"]);
    assert.deepEqual(requests[1].body.provider, { max_price: { prompt: 0, completion: 0 } });
    assert.equal(requests[0].signal, requests[1].signal);
  });
});

test("truncation does not silently add paid inference requests", async () => {
  await mockProvider(Response.json({ choices: [{ finish_reason: "length", message: { content: "partial" } }] }), async requests => {
    process.env.OPENROUTER_MODEL = "paid/primary";
    await assert.rejects(chatCompletion([{ role: "user", content: "test" }]), /PROVIDER_OUTPUT_TRUNCATED/);
    assert.equal(requests.length, 1);
  });
});

test("an already cancelled request never reaches a provider", async () => {
  await mockProvider(Response.json({ choices: [] }), async requests => {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(chatCompletion([{ role: "user", content: "test" }], { signal: controller.signal }), /PROVIDER_TIMEOUT/);
    assert.equal(requests.length, 0);
  });
});
test("structured response contracts survive fallback and require compatible zero-priced endpoints",async()=>{
  const responseSchema={name:"media_strategy",schema:{type:"object",additionalProperties:false,properties:{medium:{type:"string",enum:["television"]}},required:["medium"]}};
  await mockProvider([Response.json({error:{message:"Unknown model"}},{status:400}),Response.json({choices:[{finish_reason:"stop",message:{content:'{"medium":"television"}'}}]})],async requests=>{
    assert.equal(await chatCompletion([{role:"user",content:"Return JSON"}],{json:true,responseSchema}),'{"medium":"television"}');
    assert.equal(requests.length,2);
    for(const request of requests){
      assert.deepEqual(request.body.response_format,{type:"json_schema",json_schema:{...responseSchema,strict:true}});
      assert.deepEqual(request.body.provider,{max_price:{prompt:0,completion:0},require_parameters:true});
    }
  });
});
