import { checked } from "./domain.mjs";
import { memberComparator } from "./personal.mjs";

export function attackCount(states, uid, day) {
  return checked(states, uid, day, 2) ? 2 : checked(states, uid, day, 1) ? 1 : 0;
}
export function groupMembers(members, states, day, mode, sort) {
  const compare = memberComparator(sort);
  if (mode === "all") return [{ key: "all", label: "", members: [...members].sort(compare) }];
  const pending = [], finished = [];
  for (const member of members) {
    const count = attackCount(states, member.uid, day);
    (mode === "none" ? count === 0 : count < 2) ? pending.push(member) : finished.push(member);
  }
  const byProgress = (a, b) => attackCount(states, a.uid, day) - attackCount(states, b.uid, day) || compare(a, b);
  return [
    { key: "pending", label: mode === "none" ? "未攻撃" : "残りあり", members: pending.sort(mode === "remaining" ? byProgress : compare) },
    { key: "finished", label: mode === "none" ? "攻撃あり" : "消化済み", members: finished.sort(compare) },
  ].filter((group) => group.members.length);
}
