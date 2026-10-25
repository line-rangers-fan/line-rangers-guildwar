import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogRoster, loadRosterWithFallback } from '../src/public-roster.mjs';
const members=[{uid:'rb-1',userName:'名前',level:500,pvpLeaguePhase:''}];
const catalog=()=>({guilds:{guild1:{name:'ギルド',rank:157,observedAt:new Date(Date.now()-8*3600000).toISOString(),members}}});
const missing={members:[],needsSetup:true};
test('fallback accepts old roster data without expiry but rejects lower-tier or duplicate IDs',()=>{
 const c=catalog(); assert.equal(catalogRoster(c,'guild1').members.length,1);
 c.guilds.guild1.observedAt=new Date(Date.now()-49*3600000).toISOString();assert.equal(catalogRoster(c,'guild1').members.length,1);
 c.guilds.guild1.observedAt=new Date().toISOString();c.guilds.guild1.rank=201;assert.equal(catalogRoster(c,'guild1'),null);
 c.guilds.guild1.rank=157;c.guilds.guild1.members=[...members,...members];assert.equal(catalogRoster(c,'guild1'),null);
});
test('missing roster is imported using existing API with stable IDs',async()=>{
 let writes=0; const result=await loadRosterWithFallback({gid:'guild1',catalogURL:'/catalog',fetchCatalog:async()=>Response.json(catalog()),api:async(path,options)=>{if(options?.method==='PUT'){writes++;assert.deepEqual(JSON.parse(options.body).members,members);return {members};}return missing;}});
 assert.equal(writes,1);assert.deepEqual(result.members,members);assert.ok(result.publicObservedAt);
});
test('preserves existing roster including one registered during catalog fetch',async()=>{
 let downloads=0;const existing={members:[{...members[0],userName:'編集済み'}]};
 const result=await loadRosterWithFallback({gid:'guild1',api:async()=>existing,fetchCatalog:async()=>{downloads++;}});assert.equal(result,existing);assert.equal(downloads,0);
 let reads=0;const raced=await loadRosterWithFallback({gid:'guild1',fetchCatalog:async()=>Response.json(catalog()),api:async(path,options)=>{assert.notEqual(options?.method,'PUT');return ++reads===1?missing:existing;}});assert.equal(raced,existing);
});
test('catalog failure leaves missing roster intact and never writes',async()=>{
 let reads=0;const result=await loadRosterWithFallback({gid:'guild1',api:async()=>{reads++;return missing;},fetchCatalog:async()=>{throw Error('offline');}});assert.equal(result,missing);assert.equal(reads,1);
});
test('zero-member source does not erase or save an empty roster',async()=>{
 const c=catalog();c.guilds.guild1.members=[];let writes=0;
 const result=await loadRosterWithFallback({gid:'guild1',fetchCatalog:async()=>Response.json(c),api:async(path,options)=>{if(options?.method==='PUT') writes++;return missing;}});
 assert.equal(writes,0);assert.equal(result.members.length,0);assert.ok(result.publicObservedAt);
});
