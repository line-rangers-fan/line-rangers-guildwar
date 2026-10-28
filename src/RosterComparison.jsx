import React, { useEffect, useState } from "react";
import { apiURL } from "./runtime.mjs";
import { catalogRoster } from "./public-roster.mjs";
import { rosterCandidates } from "../shared/roster-additions.mjs";
export function RosterComparison({gid, roster, token, onSaved, refresh}) {
 const [source,setSource]=useState(null), [error,setError]=useState(''), [selected,setSelected]=useState([]), [saving,setSaving]=useState(false);
 useEffect(()=>{ const c=new AbortController(); setSource(null); setSelected([]); setError('');
  fetch(apiURL(`/api/guilds/${encodeURIComponent(gid)}/roster-catalog`),{signal:c.signal}).then(async r=>{if(!r.ok) throw Error('公開名簿を取得できません。'); const row=catalogRoster(await r.json(),gid); if(!row) throw Error('公開名簿の対象外、または形式を確認できません。'); setSource(row);}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}); return ()=>c.abort();
 },[gid,refresh]);
 if(!roster) return null;
 const {additions,ambiguous}=source?rosterCandidates(roster.members,source.members):{additions:[],ambiguous:[]};
 async function add() { setSaving(true); setError(''); try {
  const response=await fetch(apiURL(`/api/guilds/${encodeURIComponent(gid)}/roster-additions`),{method:'POST',headers:{'Content-Type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({updatedAt:roster.updatedAt,members:additions.filter(m=>selected.includes(m.userName)).map(({userName,level})=>({userName,level}))})});
  const data=await response.json(); if(!response.ok) throw Error(data.error); setSelected([]); onSaved(data);
 } catch(e){setError(e.message)} finally {setSaving(false)} }
 return <section className="roster-comparison" aria-label="公開名簿との照合">
  <p className="personal-note">名簿: {roster.mode === 'manual' ? '手動管理' : roster.mode || '未登録'} · 保存 {roster.updatedAt ? new Date(roster.updatedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}) : '不明'} {source && <>· 公開名簿 {source.observedAt ? new Date(source.observedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}) : '不明'} JST（{source.members.length}人）</>}</p>
  {error && <p className="alert warning" role="status">{error}</p>}
  {source?.observedAt && Date.now()-Date.parse(source.observedAt)>48*3600000 && <p className="alert warning">公開名簿の生成から48時間以上経過しています。新加入者がまだ掲載されていない可能性があります。</p>}
  {source?.incomplete && <p className="alert warning">配信名簿が公称人数と一致しません。最新の全員が掲載されているとは限りません。</p>}
  {ambiguous.length>0 && <p className="alert warning">同名のため確認が必要: {ambiguous.join('、')}。「名簿を管理」で確認してください。</p>}
  {additions.length>0 && <div className="alert warning"><strong>公開名簿にいる未登録候補 {additions.length}人</strong><p>新加入か改名か確認してください。改名は「名簿を管理」で既存の名前を編集すると記録を引き継げます。</p>{additions.map(m=><label key={m.userName} style={{display:'block'}}><input type="checkbox" checked={selected.includes(m.userName)} onChange={e=>setSelected(v=>e.target.checked?[...v,m.userName]:v.filter(n=>n!==m.userName))}/> {m.userName}</label>)}<button className="button" disabled={!selected.length||saving||!roster.updatedAt} onClick={add}>選択した新加入者を追加</button></div>}
 </section>;
}
