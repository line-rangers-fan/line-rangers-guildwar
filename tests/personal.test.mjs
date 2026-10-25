import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryGuilds,loadPersonal,PREFERENCES_KEY,memberComparator} from '../shared/personal.mjs';
import {openStore} from '../server/store.mjs';
import {createApp} from '../server/app.mjs';
const allGuilds=Array.from({length:510},(_,i)=>({gid:`g-${i+1}`,name:`ギルド${i+1}`,lastGuildWarRank:i+1,nationalFlag:'JP'}));
test('directory excludes synthetic duplicate guilds and caps ranked candidates at 200',()=>{
 const result=directoryGuilds([...allGuilds,{...allGuilds[0]}, {gid:'local-fake',name:'ギルド1',lastGuildWarRank:1}]);
 assert.equal(result.length,200);assert.equal(result[199].lastGuildWarRank,200);assert.equal(new Set(result.map(g=>g.gid)).size,200);
});
test('personal lists survive serialization, stay isolated, and handle malformed storage',()=>{
 const data={guilds:[allGuilds[0],allGuilds[0]],selection:{ally:'g-1',enemy:'g-2'},team:'enemy',sort:{key:'level',dir:-1}};
 const a=loadPersonal({getItem:k=>k===PREFERENCES_KEY?JSON.stringify(data):null});const b=loadPersonal({getItem:()=>null});
 assert.equal(a.guilds.length,1);assert.equal(a.selection.ally,'g-1');assert.equal(a.team,'ally');assert.deepEqual(a.sort,data.sort);assert.equal(b.guilds.length,0);
 assert.equal(loadPersonal({getItem:()=>'{bad'}).guilds.length,0);
 assert.equal(loadPersonal({getItem:()=>{throw Error('disabled')}}).selection.ally,'');
 const legacy=loadPersonal({getItem:k=>k==='guildwar-selection'?'{"ally":"g-1","enemy":"local-fake"}':null});assert.equal(legacy.selection.ally,'g-1');assert.equal(legacy.selection.enemy,'');
});
test('name and level sorting retain distinct IDs for identical names',()=>{
 const rows=[{uid:'b',userName:'同名',level:100},{uid:'c',userName:'あ',level:200},{uid:'a',userName:'同名',level:500}];
 assert.deepEqual([...rows].sort(memberComparator({key:'level',dir:-1})).map(m=>m.uid),['a','c','b']);
 assert.deepEqual([...rows].sort(memberComparator({key:'level',dir:1})).map(m=>m.uid),['b','c','a']);
 assert.deepEqual([...rows].sort(memberComparator({key:'name',dir:1})).map(m=>m.uid),['c','a','b']);
 assert.equal(rows[0].uid,'b');
});
test('limited directory and stored-roster check saves work without member source calls',async()=>{
 const store=openStore(':memory:');let calls=0;store.putRoster('g-1',[{uid:'u-1',userName:'同名',level:100,pvpLeaguePhase:''}],'rangerbook');
 const server=createApp({store,sources:{guilds:async()=>({data:allGuilds}),members:async()=>{calls++;throw Error('slow upstream must not be used');}}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{const list=await(await fetch(base+'/api/guilds?limit=500')).json();assert.equal(list.guilds.length,200);
 const response=await fetch(base+'/api/guilds/g-1/checks',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({uid:'u-1',team:'ally',day:'2026-10-23',slot:2,checked:true})});assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.states['u-1']['2026-10-23'][1],true);assert.equal(calls,0);
 }finally{await new Promise(r=>server.close(r));store.close();}
});

test('ordinary links always start unselected; only shared links can select a guild', async () => {
  const {initialChoice}=await import('../shared/personal.mjs');
  for(const query of ['', 'gid=colors', 'gid=colors&day=2026-10-21', 'share=0&gid=colors', 'share=1&gid=bad%2Fid']) {
    assert.deepEqual(initialChoice(new URLSearchParams(query)),{ally:'',enemy:''});
  }
  assert.deepEqual(initialChoice(new URLSearchParams('share=1&gid=colors')),{ally:'colors',enemy:''});
});
test('personal reset clears only this app personal records', async () => {
  const {resetPersonal,PREFERENCES_KEY}=await import('../shared/personal.mjs');
  const data=new Map([[PREFERENCES_KEY,'{}'],['guildwar-selection','{}'],['guildwar-private-checks:colors','{}'],['unrelated','keep']]);
  resetPersonal({get length(){return data.size},key:i=>[...data.keys()][i],removeItem:k=>data.delete(k)});
  assert.deepEqual([...data],[['unrelated','keep']]);
});
