import test from "node:test";
import assert from "node:assert/strict";
import { clientPlanningHref, requestedWorkspaceClient } from "../lib/client-navigation";
import { workspaceIdentity } from "../lib/workspace-brand";

test("client links preserve the intended plan mode without trusting URL identities", () => {
  const clients = [{ id: "owned", name: "Brand A" }];
  assert.equal(requestedWorkspaceClient(clients, "owned")?.name, "Brand A");
  assert.equal(requestedWorkspaceClient(clients, "another-company-client"), null);
  assert.equal(requestedWorkspaceClient([], "owned"), null);
  assert.equal(requestedWorkspaceClient(clients, undefined), null);
  assert.equal(clientPlanningHref("owned", "diy"), "/planificador?view=diy&client=owned");
  assert.equal(clientPlanningHref("x&client=foreign"), "/planificador?view=planner&client=x%26client%3Dforeign");
});

test("Breinjart branding requires its active authenticated membership", () => {
  const company = {id:"synthetic",name:"Breinjart",role:"planner",status:"activa",brand_key:"breinjart",portal_kind:"agency"};
  assert.equal(workspaceIdentity([company], false)?.brand, "breinjart");
  assert.equal(workspaceIdentity([{...company,brand_key:"one"}], false)?.brand, "one");
  assert.equal(workspaceIdentity([{...company,status:"suspendida"}], false), null);
  assert.equal(workspaceIdentity([company], true), null);
});
