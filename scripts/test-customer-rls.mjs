/** Offline PostgreSQL RLS regression test. Install @electric-sql/pglite in a
 * separate tools directory and set PGLITE_MODULE to its dist/index.js path.
 * This uses synthetic accounts only. It does not attest production policies. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
let checks=0;
const source = (path) => readFile(new URL('../'+path, import.meta.url), 'utf8');
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
grant usage on schema auth,public to authenticated,anon,service_role;
grant execute on all functions in schema auth to authenticated,anon,service_role;`);
// PGlite includes gen_random_uuid; citext is represented as text in this fixture.
await db.exec((await source('supabase/schema.sql')).replace(/^create extension[^\n]*$/gm,'').replace(/\bcitext\b/g,'text'));
for (const file of ['0002_profiles_comember_read.sql','0005_campaign_jobs.sql','0007_handoff_security.sql','0008_media_workspace.sql','0012_plan_orders_collaboration.sql','0013_company_plan_collaboration.sql','0017_customer_workspaces.sql']) {
  await db.exec(await source('supabase/migrations/'+file));
}
// Supabase exposes the tables through PostgREST; tests must exercise RLS, not missing grants.
await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
grant all on all tables in schema public,auth to service_role;
grant usage,select on all sequences in schema public to service_role;`);
const id=(n)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const admin=id(1), planner=id(2), other=id(3), viewer=id(4), approver=id(5), fresh=id(6), overflow=id(7);
const a=id(101),b=id(102),planA=id(201),planB=id(202),orderA=id(301);
for (const u of [admin,planner,other,viewer,approver,fresh,overflow]) await db.query('insert into auth.users(id,email) values($1,$2)',[u,u+'@example.test']);
await db.query('update profiles set is_platform_admin=true where id=$1',[admin]);
await db.query("insert into companies(id,name,slug,status,seats) values($1,'A','a','activa',4),($2,'B','b','activa',2)",[a,b]);
await db.query("insert into company_members(company_id,user_id,role) values($1,$2,'planner'),($3,$4,'planner'),($1,$5,'viewer'),($1,$6,'approver')",[a,planner,b,other,viewer,approver]);
async function asUser(u,role='authenticated') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[u,role]); await db.exec('set role '+role); }
async function denied(sql,args=[]) { await assert.rejects(db.query(sql,args), e=>e.code==='42501'); checks++; }
async function count(sql,args,expected) { const r=await db.query(sql,args); assert.equal(r.rows.length,expected); checks++; }
await asUser(admin,'service_role');
await db.query('insert into media_plans(id,owner_id,company_id) values($1,$2,$3),($4,$5,$6)',[planA,planner,a,planB,other,b]);
await db.query("insert into advertisers(name) values('Restricted commercial source')");
await asUser(planner);
await count('select id from companies',[],1);
await count('select id from media_plans',[],1);
await count('select id from media_plans where id=$1',[planB],0);
await count('select id from advertisers',[],0);
await denied("insert into media_plans(owner_id,company_id) values($1,$2)",[planner,b]);
await denied('update media_plans set company_id=$1 where id=$2',[b,planA]);
await denied("update media_plans set status='aprobado' where id=$1",[planA]);
await denied("insert into media_plans(owner_id,company_id,status) values($1,$2,'aprobado')",[planner,a]);
await denied("insert into media_plan_approvals(plan_id,actor_id,decision,plan_version) values($1,$2,'approved',1)",[planA,planner]);
await db.query("update media_plans set name='Editable draft',status='revision' where id=$1",[planA]);checks++;
await db.query('insert into media_orders(id,plan_id,owner_id,company_id) values($1,$2,$3,$4)',[orderA,planA,planner,a]);checks++;
await count("update media_orders set status='approved' where id=$1 returning id",[orderA],0);
await denied("insert into campaign_jobs(company_id,platform,created_by,status) values($1,'meta',$2,'publicada')",[a,planner]);
await db.query("insert into campaign_jobs(company_id,platform,created_by) values($1,'meta',$2)",[a,planner]);checks++;
await denied("insert into company_members(company_id,user_id,role) values($1,$2,'admin')",[b,planner]);
await db.query('update profiles set is_platform_admin=true where id=$1',[planner]);
assert.equal((await db.query('select public.is_platform_admin() as admin')).rows[0].admin,false);checks++;
await denied('select public.provision_customer_membership($1,$2,$3,$4,$5,$6)',[admin,fresh,a,'Fresh',fresh+'@example.test','planner']);
await asUser(viewer);
await denied('insert into media_plans(owner_id,company_id) values($1,$2)',[viewer,a]);
await count('update media_plans set name=$1 where id=$2 returning id',['Viewer edit',planA],0);
await asUser(other);
await count('select id from media_orders where id=$1',[orderA],0);
await count('select id from campaign_jobs where company_id=$1',[a],0);
await asUser(approver);
await db.query("insert into media_plan_approvals(plan_id,actor_id,decision,plan_version) values($1,$2,'approved',1)",[planA,approver]);checks++;
await db.query("update media_plans set status='aprobado',stage='aprobado',progress=100 where id=$1",[planA]);checks++;
await denied('update media_plans set name=$1 where id=$2',['Approver edits content',planA]);
await asUser(admin,'service_role');
await db.query('select public.provision_customer_membership($1,$2,$3,$4,$5,$6)',[admin,fresh,a,'Fresh',fresh+'@example.test','planner']);checks++;
await assert.rejects(db.query('select public.provision_customer_membership($1,$2,$3,$4,$5,$6)',[admin,overflow,a,'Overflow',overflow+'@example.test','planner']));checks++;
await count('select user_id from company_members where user_id=$1',[overflow],0);
await count("select id from audit_log where action='customer_user.created'",[],1);
await db.query("update companies set status='suspendida' where id=$1",[a]);
await asUser(planner);await count('select id from media_plans',[],0);
await asUser(admin);await count('select id from media_plans',[],2);
await asUser('', 'anon');await denied('select public.provision_customer_membership($1,$2,$3,$4,$5,$6)',[admin,fresh,a,'Fresh',fresh+'@example.test','planner']);
await db.exec('reset role');
await db.exec(await source('supabase/migrations/0017_customer_workspaces.sql'));checks++;
await db.close();
console.log(JSON.stringify({status:'passed',checks,environment:'isolated PostgreSQL/PGlite; synthetic data; not production'}));
