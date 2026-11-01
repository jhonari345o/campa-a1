import assert from "node:assert/strict";import test from "node:test";import {domainAllows,portalCapabilities,portalKind} from "../lib/portal-access";
test("workspace domain matching is exact and cannot match suffixes, forged domains or subdomains",()=>{assert.equal(domainAllows("medios@lettera.ec",["lettera.ec"]),true);assert.equal(domainAllows("USER@WBD.COM",["wbd.com"]),true);for(const v of ["a@evillettera.ec","a@lettera.ec.attacker.com","a@sub.lettera.ec","a@@lettera.ec","a@lettera.ec trailing","@lettera.ec"])assert.equal(domainAllows(v,["lettera.ec"]),false)});
test("client portals only browse catalog and reports, even if an incorrect planning role is supplied",()=>{for(const role of ["viewer","planner","admin","approver"]){const c=portalCapabilities("client",role);assert.equal(c.plan,false);assert.equal(c.request,false);assert.equal(c.approve,false);assert.equal(c.catalog,true);assert.equal(c.reports,true);assert.equal(c.manageUsers,false)}});
test("provider edit rights stay in the provider portal and never grant media buying or market browsing",()=>{const c=portalCapabilities("provider","planner");assert.equal(c.providerEdit,true);assert.equal(c.catalog,false);assert.equal(c.reports,false);assert.equal(c.plan,false);assert.equal(c.approve,false);assert.equal(portalCapabilities("provider","viewer").providerEdit,false)});
test("agency planners request without purchase approval and platform administration stays explicit",()=>{assert.equal(portalCapabilities("agency","planner").request,true);assert.equal(portalCapabilities("agency","planner").approve,false);assert.equal(portalCapabilities("agency","approver").approve,true);assert.equal(portalCapabilities("client","viewer",true).manageUsers,true);assert.equal(portalKind("untrusted"),"agency")});

test('client planning is opt-in per workspace and never enables purchase approval',()=>{
 const allowed=portalCapabilities('client','planner',false,true);assert.equal(allowed.plan,true);assert.equal(allowed.request,true);assert.equal(allowed.approve,false);assert.equal(allowed.manageUsers,false);
 assert.equal(portalCapabilities('client','planner',false,false).plan,false);
 assert.equal(portalCapabilities('client','viewer',false,true).request,false);
 assert.equal(portalCapabilities('client','admin',false,true).approve,false);
});
