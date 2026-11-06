import test from 'node:test';
import assert from 'node:assert/strict';
import { compatibleRadio, compatibleTv, radioCompatibility, sameMarket, tvValidity, validateBroadcastSelections, type BroadcastSource, type BroadcastCatalog } from '../lib/broadcast-catalog';
const source: BroadcastSource={id:'tv',kind:'tv',label:'Canal de prueba',provider:'Test',periodStart:'2026-11-01',periodEnd:'2026-11-30',market:'Quito',marketKeys:['quito'],target:'Tarifa general',ageMin:null,ageMax:null,sex:'unspecified',nse:'unspecified',frequency:'',daypart:'',annualContract:false,conditions:'Base 30 s',spotSeconds:30,minimumSeconds:20,taxIncluded:false};
const study: BroadcastSource={...source,id:'radio',kind:'radio',periodStart:'2026-08-01',periodEnd:'2026-08-31',ageMin:18,ageMax:99,sex:'all',nse:'all',frequency:'AM / FM',daypart:'Lunes a viernes 06:00–20:00',target:'Personas 18–99'};
const brief={geography:'Quito',startDate:'2026-11-01',endDate:'2026-11-30',ageRange:'Personas 18+',sex:'Todas las personas',socioeconomic:'Todos los NSE',audienceType:'B2C'};
const catalog:BroadcastCatalog={sources:[source,study],tv:[{id:'offer',sourceId:'tv',day:'Lunes',title:'Programa',schedule:'10:00',priceUsd:150,target:'',note:''}],radio:[{id:'station',sourceId:'radio',name:'Emisora',genre:'Variedades',rating:1,share:2,audience:300,rank:1}]};
test('TV exige toda la vigencia e interpreta fechas reales',()=>{
 assert.equal(tvValidity(source,brief.startDate,brief.endDate),true);
 for(const [a,b] of [['2026-10-31','2026-11-01'],['2026-11-01','2026-12-01'],['2026-11-10','2026-11-09'],['2026-02-30','2026-11-02'],['','']])assert.equal(tvValidity(source,a,b),false);
});
test('no extrapola un consolidado a una ciudad ni una plaza desconocida a nacional',()=>{
 const consolidated={...source,marketKeys:['guayaquil','quito']};
 assert.equal(sameMarket(consolidated,brief),false);
 assert.equal(sameMarket(consolidated,{...brief,geography:'Quito · Guayaquil'}),true);
 assert.equal(sameMarket({...source,marketKeys:[]},{...brief,geography:'Todo Ecuador'}),false);
 assert.equal(sameMarket({...source,marketKeys:['cuenca']},{...brief,coverage:[{kind:'province',key:'azuay',label:'Azuay'}],geography:'Azuay'}),false);
});
test('radio conserva edad, sexo, NSE, territorio y temporalidad',()=>{
 assert.equal(radioCompatibility(study,brief),null);
 for (const patch of [{ageRange:'35+'},{sex:'Mujeres'},{socioeconomic:'ABC1'},{geography:'Nacional'},{audienceType:'B2B'},{startDate:'2026-08-01'}])assert.notEqual(radioCompatibility(study,{...brief,...patch}),null);
 assert.notEqual(radioCompatibility({...study,nse:'AB'},brief),null);
 assert.notEqual(radioCompatibility({...study,sex:'unspecified'},brief),null);
});
test('contrato anual no se presupone y se ignoran ediciones fuera de fecha',()=>{
 assert.equal(compatibleTv(catalog,brief).length,1);
 assert.equal(compatibleTv({...catalog,sources:[{...source,annualContract:true}]},brief).length,0);
 assert.equal(compatibleTv(catalog,{...brief,endDate:'2026-12-01'}).length,0);
});
test('no combina estudios o públicos en un ranking',()=>{
 const s2={...study,id:'r2',periodEnd:'2026-09-30',frequency:'FM'};
 const s3={...study,id:'r3',sex:'female'};
 const rows=compatibleRadio({...catalog,sources:[study,s2,s3],radio:[...catalog.radio,{...catalog.radio[0],id:'new',sourceId:'r2',rating:2},{...catalog.radio[0],id:'female',sourceId:'r3',rating:99}]},brief);
 assert.deepEqual(rows.map(x=>x.row.id),['new']);
});
test('guardar resuelve precios desde la fuente y rechaza picks alterados o incompatibles',()=>{
 const pick={id:'offer',sourceId:'tv',unitPrice:1,title:'Alterado',quantity:2};
 const result=validateBroadcastSelections(catalog,brief,{tv:[pick]});
 assert.equal(result.ok,true);
 if(result.ok)assert.deepEqual((result.selections.tv as Array<{unitPrice:number;title:string}>).map(x=>[x.unitPrice,x.title]),[[150,'Programa']]);
 assert.equal(validateBroadcastSelections(catalog,{...brief,endDate:'2026-12-01'},{tv:[pick]}).ok,false);
 assert.equal(validateBroadcastSelections(catalog,brief,{tv:[{...pick,id:'fake'}]}).ok,false);
 assert.equal(validateBroadcastSelections(catalog,brief,{tv:[{...pick,quantity:-1}]}).ok,false);
 assert.equal(validateBroadcastSelections(catalog,{...brief,sex:'Mujeres'},{radio:[{id:'station',sourceId:'radio',spotsPerDay:6,days:20}]}).ok,false);
 const unscoped=validateBroadcastSelections(catalog,{...brief,geography:'Guayaquil'},{tv:[pick]});
 assert.equal(unscoped.ok && (unscoped.selections.tv as Array<{unitPrice:null}>)[0].unitPrice,null);
});
