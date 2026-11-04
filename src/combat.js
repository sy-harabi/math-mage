/**
 * Resolve a chain BEFORE applying damage. The clicked enemy is target #1;
 * each subsequent jump finds the nearest unhit, living enemy in range.
 */
export function resolveChainTargets(primary, enemies, maxTargets = 1, range = 260) {
  if (!primary || !enemies.includes(primary) || primary.hp <= 0) return [];
  const targets=[primary],seen=new Set(targets);
  let current=primary;
  while(targets.length<maxTargets) {
    const next=enemies.filter(e=>!seen.has(e)&&e.hp>0&&
      Math.hypot(e.x-current.x,e.y-current.y)<=range)
      .sort((a,b)=>Math.hypot(a.x-current.x,a.y-current.y)-Math.hypot(b.x-current.x,b.y-current.y))[0];
    if(!next)break;
    targets.push(next);seen.add(next);current=next;
  }
  return targets;
}
