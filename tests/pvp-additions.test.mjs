import test from 'node:test';
import assert from 'node:assert/strict';
import { missingPvpNames, selectPvpAdditions, readPvpAdditions, savePvpAdditions } from '../src/pvp-additions.mjs';
const roster=[{userName:'既存'},{userName:'新規'}], weekly=[{userName:'既存',pvpLeaguePhase:'GOLD_1'}];
test('only newly absent names are selected; existing weekly ranks never change',()=>{
 const live=[{userName:'既存',pvpLeaguePhase:'MASTER_1'},{userName:'新規',pvpLeaguePhase:'DIAMOND_1'}];
 assert.deepEqual(missingPvpNames(roster,weekly),['新規']);
 const result=selectPvpAdditions(roster,weekly,[],live);
 assert.deepEqual(result,[{userName:'新規',pvpLeaguePhase:'DIAMOND_1'}]);
 assert.equal(weekly[0].pvpLeaguePhase,'GOLD_1');
 assert.deepEqual(missingPvpNames(roster,weekly,result),[]);
});
test('ambiguous and unknown ranks never get assigned',()=>{
 assert.deepEqual(selectPvpAdditions([...roster,{userName:'新規'}],weekly,[],[{userName:'新規',pvpLeaguePhase:'DIAMOND_1'}]),[]);
 assert.deepEqual(selectPvpAdditions(roster,weekly,[],[{userName:'新規',pvpLeaguePhase:'DIAMOND_1'},{userName:'新規',pvpLeaguePhase:'GOLD_1'}]),[]);
 assert.deepEqual(selectPvpAdditions(roster,weekly,[],[{userName:'新規',pvpLeaguePhase:''}]),[]);
});
test('supplemental cache is scoped to guild and weekly snapshot',()=>{
 const values=new Map(), storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const rows=[{userName:'新規',pvpLeaguePhase:'DIAMOND_1'}];
 savePvpAdditions(storage,'one','2026-10-27T12:49:48Z','2026-10-28T09:00:00Z',rows);
 assert.deepEqual(readPvpAdditions(storage,'one','2026-10-27T12:49:48Z'),rows);
 assert.deepEqual(readPvpAdditions(storage,'one','2026-10-31T00:00:00Z'),[]);
 assert.deepEqual(readPvpAdditions(storage,'two','2026-10-27T12:49:48Z'),[]);
});

test('200 guilds keep additions isolated, including guilds without a weekly snapshot',()=>{
 const map=new Map(), storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 for(let i=0;i<200;i++) {
  const gid=`guild-${i}`; const weeklyAt=i%2 ? 'no-weekly-snapshot' : '2026-10-27T12:49:48Z';
  const roster=[{userName:`既存${i}`},{userName:`移籍${i}`}];
  const weekly=i%2 ? [] : [{userName:`既存${i}`,pvpLeaguePhase:'GOLD_1'}];
  const live=[{userName:`既存${i}`,pvpLeaguePhase:'MASTER_1'},{userName:`移籍${i}`,pvpLeaguePhase:'DIAMOND_1'}];
  const selected=selectPvpAdditions(roster,weekly,[],live);
  assert.equal(selected.length,i%2 ? 2:1);
  savePvpAdditions(storage,gid,weeklyAt,'2026-10-28T09:00:00Z',selected);
 }
 for(let i=0;i<200;i++) {
  const rows=readPvpAdditions(storage,`guild-${i}`,i%2 ? 'no-weekly-snapshot':'2026-10-27T12:49:48Z');
  assert.ok(rows.some(m=>m.userName===`移籍${i}`));
  assert.ok(rows.every(m=>m.userName.endsWith(String(i))));
 }
});
