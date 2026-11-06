import assert from "node:assert/strict";
import test from "node:test";
import { detectAssistantAction } from "../lib/assistant/actions";
import { decodeXml } from "../lib/assistant/trends";

test("campaign URLs trim only trailing punctuation and keep embedded punctuation",()=>{
  assert.equal(detectAssistantAction("Pauta este reel https://www.instagram.com/reel/abc/).,;")?.postUrl,"https://www.instagram.com/reel/abc/");
  assert.equal(detectAssistantAction("Pauta este reel https://www.instagram.com/reel/a)b.c/;")?.postUrl,"https://www.instagram.com/reel/a)b.c/");
  assert.equal(detectAssistantAction("Pauta una publicación de Instagram por USD 500")?.postUrl,null);
});

test("long punctuation runs are processed without suffix backtracking",()=>{
  const url=`https://www.instagram.com/reel/${")".repeat(100_000)}x`;
  assert.equal(detectAssistantAction(`Pauta este reel ${url}`)?.postUrl,url);
  assert.equal(detectAssistantAction(`Pauta este reel ${url}${".,;)".repeat(25_000)}`)?.postUrl,url);
});

test("RSS entities decode exactly one layer and preserve unknown entities",()=>{
  assert.equal(decodeXml('&amp; &quot; &#39; &apos; &lt; &gt;'),'& " \' \' < >');
  assert.equal(decodeXml('&amp;lt;script&amp;gt;'),'&lt;script&gt;');
  assert.equal(decodeXml('&amp;amp; &unknown;'),'&amp; &unknown;');
  assert.equal(decodeXml('Educación y medios'),'Educación y medios');
});
