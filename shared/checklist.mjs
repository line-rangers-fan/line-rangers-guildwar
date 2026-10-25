import { checked } from "./domain.mjs";
import { memberComparator } from "./personal.mjs";

export function attackCount(states, uid, day) {
  return checked(states, uid, day, 2) ? 2 : checked(states, uid, day, 1) ? 1 : 0;
}
export function groupMembers(members, states, day, mode, sort) {
  const compare = memberComparator(sort);
  if (mode === "all") return [{ key: "all", label: "", members: [...members].sort(compare) }];
  const pending = [], once = [], twice = [];
  for (const member of members) {
    const count = attackCount(states, member.uid, day);
    if (count === 0) pending.push(member);
    else if (count === 1) once.push(member);
    else twice.push(member);
  }
  const groups = [
    { key: "pending", label: "未攻撃", members: pending.sort(compare) },
    { key: "once", label: "1回済み", members: once.sort(compare) },
    { key: "twice", label: "2回済み", members: twice.sort(compare) },
  ];
  if (mode === "none") return groups.filter((group) => group.key === "pending" && group.members.length);
  if (mode === "once" || mode === "twice") return groups.filter((group) => group.key === mode && group.members.length);
  return (mode === "attacked" ? [...groups].reverse() : groups).filter((group) => group.members.length);
}
