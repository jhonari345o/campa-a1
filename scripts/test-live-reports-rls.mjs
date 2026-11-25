import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema public,auth to authenticated,anon,service_role;
create table public.profiles(id uuid primary key,is_platform_admin boolean);
create table public.companies(id uuid primary key,status text,portal_kind text);
create table public.company_members(user_id uuid,company_id uuid,role text);
create function public.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$select coalesce((select is_platform_admin from public.profiles where id=auth.uid()),false)$$;
insert into auth.users select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,9)i;
insert into public.profiles select id,id='${id(1)}' from auth.users;
insert into public.companies values ('${id(101)}','activa','agency'),('${id(102)}','activa','client'),('${id(103)}','suspendida','agency'),('${id(104)}','activa','provider');
insert into public.company_members values ('${id(2)}','${id(101)}','planner'),('${id(3)}','${id(101)}','viewer'),('${id(4)}','${id(101)}','admin'),('${id(5)}','${id(102)}','viewer'),('${id(6)}','${id(103)}','planner'),('${id(7)}','${id(104)}','planner');`);
await db.exec(await readFile(new URL('../supabase/migrations/0053_live_reports.sql',import.meta.url),'utf8'));
await db.exec(`insert into public.live_reports(id,client_key,client_name,channel_key,channel_name,period,title,embed_url,published) values
('${id(201)}','demo','Demo','programmatic','Programmatic','2026-11-01','November','https://datastudio.google.com/embed/reporting/${id(901)}/page/Example',true),
('${id(202)}','demo','Demo','programmatic','Programmatic','2026-12-01','Draft','https://lookerstudio.google.com/embed/reporting/${id(902)}/page/Example',false);
insert into public.live_report_access(report_id,company_id,user_id,enabled) values
('${id(201)}','${id(101)}','${id(2)}',true),('${id(201)}','${id(101)}','${id(3)}',true),
('${id(201)}','${id(102)}',null,false),('${id(201)}','${id(103)}','${id(6)}',true),
('${id(201)}','${id(104)}','${id(7)}',true),('${id(202)}','${id(101)}','${id(2)}',true);`);
async function as(user,sql,mustChange=false){
 await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${id(user)}',true); select set_config('request.jwt.claims','${JSON.stringify({app_metadata:{must_change_password:mustChange}})}',true);`);
 try{return await db.query(sql);}finally{await db.exec('rollback');}
}
for(const [user,expected] of [[1,2],[2,1],[3,1],[4,0],[5,0],[6,0],[7,0],[8,0]]){
 const result=await as(user,'select id from public.live_reports'); assert.equal(result.rows.length,expected,`user ${user}`);
}
assert.equal((await as(2,'select * from public.live_reports',true)).rows.length,0);
assert.equal((await as(1,'select * from public.live_reports',true)).rows.length,0);
assert.equal((await as(2,'select * from public.live_report_access')).rows.length,0);
assert.equal((await as(1,'select * from public.live_report_access')).rows.length,6);
await assert.rejects(()=>as(2,`update public.live_report_access set enabled=true`),/permission denied/);
await assert.rejects(()=>as(1,`update public.live_reports set published=true`),/permission denied/);
await db.exec('begin;set local role anon;');
await assert.rejects(()=>db.query('select * from public.live_reports'),/permission denied/);
await db.exec('rollback');
// Membership removal immediately revokes a previously granted report.
await db.exec(`update public.company_members set company_id='${id(102)}' where user_id='${id(2)}'`);
assert.equal((await as(2,'select * from public.live_reports')).rows.length,0);
// A pending client grant becomes readable only when explicitly enabled.
await db.exec(`update public.live_report_access set enabled=true where company_id='${id(102)}'`);
assert.equal((await as(5,'select * from public.live_reports')).rows.length,1);
await db.close();
console.log('PASS: explicit users, ungranted coworkers, tenants, drafts, pending client, suspension, activation, provider, anonymous and write protection.');
