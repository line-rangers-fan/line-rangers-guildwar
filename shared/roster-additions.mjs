// Public rosters have names but no stable player IDs; never guess a rename.
export function rosterCandidates(current, publicMembers) {
  const counts = new Map();
  for (const m of publicMembers) counts.set(m.userName, (counts.get(m.userName) || 0) + 1);
  const existing = new Set(current.map(m => m.userName));
  const missing = current.filter(m => !counts.has(m.userName));
  return { missing, additions: publicMembers.filter(m => !existing.has(m.userName) && counts.get(m.userName) === 1), ambiguous: publicMembers.filter(m => counts.get(m.userName) > 1).map(m => m.userName).filter((v,i,a) => a.indexOf(v) === i) };
}
export function appendRoster(current, additions, newId = () => `rb-${crypto.randomUUID()}`) {
  if (!Array.isArray(additions) || !additions.length || current.length + additions.length > 50) throw new Error("追加人数を確認してください（最大50人）。");
  const names = new Set(current.map(m => m.userName));
  const appended = additions.map(m => {
    if (typeof m.userName !== 'string' || !m.userName.trim() || m.userName !== m.userName.trim() || m.userName.length > 100 || names.has(m.userName) || !Number.isInteger(m.level) || m.level < 1 || m.level > 10000) throw new Error("名前が重複または不正です。名簿を確認してください。");
    names.add(m.userName); return { uid: newId(), userName: m.userName, level: m.level, pvpLeaguePhase: '' };
  });
  return [...current, ...appended];
}
