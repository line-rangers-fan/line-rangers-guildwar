import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotGuildIds, updateSnapshots, validatePvpSnapshot } from '../shared/pvp-weekly.mjs';
import { cachedPvp, loadPvpSnapshot, pvpSnapshotIsStale } from '../src/pvp-snapshot.mjs';

const fixture = { version:1, gid:'one', fetchedAt:'2026-10-24T00:10:00Z', members:[{userName:'A', pvpLeaguePhase:'MASTER_1'}] };
test('weekly refresh keeps older guild snapshots when some sources fail', async () => {
  const saved = new Map([['one',fixture], ['two',{...fixture,gid:'two'}]]);
  const result = await updateSnapshots({ ids:['one','two'], concurrency:1, now:()=>new Date('2026-10-31T00:00:00Z'),
    fetchMembers: async gid => { if(gid==='two') throw new Error('offline'); return [{userName:'A',pvpLeaguePhase:'GOLD_1'}]; },
    save: async (gid,data) => saved.set(gid,data),
  });
  assert.deepEqual(result, {successes:1,failures:1,skipped:0});
  assert.equal(saved.get('one').members[0].pvpLeaguePhase,'GOLD_1');
  assert.equal(saved.get('two').fetchedAt, fixture.fetchedAt);
  await assert.rejects(updateSnapshots({ids:['one'],fetchMembers:async()=>[],save:async()=>{throw Error('must not save')}}), /1件も取得できません/);
});
test('catalog and snapshots reject invalid identities or empty results', () => {
  assert.deepEqual(snapshotGuildIds({guilds:{one:{rank:3},two:{rank:1},bad:{rank:201},'../x':{rank:2}}}),['two','one']);
  assert.throws(()=>validatePvpSnapshot({...fixture,gid:'other'},'one'));
  assert.throws(()=>validatePvpSnapshot({...fixture,members:[]},'one'));
});
test('client uses saved data on failure and refuses older CDN data', async () => {
  const data = new Map([['guildwar-pvp-snapshot:one', JSON.stringify(fixture)]]);
  const storage = {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  assert.equal(cachedPvp(storage,'one').fetchedAt,fixture.fetchedAt);
  const older = {...fixture,fetchedAt:'2026-10-17T00:00:00Z'};
  let result = await loadPvpSnapshot({gid:'one',url:'x',storage,fetcher:async()=>({ok:true,json:async()=>older})});
  assert.equal(result.snapshot.fetchedAt,fixture.fetchedAt);
  result = await loadPvpSnapshot({gid:'one',url:'x',storage,fetcher:async()=>{throw Error('offline')}});
  assert.equal(result.snapshot.fetchedAt,fixture.fetchedAt); assert.equal(result.offline,true);
});
test('staleness respects Saturday in Japan and allows time for update', () => {
  assert.equal(pvpSnapshotIsStale('2026-10-24T00:10:00Z',new Date('2026-10-30T22:00:00Z')),false);
  assert.equal(pvpSnapshotIsStale('2026-10-24T00:10:00Z',new Date('2026-10-31T00:00:00Z')),true);
  assert.equal(pvpSnapshotIsStale('2026-10-30T20:05:00Z',new Date('2026-10-31T00:00:00Z')),false);
});
