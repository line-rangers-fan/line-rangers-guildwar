import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGuildDirectory } from '../src/public-directory.mjs';

const catalog = { generatedAt:'2026-10-25T21:57:03Z', guilds: {
  absent: {name:'BhinnekaID', rank:128, reportedMemberCount:10, members:[]},
  obsolete: {name:'古いギルド', rank:1, members:[]},
} };
const live = {guilds:[{gid:'live',name:'現行ギルド',lastGuildWarRank:1}],stale:false};
const fetchCatalog = async () => Response.json(catalog);

test('directory fills a missing rank even when its roster is empty, preserving live rank ownership', async () => {
  const result = await loadGuildDirectory({api:async()=>live,fetchCatalog});
  assert.deepEqual(result.guilds.map(g=>g.gid), ['live','absent']);
  assert.equal(result.guilds[1].lastGuildWarRank,128);
  assert.equal(result.guilds[1].currentMemberCount,10);
  assert.equal(result.catalogSupplemented,1);
  assert.equal(result.stale,false);
  assert.equal(live.guilds.length,1);
});

test('API outage uses the public catalog with an explicit stale notice', async () => {
  const result = await loadGuildDirectory({api:async()=>{throw Error('offline');},fetchCatalog});
  assert.equal(result.guilds.length,2);
  assert.equal(result.stale,true);
  assert.ok(result.warning);
});

test('catalog outage preserves the live directory; combined outage retains the original API error', async () => {
  const fetchCatalog = async()=>{throw Error('catalog offline');};
  assert.deepEqual((await loadGuildDirectory({api:async()=>live,fetchCatalog})).guilds,live.guilds);
  const original = Error('API offline');
  await assert.rejects(loadGuildDirectory({api:async()=>{throw original;},fetchCatalog}),e=>e===original);
});

test('complete top-200 directory does not request the catalog', async () => {
  const guilds = Array.from({length:200},(_,i)=>({gid:`g${i}`,name:`G${i}`,lastGuildWarRank:i+1}));
  const result = await loadGuildDirectory({api:async()=>({guilds}),fetchCatalog:async()=>assert.fail('unnecessary catalog request')});
  assert.equal(result.guilds.length,200);
});

test('aborting the directory request never starts the catalog fallback', async () => {
  const controller = new AbortController();controller.abort();
  await assert.rejects(loadGuildDirectory({signal:controller.signal,api:async()=>{throw controller.signal.reason;},fetchCatalog:async()=>assert.fail('fallback after abort')}),{name:'AbortError'});
});
