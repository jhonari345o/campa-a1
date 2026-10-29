import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCustomerInput } from '../lib/customer-access';
import { workspaceIdentity } from '../lib/workspace-brand';
import { canCompanyRole } from '../lib/permissions';

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
