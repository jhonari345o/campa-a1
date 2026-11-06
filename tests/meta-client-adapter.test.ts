import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildSync } from "esbuild";

test("Meta crea borradores y consulta métricas con los activos del cliente, nunca con la cuenta global", () => {
  // Resolve the server-only marker to the same empty module used by Next's server build.
  // The fixture replaces fetch completely; no Meta call or spend can occur.
  const root = fileURLToPath(new URL("../", import.meta.url));
  const bundle = buildSync({
    absWorkingDir: root,
    entryPoints: [fileURLToPath(new URL("./fixtures/meta-client-adapter.ts", import.meta.url))],
    bundle: true, platform: "node", format: "cjs", write: false,
    alias: { "server-only": fileURLToPath(new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url)) },
  });
  const result = spawnSync(process.execPath, ["--input-type=commonjs", "-"], {
    cwd: root, input: bundle.outputFiles[0].text, encoding: "utf8", timeout: 15000,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
