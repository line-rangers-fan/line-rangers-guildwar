import test from 'node:test';
import assert from 'node:assert/strict';
import { rosterCandidates, appendRoster } from '../shared/roster-additions.mjs';
import { openStore } from '../server/store.mjs';
const old=[{uid:'old-id',userName:'既存',level:100,pvpLeaguePhase:'GOLD'}];
test('only unique unmatched names are candidates; ambiguous names are reported',()=>{
 const result=rosterCandidates(old,[{userName:'既存',level:100},{userName:'新規',level:10},{userName:'同名',level:2},{userName:'同名',level:3}]);
 assert.deepEqual(result.additions.map(x=>x.userName),['新規']); assert.deepEqual(result.ambiguous,['同名']);
});
test('append retains all existing records and refuses duplicates and excess',()=>{
 const next=appendRoster(old,[{userName:'新規',level:10}],()=> 'new-id');
 assert.deepEqual(next[0],old[0]); assert.equal(next[1].uid,'new-id');
 assert.throws(()=>appendRoster(old,[{userName:'既存',level:10}]));
 assert.throws(()=>appendRoster(Array.from({length:50},(_,i)=>({...old[0],userName:String(i)})),[{userName:'新規',level:10}]));
});
test('compare-and-append rejects a concurrent edit and does not alter checks',()=>{
 const store=openStore(':memory:'); store.putRoster('guild1',old); const previous=store.getRoster('guild1');
 store.saveCheck({gid:'guild1',team:'ally',uid:'old-id',day:'2026-10-28',slot:1,checked:true});
 store.putRoster('guild1',[{...old[0],userName:'編集済み'}]);
 assert.equal(store.compareAndAppendRoster('guild1',previous,appendRoster(old,[{userName:'新規',level:10}],()=> 'new-id')),null);
 assert.equal(store.getRoster('guild1').data[0].userName,'編集済み');
 assert.equal(store.getChecks('guild1','ally','2026-10-28','2026-10-28')['old-id']['2026-10-28'][1],true);
});
