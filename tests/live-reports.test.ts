import test from 'node:test';
import assert from 'node:assert/strict';
import {lookerEmbedUrl,lookerViewUrl,validLiveReport,resolveLiveReportSelection,liveReportHref,reportPeriodLabel,type LiveReport} from '../lib/live-reports';
const report:LiveReport={id:'11111111-1111-4111-8111-111111111111',client_key:'demo',client_name:'Demo',client_logo:'/partners/demo/demo-logo.png',channel_key:'programmatic',channel_name:'Programmatic',period:'2026-11-01',title:'Campaña de ejemplo',embed_url:'https://datastudio.google.com/embed/reporting/22222222-2222-4222-8222-222222222222/page/Example'};
test('Only exact provider-generated HTTPS report URLs may enter an iframe',()=>{
 assert.equal(lookerEmbedUrl(report.embed_url),report.embed_url);
 assert.equal(lookerEmbedUrl(report.embed_url.replace('.com/','.com:/')),report.embed_url);
 assert.equal(lookerEmbedUrl(report.embed_url.replace('datastudio','lookerstudio')),report.embed_url.replace('datastudio','lookerstudio'));
 for(const url of [report.embed_url.replace('https:','http:'),report.embed_url.replace('google.com','google.com.evil.test'),report.embed_url.replace('https://','https://user:password@'),report.embed_url+'?token=secret',report.embed_url+'#x',report.embed_url.replace('/embed/','/'),report.embed_url.replace('/page/Example','/page/%2F'),report.embed_url.replace('.com/','.com:8443/'),'javascript:alert(1)','https://evil.test']) assert.equal(lookerEmbedUrl(url),null,url);
 assert.equal(lookerViewUrl(report.embed_url),report.embed_url.replace('/embed/','/'));
});
test('Private report payloads reject malformed identifiers, logos and periods',()=>{
 assert.ok(validLiveReport(report));
 for(const change of [{period:'2026-13-01'},{period:'2026-11-14'},{client_logo:'https://remote.test/logo.png'},{client_logo:'/partners/demo/../../secret.svg'},{channel_key:'../../admin'},{id:'not-a-uuid'},{title:''},{embed_url:'https://google.com'}]) assert.equal(validLiveReport({...report,...change}),false);
});
test('A URL must resolve within the authorized client, channel and report chain',()=>{
 const other={...report,id:'33333333-3333-4333-8333-333333333333',client_key:'other'};
 assert.equal(resolveLiveReportSelection([report],{}).invalid,false);
 assert.equal(resolveLiveReportSelection([report],{client:'demo',channel:'programmatic',report:report.id}).report?.id,report.id);
 for(const selection of [{client:'other'},{channel:'programmatic'},{report:report.id},{client:'demo',channel:'tv'},{client:'demo',channel:'programmatic',report:other.id}]) assert.equal(resolveLiveReportSelection([report],selection).invalid,true);
 assert.equal(resolveLiveReportSelection([report,other],{client:'demo',channel:'programmatic',report:other.id}).invalid,true);
 assert.equal(resolveLiveReportSelection([],{client:'demo'}).report,undefined);
});
test('Navigation preserves previews, escapes query strings and clears deeper selections',()=>{
 assert.equal(liveReportHref('/reportes',{client:'demo',channel:'programmatic'}),'/reportes?client=demo&channel=programmatic');
 assert.equal(liveReportHref('/reportes?client=demo&channel=programmatic&report=old',{}),'/reportes');
 assert.equal(liveReportHref('/consola/espacios/test?view=reports',{client:'demo',channel:'programmatic'}),'/consola/espacios/test?view=reports&liveClient=demo&liveChannel=programmatic');
 assert.equal(liveReportHref('/reportes',{client:'demo&report=bad'}),'/reportes?client=demo%26report%3Dbad');
 assert.equal(reportPeriodLabel('2026-11-01'),'Noviembre 2026');
});
