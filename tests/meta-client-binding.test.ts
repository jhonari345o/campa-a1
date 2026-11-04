import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMetaBindingSnapshot,
  metaScopeFromJob,
  parseMetaClientBindings,
  selectMetaClientBinding,
  snapshotMetaBinding,
  type MetaClientBinding,
} from "../lib/ads/meta-client-binding";

const ucsg: MetaClientBinding = {
  id: "ucsg", name: "UCSG", version: 1, active: true,
  companyId: "10000000-0000-4000-8000-000000000001", clientId: null,
  adAccountId: "act_101", pageId: "201", instagramUserId: "301",
  credentialEnv: "META_CLIENT_TOKEN_UCSG",
};
const warner: MetaClientBinding = {
  ...ucsg, id: "lettera-warner", name: "Léttera · Warner",
  companyId: "20000000-0000-4000-8000-000000000002",
  clientId: "30000000-0000-4000-8000-000000000003",
  adAccountId: "act_102", pageId: "202", instagramUserId: "302",
  credentialEnv: "META_CLIENT_TOKEN_LETTERA_WARNER",
};
const registry = () => parseMetaClientBindings(JSON.stringify([ucsg, warner]));

test("cada cliente resuelve únicamente sus propios activos, incluso dentro de una agencia", () => {
  const bindings = registry();
  assert.equal(selectMetaClientBinding(bindings, ucsg).pageId, "201");
  assert.equal(selectMetaClientBinding(bindings, warner).pageId, "202");
  assert.throws(() => selectMetaClientBinding(bindings, { companyId: ucsg.companyId, clientId: warner.clientId }));
  assert.throws(() => selectMetaClientBinding(bindings, { companyId: warner.companyId, clientId: null }));
  assert.throws(() => selectMetaClientBinding(bindings, { companyId: warner.companyId, clientId: ucsg.companyId }));
});

test("un registro vacío, ausente, inactivo o ambiguo nunca hereda una cuenta global", () => {
  for (const raw of [undefined, "", "[]"]) assert.throws(() => selectMetaClientBinding(parseMetaClientBindings(raw), ucsg));
  const disabled = [{ ...ucsg, active: false }];
  assert.throws(() => selectMetaClientBinding(disabled, ucsg));
  // Stopping delivery/reporting can still use the original disabled connection.
  assert.equal(selectMetaClientBinding(disabled, ucsg, true).id, "ucsg");
  assert.throws(() => selectMetaClientBinding([ucsg, { ...ucsg, id: "duplicate" }], ucsg));
});

test("rechaza configuraciones duplicadas, secretos embebidos e identificadores manipulados", () => {
  for (const raw of ["null", "{}", "oops", JSON.stringify([null]), JSON.stringify([ucsg, ucsg]),
    JSON.stringify([ucsg, { ...ucsg, id: "other" }]), JSON.stringify([ucsg, { ...warner, id: "ucsg" }])]) {
    assert.throws(() => parseMetaClientBindings(raw));
  }
  for (const patch of [
    { accessToken: "a-secret-must-not-appear" }, { token: "secret" }, { companyId: "*" },
    { clientId: undefined }, { clientId: "any" }, { adAccountId: "act_101/ads" },
    { pageId: "201?fields=secret" }, { instagramUserId: "bad" },
    { credentialEnv: "META_ACCESS_TOKEN" }, { credentialEnv: "NEXT_PUBLIC_TOKEN" },
    { version: 0 }, { version: 1.1 }, { active: "true" },
  ]) {
    assert.throws(() => parseMetaClientBindings(JSON.stringify([{ ...ucsg, ...patch }])), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /a-secret|NEXT_PUBLIC_TOKEN|act_101/);
      return true;
    });
  }
});

test("la identidad congelada bloquea el traslado de una campaña o métricas a otro cliente", () => {
  const stored = snapshotMetaBinding(ucsg);
  assert.doesNotThrow(() => assertMetaBindingSnapshot(ucsg, stored, true));
  for (const patch of [
    { companyId: warner.companyId }, { clientId: warner.clientId },
    { pageId: "999" }, { adAccountId: "act_999" }, { instagramUserId: "999" },
    { credentialEnv: "META_CLIENT_TOKEN_OTHER" }, { version: 2 }, { id: "other" },
  ]) assert.throws(() => assertMetaBindingSnapshot({ ...ucsg, ...patch }, stored, true));
  // Human labels and disabling new launches don't prevent stopping original ads.
  assert.doesNotThrow(() => assertMetaBindingSnapshot({ ...ucsg, name: "UCSG TEC", active: false }, stored, true));
  assert.throws(() => assertMetaBindingSnapshot(ucsg, { ...stored, accessToken: "secret" }, true));
});

test("los anuncios anteriores sin vinculación explícita quedan bloqueados, los borradores nuevos pueden vincularse", () => {
  assert.throws(() => assertMetaBindingSnapshot(ucsg, undefined, true));
  for (const stored of [null, {}, [], "legacy"]) assert.throws(() => assertMetaBindingSnapshot(ucsg, stored, true));
  assert.doesNotThrow(() => assertMetaBindingSnapshot(ucsg, undefined, false));
});

test("el cliente se toma de la orden persistida; los IDs de Meta no eligen el destino", () => {
  const scope = metaScopeFromJob(ucsg.companyId, { pageId: warner.pageId, adAccountId: warner.adAccountId });
  assert.equal(selectMetaClientBinding(registry(), scope).id, "ucsg");
  assert.deepEqual(metaScopeFromJob(warner.companyId, { client_id: warner.clientId }), { companyId: warner.companyId, clientId: warner.clientId });
  assert.throws(() => metaScopeFromJob(ucsg.companyId, { client_id: 123 }));
  assert.throws(() => metaScopeFromJob(ucsg.companyId, { client_id: "another-client" }));
  assert.throws(() => metaScopeFromJob("any", {}));
});
