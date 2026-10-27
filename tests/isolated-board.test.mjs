import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../server/store.mjs';
import {createApp} from '../server/app.mjs';
import {boardKeyHash} from '../shared/isolated-board.mjs';
const members=[{uid:'u1',userName:'A',level:100,pvpLeaguePhase:''}];
const week='2026-10-21';
test('each capability isolates roster and checks, including from old guild endpoints', async()=>{
 const store=openStore(':memory:');
 store.putRoster('guild1',[{...members[0],userName:'legacy'}]);
 store.saveCheck({gid:'guild1',team:'ally',uid:'u1',day:week,slot:1,checked:true});
 const server=createApp({store,sources:{}}).listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
 const call=(path,key,method='GET',body)=>fetch(base+path,{method,headers:{'x-board-key':key,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try {
  for(const key of [a,b]) { const r=await call('/api/boards',key,'POST',{gid:'guild1',members,week,entries:[]}); assert.equal(r.status,201); }
  assert.equal((await call('/api/boards',a,'POST',{gid:'guild1',members,week,entries:[]})).status,409);
  assert.equal((await call('/api/boards?week='+week,c)).status,404);
  assert.equal((await call('/api/boards?week='+week,'bad')).status,404);
  assert.equal((await call('/api/boards/check',a,'PUT',{uid:'u1',day:week,slot:2,checked:true})).status,200);
  assert.equal((await call('/api/boards/roster',a,'PUT',{members:[{...members[0],userName:'private A'}]})).status,200);
  const aa=await (await call('/api/boards?week='+week,a)).json(); const bb=await (await call('/api/boards?week='+week,b)).json();
  assert.equal(aa.members[0].userName,'private A'); assert.equal(aa.states.u1[week][2],true);
  assert.equal(bb.members[0].userName,'A'); assert.deepEqual(bb.states,{});
  assert.equal(store.getRoster('guild1').data[0].userName,'legacy');
  const hashed=await boardKeyHash(a);
  assert.equal((await fetch(base+`/api/guilds/${hashed}/checks?week=${week}`)).status,400);
  assert.equal((await call('/api/boards/check',b,'PUT',{uid:'invalid',day:week,slot:1,checked:true})).status,400);
 } finally {await new Promise(r=>server.close(r)); store.close();}
});
