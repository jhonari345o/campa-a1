/** Synthetic integration coverage for the current client shopping migrations.
 * Called only from the isolated PGlite runner; never connects to Supabase. */
import assert from 'node:assert/strict';

export async function testCatalogClientFlows(db, source) {
  let checks = 0;
  const equal = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
  const rejected = async (sql, args, pattern) => {
    await assert.rejects(db.query(sql, args), pattern); checks++;
  };
  await db.exec(`reset role;
    alter table auth.users add column raw_app_meta_data jsonb not null default '{}';
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
    $$;`);
  for (const file of [
    '0011_ooh_geographic_inventory.sql', '0020_infomedia_research.sql',
    '0023_ooh_catalog.sql', '0024_radio_directory.sql', '0025_radio_station_profiles.sql',
    '0026_press_directory.sql', '0028_catalog_shopping.sql', '0029_portal_workspaces.sql',
    '0030_catalog_universal.sql', '0031_commercial_credit.sql', '0033_workspace_catalog_products.sql',
    '0034_client_planning.sql', '0035_catalog_private_provenance.sql', '0036_agency_catalog_context.sql',
    '0040_digital_campaign_budgets.sql', '0041_catalog_digital_brief.sql',
    '0044_catalog_tv_defaults.sql', '0045_catalog_radio_defaults.sql',
    '0048_regional_radio_defaults.sql', '0049_digital_production_catalog.sql',
  ]) await db.exec(await source('supabase/migrations/' + file));

  const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const workspaces = [
    { company: id(1), user: id(11), kind: 'agency', client: id(21), agreement: id(31) },
    { company: id(2), user: id(12), kind: 'client', client: null, agreement: id(32) },
    { company: id(3), user: id(13), kind: 'agency', client: id(23), agreement: id(33) },
  ];
  const viewer = id(14), inactive = id(15);
  for (const user of [...workspaces.map(w => w.user), viewer, inactive]) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [user, user+'@example.test']);
  }
  for (const [i, w] of workspaces.entries()) {
    await db.query(`insert into companies(id,name,slug,status,seats,portal_kind,client_planning_enabled)
      values($1,$2,$3,'activa',10,$4,true)`, [w.company,'Synthetic workspace '+i,'synthetic-'+i,w.kind]);
    await db.query(`insert into company_members(company_id,user_id,role) values($1,$2,'planner')`, [w.company,w.user]);
    if (w.client) await db.query('insert into workspace_clients(id,company_id,name) values($1,$2,$3)', [w.client,w.company,'Synthetic client '+i]);
    await db.query(`insert into catalog_price_agreements(id,company_id,client_id,label,valid_from,valid_to)
      values($1,$2,$3,'Synthetic agreement',current_date-1,current_date+365)`, [w.agreement,w.company,w.client]);
    for (const kind of ['tv','radio','ooh','press','influencer']) {
      const key=(kind==='influencer'?'creator':kind)+':synthetic-'+i;
      await db.query('insert into catalog_agreed_rates(agreement_id,product_key,unit_price_cents,tax_included) values($1,$2,1500,false)', [w.agreement,key]);
    }
    await db.query(`insert into company_report_publications(company_id,title,library,published_by)
      values($1,'Synthetic report','{}',$2)`,[w.company,w.user]);
    await db.query(`insert into company_credit_accounts(company_id,monthly_limit_cents,payment_term_days,active)
      values($1,100000,60,true)`,[w.company]);
    await db.query(`insert into infomedia_entitlements(company_id,expires_at) values($1,now()+interval '1 year')`,[w.company]);
  }
  await db.query(`insert into company_members(company_id,user_id,role) values($1,$2,'viewer'),($1,$3,'planner')`,[workspaces[0].company,viewer,inactive]);
  await db.query(`update auth.users set raw_app_meta_data='{"must_change_password":true}' where id=$1`,[inactive]);
  const asUser = async (user, role='authenticated') => {
    await db.exec('reset role');
    const meta=(await db.query('select raw_app_meta_data from auth.users where id=$1',[user])).rows[0]?.raw_app_meta_data ?? {};
    await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false),set_config('request.jwt.claims',$3,false)`,[user,role,JSON.stringify({app_metadata:meta})]);
    await db.exec('set role '+role);
  };
  const scalar = async (sql,args=[]) => (await db.query(sql,args)).rows[0].result;
  const submitSql='select public.submit_catalog_request($1,$2,$3,$4,$5,current_date,$6,$7::jsonb) as result';
  for (const [i,w] of workspaces.entries()) {
    await asUser(w.user);
    equal(await scalar('select public.can_use_media_catalog() as result'),true);
    equal(await scalar('select public.can_access_infomedia() as result'),true);
    equal((await db.query('select company_id from company_report_publications')).rows,[{company_id:w.company}]);
    equal((await db.query('select company_id from company_credit_accounts')).rows,[{company_id:w.company}]);
    equal((await db.query('select id from catalog_price_agreements')).rows,[{id:w.agreement}]);
    const plan=id(100+i);
    await db.query('insert into media_plans(id,owner_id,company_id) values($1,$2,$3)',[plan,w.user,w.company]); checks++;
    await db.query(`update media_plans set name='Synthetic saved plan',status='revision' where id=$1`,[plan]); checks++;
    await rejected(`update media_plans set status='aprobado' where id=$1`,[plan],e=>e.code==='42501');
    await rejected('update company_credit_accounts set monthly_limit_cents=99999999 where company_id=$1',[w.company],e=>e.code==='42501');
    let version=0;
    if(w.client) {
      await rejected('select public.choose_catalog_client($1,0,false)',[workspaces[(i+2)%3].client ?? workspaces[0].client],e=>e.code==='42501');
      const chosen=await scalar('select public.choose_catalog_client($1,0,false) as result',[w.client]);
      version=chosen.version;
    }
    const lines=['tv','radio','ooh','press','influencer','digital'].map(kind=>({
      productKey:kind==='digital'?'digital:meta-ads:budget:reach:10000':(kind==='influencer'?'creator':kind)+':synthetic-'+i,
      kind,quantity:kind==='radio'?30:kind==='ooh'?2:1,unitPriceCents:kind==='digital'?10000:1500,taxIncluded:false,
      unit:'unit',source:kind==='digital'?{}:{agreementId:w.agreement},
    }));
    for(let end=1;end<=lines.length;end++) {
      const draft=lines.slice(0,end).map(({productKey,quantity})=>({productKey,quantity}));
      const saved=await scalar('select public.save_catalog_cart($1,$2::jsonb) as result',[version,JSON.stringify(draft)]);
      equal(saved.ok,true); version=saved.version;
      const loaded=await scalar('select public.load_catalog_cart() as result'); equal(loaded.items,draft);
    }
    const stale=await scalar('select public.save_catalog_cart($1,$2::jsonb) as result',[version-1,'[]']); equal(stale.code,'conflict');
    equal((await db.query('select owner_id from catalog_carts')).rows,[{owner_id:w.user}]);
    const args=[w.user,w.company,version,id(200+i),'Synthetic test order','',JSON.stringify(lines)];
    await rejected(submitSql,args,e=>e.code==='42501');
    await asUser(w.user,'service_role');
    const forged=structuredClone(lines); forged[0].unitPriceCents=1;
    await rejected(submitSql,[...args.slice(0,6),JSON.stringify(forged)],/QUOTE_CHANGED/);
    await rejected(submitSql,[w.user,workspaces[(i+1)%3].company,...args.slice(2)],e=>e.code==='42501');
    equal(await scalar('select count(*)::int as result from catalog_orders where owner_id=$1',[w.user]),0);
    const submitted=await scalar(submitSql,args);equal(submitted.reused,false);
    const repeated=await scalar(submitSql,args);equal(repeated.id,submitted.id);equal(repeated.reused,true);
    await asUser(w.user);
    const orders=(await db.query('select id,company_id,client_id,status,known_subtotal_cents,total_cents,items from catalog_orders')).rows;
    equal(orders.length,1); equal(orders[0].company_id,w.company);equal(orders[0].client_id,w.client);
    equal(orders[0].status,'pending_review');equal(Number(orders[0].total_cents),62500);equal(orders[0].items.length,6);
    equal((await scalar('select public.load_catalog_cart() as result')).items,[]);
    await rejected(`update catalog_orders set status='approved' where id=$1`,[submitted.id],e=>e.code==='42501');
    equal((await db.query('select id from company_credit_commitments')).rows,[]);
    equal((await db.query('select id from company_invoices')).rows,[]);
  }
  await asUser(viewer);
  equal(await scalar('select public.can_access_infomedia() as result'),false);
  await rejected('insert into media_plans(owner_id,company_id) values($1,$2)',[viewer,workspaces[0].company],e=>e.code==='42501');
  await asUser(viewer,'service_role');
  await rejected(submitSql,[viewer,workspaces[0].company,0,id(300),'Viewer attempt','','[]'],e=>e.code==='42501');
  await asUser(inactive);
  equal(await scalar('select public.can_use_media_catalog() as result'),false);
  await rejected('select public.save_catalog_cart(0,$1::jsonb)',['[{"productKey":"radio:synthetic","quantity":1}]'],e=>e.code==='42501');
  await asUser(inactive,'service_role');
  await rejected(submitSql,[inactive,workspaces[0].company,0,id(301),'Inactive attempt','','[]'],e=>e.code==='42501');
  await db.exec('reset role');
  return checks;
}
