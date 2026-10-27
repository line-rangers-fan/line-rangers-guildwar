import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotGuildIds, updateSnapshots, refreshWeeklySnapshots, validatePvpSnapshot } from '../shared/pvp-weekly.mjs';
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

test('weekly retry fetches only failures and keeps old data if retry fails', async () => {
  const calls = [];
  const saved = new Map([['three', {...fixture, gid:'three'}]]);
  const summary = await refreshWeeklySnapshots({ ids:['one','two','three'], concurrency:1,
    fetchMembers:async (gid, attempt) => {
      calls.push([gid, attempt]);
      if (gid === 'three' || gid === 'two' && attempt === 1) throw new Error('temporary outage');
      return [{userName:'A',pvpLeaguePhase:'GOLD_1'}];
    },
    save:async (gid, snapshot) => saved.set(gid,snapshot),
  });
  assert.deepEqual(summary,{successes:2,failures:1,skipped:0});
  assert.deepEqual(calls,[['one',1],['two',1],['three',1],['two',2],['three',2]]);
  assert.equal(saved.get('three').fetchedAt,fixture.fetchedAt);
});

test('weekly retry resumes skipped guilds when the source recovers', async () => {
  const calls=[];
  const summary=await refreshWeeklySnapshots({ids:['one','two','three'],concurrency:1,maxFailures:1,
    fetchMembers:async (gid,attempt) => { calls.push([gid,attempt]); if(attempt===1) throw Error('offline'); return [{userName:'A',pvpLeaguePhase:'GOLD_1'}]; },
    save:async()=>{},
  });
  assert.deepEqual(summary,{successes:3,failures:0,skipped:0});
  assert.deepEqual(calls,[['one',1],['one',2],['two',2],['three',2]]);
});
