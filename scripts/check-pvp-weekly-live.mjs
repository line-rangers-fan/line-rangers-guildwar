import assert from 'node:assert/strict';
import { refreshWeeklySnapshots } from '../shared/pvp-weekly.mjs';
const gid='62848e3ce5804aa985513a7922ff87b2';
const calls=[]; const written=new Map();
const summary=await refreshWeeklySnapshots({
 ids:[gid],concurrency:1,
 fetchMembers:async (id,attempt) => {
   calls.push(attempt);
   if(attempt===1) throw new Error('simulated initial timeout');
   const response=await fetch('https://rangers-api-3mfw.onrender.com/api/guild-member-info/'+id+'/members',{signal:AbortSignal.timeout(45000)});
   if(!response.ok) throw Error('HTTP '+response.status);
   return response.json();
 },
 save:async (id,data) => written.set(id,data),
});
assert.deepEqual(calls,[1,2]);assert.deepEqual(summary,{successes:1,failures:0,skipped:0});
assert.ok(written.get(gid).members.length > 0);
console.log('PASS simulated timeout recovered from real PvP source; members:',written.get(gid).members.length);
