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
    if (count === 0) pending.push(member);
    else finished.push(member);
  }
  const groups = [
    { key: "pending", label: "未攻撃", members: pending.sort(compare) },
    { key: "finished", label: "攻撃済み", members: finished.sort(compare) },
  ];
  return (mode === "attacked" ? groups.reverse() : groups).filter((group) => group.members.length);
}
