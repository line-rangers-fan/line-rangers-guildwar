import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyResults, resultAt, setResult, resultSummary, resultEntries } from '../shared/results.mjs';
import { readSharedResults, writeSharedResult, copySharedResults } from '../src/results-api.mjs';
const day='2026-10-28', week='2026-10-28';
const members=[{uid:'a',userName:'A',level:1,pvpLeaguePhase:''},{uid:'b',userName:'B',level:2,pvpLeaguePhase:''}];
const states={a:{[day]:{1:true,2:true}},b:{[day]:{1:true}}};
test('aggregate uses all attacks, preserves unknown old checks and reports zero denominator', () => {
  let r=setResult(emptyResults(),'a',day,1,'win');
  r=setResult(r,'a',day,2,'loss');
  assert.deepEqual(resultSummary(states,r,members,day),{attacks:3,wins:1,unknown:1,rate:1/3*100});
  assert.deepEqual(resultSummary({},r,members,day),{attacks:0,wins:0,unknown:0,rate:null});
  assert.deepEqual(resultEntries(states,r,members,[day],1),[{uid:'a',day,slot:1},{uid:'a',day,slot:2}]);
});
test('separate links and two attack slots retain win, loss and unknown after reload', async () => {
  const data=new Map();
  async function api(path,o) {
    const key=o.headers['x-board-key'], body=o.body?JSON.parse(o.body):null;
    if(path==='/api/boards' && o.method==='POST') {
      if(data.has(key)) throw Object.assign(new Error('exists'),{status:409});
      const states={};
      for(const e of body.entries){states[e.uid]??={};states[e.uid][e.day]??={};states[e.uid][e.day][e.slot]=true;}
      data.set(key,{gid:body.gid,states}); return {states};
    }
    if(path.startsWith('/api/boards?')) {
      if(!data.has(key)) throw Object.assign(new Error('missing'),{status:404});
      return structuredClone(data.get(key));
    }
    if(path==='/api/boards/roster') return {};
    if(path==='/api/boards/check') {
      const b=data.get(key), d=(b.states[body.uid]??={})[body.day]??={};
      d[body.slot]=body.checked;
      if(body.slot===2 && body.checked) d[1]=true;
      if(body.slot===1 && !body.checked) d[2]=false;
      return {states:structuredClone(b.states)};
    }
    throw Error('unexpected route');
  }
  const common={api,gid:'guild',week,members};
  const first={...common,boardKey:'first'}, second={...common,boardKey:'second'};
  await writeSharedResult({...first,uid:'a',day,slot:1,value:'win'});
  await writeSharedResult({...first,uid:'a',day,slot:2,value:'loss'});
  let loaded=await readSharedResults(first);
  assert.equal(resultAt(loaded,'a',day,1),'win');
  assert.equal(resultAt(loaded,'a',day,2),'loss');
  assert.equal(resultAt(await readSharedResults(second),'a',day,1),null);
  await copySharedResults({...second,dates:[day],states,results:loaded});
  const copy=await readSharedResults(second);
  assert.equal(resultAt(copy,'a',day,1),'win'); assert.equal(resultAt(copy,'a',day,2),'loss');
  await writeSharedResult({...first,uid:'a',day,slot:1,value:null});
  loaded=await readSharedResults(first);
  assert.equal(resultAt(loaded,'a',day,1),null);
  assert.equal(resultAt(await readSharedResults(second),'a',day,1),'win');
});
test('non-404 failures do not masquerade as unknown results', async () => {
  await assert.rejects(readSharedResults({gid:'g',boardKey:'k',week,api:async()=>{throw Object.assign(Error('offline'),{status:503})}}),/offline/);
});

test('private results persist together with checks and reset with the week', async () => {
  const { savePrivateBoard, loadPrivateBoard } = await import('../shared/boards.mjs');
  const rows = new Map(), storage = { getItem:k=>rows.get(k), setItem:(k,v)=>rows.set(k,v) };
  const outcomes = setResult(emptyResults(),'a',day,1,'loss');
  savePrivateBoard(storage,'guild',week,states,outcomes);
  const saved=loadPrivateBoard(storage,'guild',week);
  assert.equal(resultAt(saved.results,'a',day,1),'loss');
  assert.equal(saved.states.a[day][1],true);
  assert.equal(resultAt(loadPrivateBoard(storage,'guild','2026-11-04').results,'a',day,1),null);
});
