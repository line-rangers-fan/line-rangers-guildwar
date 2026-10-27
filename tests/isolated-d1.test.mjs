import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createD1Store} from '../worker/store.mjs';
import {boardAction} from '../shared/isolated-board.mjs';

test('D1 transaction creates isolated boards and persists checked slots',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE isolated_boards(id TEXT PRIMARY KEY,gid TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL); CREATE TABLE checks(gid TEXT NOT NULL,team TEXT NOT NULL,uid TEXT NOT NULL,day TEXT NOT NULL,slot INTEGER NOT NULL,checked INTEGER NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(gid,team,uid,day,slot));`);
 const adapter={prepare(sql){return {bind(...args){return {first:async()=>db.prepare(sql).get(...args)||null,run:async()=>db.prepare(sql).run(...args),all:async()=>({results:db.prepare(sql).all(...args)}),sql,args};}}},async batch(queries){db.exec('BEGIN');try{for(const q of queries) db.prepare(q.sql).run(...q.args);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}};
 const store=createD1Store(adapter), key='d'.repeat(64), week='2026-10-21',members=[{uid:'u',userName:'A',level:1,pvpLeaguePhase:''}];
 try {
  assert.equal((await boardAction(store,key,'POST','create',{gid:'guild1',members,week,entries:[{uid:'u',day:week,slot:2}]})).status,201);
  assert.equal((await boardAction(store,key,'POST','create',{gid:'guild1',members,week,entries:[]})).status,409);
  const result=await boardAction(store,key,'GET','board',{week});
  assert.equal(result.body.states.u[week][1],true);assert.equal(result.body.states.u[week][2],true);
  assert.equal((await boardAction(store,'e'.repeat(64),'GET','board',{week})).status,404);
 } finally {db.close();}
});
