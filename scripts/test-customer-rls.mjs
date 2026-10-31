/** Offline PostgreSQL RLS regression test. Install @electric-sql/pglite in a
 * separate tools directory and set PGLITE_MODULE to its dist/index.js path.
 * This uses synthetic accounts only. It does not attest production policies. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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
// Exercise the private library and Storage boundary with deliberately broad
// unrelated storage policies to catch accidental reliance on permissive defaults.
await db.exec(`create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated,anon,service_role;
grant select,insert,update,delete on storage.objects to authenticated,anon,service_role;
create policy unrelated_broad_policy on storage.objects for all to authenticated,anon using(true) with check(true);`);
await db.exec(await source('supabase/migrations/0018_campaign_library.sql'));
await db.query("update companies set status='activa' where id=$1",[a]);
const ca=id(401),cb=id(402),filmA=id(501),filmB=id(502),docA=id(601),docB=id(602),hidden=id(603);
await db.query("insert into workspace_clients(id,company_id,name) values($1,$2,'Client A'),($3,$4,'Client B')",[ca,a,cb,b]);
await db.query("insert into workspace_campaigns(id,company_id,client_id,name) values($1,$2,$3,'Film A'),($4,$5,$6,'Film B')",[filmA,a,ca,filmB,b,cb]);
const pathA=a+'/'+filmA+'/'+docA+'/plan.pdf',pathB=b+'/'+filmB+'/'+docB+'/plan.pdf',pathHidden=a+'/'+filmA+'/'+hidden+'/hidden.pdf';
await db.query("insert into workspace_documents(id,company_id,campaign_id,title,kind,downloadable,storage_path) values($1,$2,$3,'Plan A','plan',true,$4),($5,$6,$7,'Plan B','plan',true,$8),($9,$2,$3,'Hidden attachment','report',false,$10)",[docA,a,filmA,pathA,docB,b,filmB,pathB,hidden,pathHidden]);
for(const name of [pathA,pathB,pathHidden])await db.query("insert into storage.objects(bucket_id,name) values('workspace-documents',$1)",[name]);
await db.query("insert into storage.objects(bucket_id,name) values('unrelated','public.png')");
await assert.rejects(db.query("insert into workspace_campaigns(company_id,client_id,name) values($1,$2,'Wrong tenant')",[a,cb]),e=>e.code==='23503');checks++;
await assert.rejects(db.query("insert into workspace_metrics(company_id,campaign_id,plan_document_id,label,unit,planned) values($1,$2,$3,'Wrong campaign','number','{}')",[a,filmA,docB]),e=>e.code==='23503');checks++;
await asUser(planner);
await count('select id from workspace_clients',[],1);
await count('select id from workspace_campaigns',[],1);
await count('select id from workspace_documents',[],2);
await count('select id from workspace_documents where id=$1',[docB],0);
await count("select name from storage.objects where bucket_id='workspace-documents'",[],1);
await denied("insert into workspace_clients(company_id,name) values($1,'Unauthorized')",[a]);
await denied("update workspace_documents set downloadable=true where id=$1",[hidden]);
await denied("delete from workspace_campaigns where id=$1",[filmA]);
await denied("insert into storage.objects(bucket_id,name) values('workspace-documents',$1)",[a+'/'+filmA+'/'+docA+'/new.pdf']);
await count("update storage.objects set name='replaced' where name=$1 returning id",[pathA],0);
await count("delete from storage.objects where name=$1 returning id",[pathA],0);
await asUser(other);
await count("select id from workspace_campaigns where id=$1",[filmA],0);
await count("select name from storage.objects where name=$1",[pathA],0);
await count("select name from storage.objects where name=$1",[pathB],1);
await asUser(viewer);
await count('select id from workspace_clients',[],1);
await denied("insert into workspace_campaigns(company_id,client_id,name) values($1,$2,'Unauthorized')",[a,ca]);
await asUser('', 'anon');
await denied('select id from workspace_clients');
await count("select name from storage.objects where bucket_id='workspace-documents'",[],0);
await denied("insert into storage.objects(bucket_id,name) values('workspace-documents','anonymous.pdf')");
await db.exec('reset role');
await db.query("update companies set status='suspendida' where id=$1",[a]);
await asUser(planner);
await count('select id from workspace_documents',[],0);
await count("select name from storage.objects where name=$1",[pathA],0);
await asUser(admin);
await count('select id from workspace_clients',[],2);
await count("select name from storage.objects where bucket_id='workspace-documents'",[],2);
await db.exec('reset role');
await db.exec(await source('supabase/migrations/0018_campaign_library.sql'));checks++;
await db.query("update companies set status='activa' where id=$1",[a]);
const scratch=await mkdtemp(join(tmpdir(),'workspace-library-test-'));
try {
 const ci=id(901),fi=id(902),di=id(903);
 const quotedName="Example's $$ campaign";
 const fixture={clients:[{id:ci,name:quotedName,category:'Test',campaignKind:'film'}],
 campaigns:[{id:fi,clientId:ci,name:'Synthetic film',period:'June',status:'reported',poster:null,summary:''}],
 documents:[{id:di,campaignId:fi,title:"Report's title",kind:'report',version:'V1',issuedOn:'2026-06-30',downloadable:false,summary:'',sections:[{title:'Delivery',columns:['Media','Units'],rows:[["Owner's placement",'2']]}]}],metrics:[]};
 const input=join(scratch,'fixture.json'),output=join(scratch,'import.sql');
 await writeFile(input,JSON.stringify(fixture));
 const cli=fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs',import.meta.url));
 const script=fileURLToPath(new URL('./prepare-workspace-library.ts',import.meta.url));
 execFileSync(process.execPath,[cli,script,'--input',input,'--output',output,'--company',a,'--company-name','A']);
 const sql=await readFile(output,'utf8');
 await db.exec(sql);
 assert.equal((await db.query('select name from workspace_clients where id=$1',[ci])).rows[0].name,quotedName);checks++;
 await db.exec(sql);await count('select id from workspace_documents where id=$1',[di],1);
 const collision=join(scratch,'collision.sql');
 execFileSync(process.execPath,[cli,script,'--input',input,'--output',collision,'--company',b,'--company-name','B']);
 await assert.rejects(db.exec(await readFile(collision,'utf8')));checks++;
 await db.exec('rollback');
 await count('select id from workspace_clients where id=$1 and company_id=$2',[ci,a],1);
 await count('select id from workspace_clients where id=$1 and company_id=$2',[ci,b],0);
 const wrongName=sql.replace("name='A'","name='Wrong'");
 await assert.rejects(db.exec(wrongName));checks++;
 await db.exec('rollback');
} finally { await rm(scratch,{recursive:true,force:true}); }
await db.exec('reset role');
await db.exec(await source('supabase/migrations/0021_tgi_research.sql'));
await asUser(admin,'service_role');
await db.query("insert into tgi_research(id,payload,source_sha256) values('synthetic','{\"indicators\":[]}',repeat('a',64))");checks++;
for (const [user,role] of [[planner,'authenticated'],[admin,'authenticated'],['','anon']]) {
 await asUser(user,role); await denied('select * from tgi_research');
 await denied("update tgi_research set active=true");
}
await db.exec('reset role');
assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.tgi_research'::regclass")).rows[0].relrowsecurity,true);checks++;
await db.exec(await source('supabase/migrations/0021_tgi_research.sql'));checks++;
await db.close();
console.log(JSON.stringify({status:'passed',checks,environment:'isolated PostgreSQL/PGlite; synthetic data; not production'}));
