
const gid='62848e3ce5804aa985513a7922ff87b2';
for (const [label,url] of [
 ['existing-api','https://line-rangers-guildwar.eagerowl2.chatgpt.site/api/guilds/'+gid+'/pvp'],
 ['direct','https://rangers-api-3mfw.onrender.com/api/guild-member-info/'+gid+'/members']
]) {
 const t=Date.now();
 try { const r=await fetch(url,{signal:AbortSignal.timeout(20000)});const j=await r.json(); console.log(label,'status',r.status,'seconds',Math.round((Date.now()-t)/1000),'members',Array.isArray(j)?j.length:Array.isArray(j.members)?j.members.length:'none','fetchedAt',j.fetchedAt||null,'stale',j.stale||false); }
 catch(e) { console.log(label,'error',e.name,'seconds',Math.round((Date.now()-t)/1000)); }
}
