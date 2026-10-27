import { randomBytes } from 'node:crypto';
const origin='https://line-rangers-guildwar-share-api.n-yu1791.chatgpt.site';
const key=randomBytes(32).toString('hex');
const headers={'x-board-key':key,'content-type':'application/json',origin:'https://line-rangers-fan.github.io'};
async function request(path,method='GET',body) {const response=await fetch(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});let payload;try{payload=await response.json()}catch{payload={}};return {status:response.status,payload};}
const gid='62848e3ce5804aa985513a7922ff87b2',uid='test-member',day='2026-10-28',week='2026-10-26';
const body={gid,week,members:[{uid,userName:'Test Fixture',level:1,pvpLeaguePhase:''}],entries:[]};
const a=await request('/api/boards','POST',body);console.log('create status',a.status);if(a.status>=300) {console.log('create error',JSON.stringify(a.payload));process.exit(1)}
const b=await request('/api/boards/check','PUT',{uid,day,slot:1,checked:false});console.log('false write status',b.status,'value',JSON.stringify(b.payload.states?.[uid]?.[day]));
const c=await request('/api/boards?week='+week);console.log('false read status',c.status,'value',JSON.stringify(c.payload.states?.[uid]?.[day]));
const d=await request('/api/boards/check','PUT',{uid,day,slot:1,checked:true});console.log('true write status',d.status);
const e=await request('/api/boards','POST',body);console.log('duplicate create status',e.status);
const f=await request('/api/boards?week='+week);console.log('after duplicate status',f.status,'value',JSON.stringify(f.payload.states?.[uid]?.[day]));

const started=Date.now();
try {
 const catResponse=await fetch('https://line-rangers-fan.github.io/line-rangers-guildwar/data/rosters.json',{signal:AbortSignal.timeout(30000)});
 const catalog=await catResponse.json();
 const ids=Object.entries(catalog.guilds||{}).filter(([gid,v])=>v.rank<=200).slice(0,4).map(([gid])=>gid);
 console.log('catalog status',catResponse.status,'guild count',Object.keys(catalog.guilds||{}).length,'probing',ids.length);
 const times=await Promise.all(ids.map(async (id)=>{
   const t=Date.now();try {const r=await fetch('https://rangers-api-3mfw.onrender.com/api/guild-member-info/'+id+'/members',{signal:AbortSignal.timeout(15000)});const j=await r.json();return {status:r.status,seconds:Math.round((Date.now()-t)/1000),count:(Array.isArray(j)?j:j.members||[]).length};}catch(e){return {error:e.name,seconds:Math.round((Date.now()-t)/1000)}}}));
 console.log('pvp sample',JSON.stringify(times),'elapsed',Math.round((Date.now()-started)/1000));
} catch(e) { console.log('catalog sample error',e.name,e.message); }
