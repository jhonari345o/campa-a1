import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { coverageDescription, coverageForBoundary, normalizeCoverage, normalizeCoverageBrief, restoreCoverage } from '../lib/geographic-coverage';
const pick = (key: string) => ({key});

test('a saved multi-territory brief restores the same complete administrative areas', () => {
  const selection = normalizeCoverage([pick('province:guayas'),pick('city:quito:pichincha')]);
  assert.equal(selection.length,2);
  const form = new FormData();
  form.set('coverage', JSON.stringify(selection));
  form.set('geography',coverageDescription(selection));
  const generated = normalizeCoverageBrief(Object.fromEntries(form));
  const supabaseBrief = JSON.parse(JSON.stringify(generated));
  assert.deepEqual(restoreCoverage(supabaseBrief),selection);
  assert.equal(supabaseBrief.geography,'Guayas (provincia) · Quito, Pichincha (cantón)');
});
test('a province absorbs its cantons without removing other provinces or cantons', () => {
  assert.deepEqual(normalizeCoverage([pick('city:guayaquil:guayas'),pick('province:guayas'),pick('city:quito:pichincha'),pick('province:guayas')]).map(x=>x.key),['province:guayas','city:quito:pichincha']);
});
test('national coverage replaces local selections; clearing selection remains empty', () => {
  assert.deepEqual(normalizeCoverage([pick('province:guayas'),pick('country:ecuador')]).map(x=>x.key),['country:ecuador']);
  assert.deepEqual(normalizeCoverageBrief({coverage:'[]',geography:''}),{coverage:[],geography:''});
});
test('legacy radius plans are preserved, never expanded to a complete canton implicitly', () => {
  const geography='Guayaquil, Guayas · 25 km alrededor';
  assert.deepEqual(normalizeCoverageBrief({geography}),{coverage:[],geography});
  assert.deepEqual(restoreCoverage({geography:'Todo Ecuador'}).map(x=>x.key),['country:ecuador']);
});
test('unrecognized and malformed selections are ignored and labels come from the canonical directory', () => {
  assert.deepEqual(normalizeCoverage('{bad json'),[]);
  assert.deepEqual(normalizeCoverage([pick('province:inventada')]),[]);
  assert.equal(normalizeCoverage([{key:'province:guayas',label:'Incorrecto',kind:'country'}])[0]?.label,'Guayas');
});
test('every deployed polygon has a unique directory match with province context for cantons', () => {
  const keys = new Set();
  for (const type of ['provinces','cantons']) {
    const data = JSON.parse(fs.readFileSync(new URL(`../public/data/ecuador-${type}.geojson`,import.meta.url),'utf8'));
    for(const feature of data.features) {
      const entry=coverageForBoundary(feature.properties.shapeID);
      assert.ok(entry,feature.properties.shapeName);
      assert.ok(!keys.has(entry.key),`duplicate ${entry.key}`);
      keys.add(entry.key);
      if(type==='cantons')assert.ok(entry.context);
    }
  }
});
