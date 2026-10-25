import test from 'node:test';
import assert from 'node:assert/strict';
import { memberComparator, loadPersonal, PREFERENCES_KEY } from '../shared/personal.mjs';
import { groupMembers } from '../shared/checklist.mjs';
const members = [
  { uid:'unset', userName:'A', level:600, pvpLeaguePhase:'' },
  { uid:'masterLow', userName:'B', level:400, pvpLeaguePhase:'MASTER_1' },
  { uid:'legend', userName:'C', level:300, pvpLeaguePhase:'LEGEND' },
  { uid:'masterHigh', userName:'D', level:500, pvpLeaguePhase:'MASTER_1' },
];
test('PvP order prioritizes rank, breaks ties by level and places unset ranks last', () => {
  assert.deepEqual([...members].sort(memberComparator({key:'pvp',dir:-1})).map(m=>m.uid), ['legend','masterHigh','masterLow','unset']);
  assert.deepEqual([...members].sort(memberComparator({key:'level',dir:-1})).map(m=>m.uid), ['unset','masterHigh','masterLow','legend']);
});
test('PvP sort preference persists and attack groups keep their independent ordering', () => {
  const personal=loadPersonal({getItem:key=>key===PREFERENCES_KEY?JSON.stringify({sort:{key:'pvp',dir:-1},filter:'none'}):null});
  assert.equal(personal.sort.key,'pvp');
  assert.equal(loadPersonal({getItem:()=>null}).sort.key,'level');
  const day='2026-10-28';
  const states={legend:{[day]:{1:true}},masterHigh:{[day]:{1:true,2:true}}};
  const groups=groupMembers(members,states,day,personal.filter,personal.sort);
  assert.deepEqual(groups.map(g=>g.label),['未攻撃','攻撃済み']);
  assert.deepEqual(groups[0].members.map(m=>m.uid),['masterLow','unset']);
  assert.deepEqual(groups[1].members.map(m=>m.uid),['masterHigh','legend']);
});
