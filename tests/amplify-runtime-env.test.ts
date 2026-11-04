import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Amplify entrega las conexiones privadas de Meta al servidor sin exportar credenciales AWS", () => {
  const build = readFileSync(new URL("../amplify.yml", import.meta.url), "utf8");
  const pattern = build.match(/grep -E '([^']+)' >> \.env\.production/)?.[1];
  assert.ok(pattern);
  const allowed = new RegExp(pattern);
  for (const key of ["META_CLIENT_BINDINGS_JSON", "META_CLIENT_TOKEN_UCSG", "META_GRAPH_API_VERSION", "META_PAUSED_DRAFTS_ENABLED", "META_REAL_SPEND_ENABLED", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENROUTER_API_KEY"]) {
    assert.ok(allowed.test(`${key}=test-value`), key);
  }
  for (const key of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "UNRELATED_SECRET", "MY_META_CLIENT_TOKEN"]) {
    assert.equal(allowed.test(`${key}=test-value`), false, key);
  }
});
