import { mkdir, writeFile } from 'node:fs/promises';
import { normalizeReferenceMembers } from '../shared/pvp.mjs';
const ids=['6c35405090b34adb91b4f1756f0c2c21','2a872d4e95f140f53f1af2f304784c56','b5cd37f613687f622d5c510ab611c54e'];
await mkdir('pvp-snapshot/pvp-cache',{recursive:true});
const outcome=await Promise.all(ids.map(async gid=>{
 try {
  const response=await fetch('https://rangers-api-3mfw.onrender.com/api/guild-member-info/'+gid+'/members',{signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw Error('HTTP '+response.status);
  const members=normalizeReferenceMembers(await response.json());
  if(!members.length) throw Error('empty');
  await writeFile('pvp-snapshot/pvp-cache/'+gid+'.json',JSON.stringify({version:1,gid,fetchedAt:new Date().toISOString(),members}));
  return 'ok';
 } catch(e) {console.log('retry',gid,e.message);return 'failed';}
}));
console.log('retry success',outcome.filter(x=>x==='ok').length,'of',ids.length);
