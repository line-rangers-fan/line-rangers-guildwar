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
