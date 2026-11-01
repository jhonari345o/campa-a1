import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCustomerInput } from '../lib/customer-access';
import { workspaceIdentity } from '../lib/workspace-brand';
import { canCompanyRole,canWorkspaceRole } from '../lib/permissions';

const company = { id: '00000000-0000-0000-0000-000000000001', name: 'Léttera', status: 'activa', role: 'planner', brand_key: 'lettera' };
test('branding requires one active authenticated membership and never replaces platform administration', () => {
  assert.equal(workspaceIdentity([company], false)?.brand, 'lettera');
  assert.equal(workspaceIdentity([company], true), null);
  assert.equal(workspaceIdentity([], false), null);
  assert.equal(workspaceIdentity([{ ...company, status: 'suspendida' }], false), null);
  assert.equal(workspaceIdentity([company, { ...company, id: 'another' }], false), null);
  assert.equal(workspaceIdentity([{ ...company, brand_key: '<script>' }], false)?.brand, 'one');
});
test('customer provisioning rejects elevated or malformed roles and identifiers', () => {
  const form = new FormData();
  form.set('company_id', company.id); form.set('full_name', 'Equipo de medios');
  form.set('email', ' MEDIA@EXAMPLE.COM '); form.set('role', 'planner');
  assert.equal(parseCustomerInput(form)?.email, 'media@example.com');
  for (const role of ['admin', 'approver', 'platform_admin', '', 'planner,admin']) {
    form.set('role', role); assert.equal(parseCustomerInput(form), null);
  }
  form.set('role', 'planner'); form.set('company_id', "' or 1=1"); assert.equal(parseCustomerInput(form), null);
});
test('a customer planner can plan and request, but cannot approve', () => {
  assert.equal(canCompanyRole('planner', 'plan'), true);
  assert.equal(canCompanyRole('planner', 'campaign:create'), true);
  assert.equal(canCompanyRole('planner', 'campaign:approve'), false);
  assert.equal(canCompanyRole('viewer', 'plan'), false);
});

test('UCSG identity follows its own active company and cannot enable planning or purchase approval for client viewers',()=>{
 const c={...company,name:'Synthetic University',portal_kind:'client',brand_key:'ucsg',role:'viewer'};
 assert.equal(workspaceIdentity([c],false)?.brand,'ucsg');assert.equal(workspaceIdentity([c],false)?.kind,'client');
 assert.equal(canWorkspaceRole(c,'read'),true);assert.equal(canWorkspaceRole(c,'plan'),false);assert.equal(canWorkspaceRole(c,'campaign:create'),false);assert.equal(canWorkspaceRole(c,'campaign:approve'),false);
 assert.equal(canWorkspaceRole({...c,role:'planner'},'campaign:create'),false);
});

test('authorized client planners can prepare plans and requests without acquiring approval rights',()=>{
 const c={role:'planner',portal_kind:'client',client_planning_enabled:true};
 assert.equal(canWorkspaceRole(c,'plan'),true);assert.equal(canWorkspaceRole(c,'campaign:create'),true);assert.equal(canWorkspaceRole(c,'campaign:approve'),false);
 assert.equal(canWorkspaceRole({...c,client_planning_enabled:false},'plan'),false);assert.equal(canWorkspaceRole({...c,role:'admin'},'campaign:approve'),false);
});
